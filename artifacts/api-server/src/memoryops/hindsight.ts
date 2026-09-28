import { HindsightClient } from "@vectorize-io/hindsight-client";
import type { RecallResult } from "@vectorize-io/hindsight-client";

export interface HindsightConfig {
  baseUrl: string;
  apiKey?: string;
  bankId: string;
}

export interface RetainLessonInput {
  incidentId: string;
  publicId: string;
  title: string;
  service: string;
  rootCause: string;
  symptoms: string;
  actionsTaken: string;
  lessonsLearned: string;
  evidenceSummary?: string;
  conditions?: string;
}

export interface RetainResult {
  success: boolean;
  isLive: boolean;
  bankId: string;
  memoryId: string;
  content: string;
  source: string;
  error?: string;
}

export interface RecallInput {
  service: string;
  symptoms: string;
  errorSignature?: string;
  deploymentContext?: string;
  query?: string;
}

export interface RecalledMemoryItem {
  id: string;
  title: string;
  service: string;
  outcome: string;
  root_cause: string;
  content: string;
  relevance: string;
  source: string;
  created_at: string;
  incident_id: string;
  is_live: boolean;
}

export interface RecallOutput {
  memories: RecalledMemoryItem[];
  isLive: boolean;
  query: string;
  bankId: string;
  error?: string;
}

export interface ReflectOutput {
  text: string;
  source: string;
  isLive: boolean;
  bankId: string;
  error?: string;
}

export function getHindsightConfig(): HindsightConfig | null {
  const baseUrl = process.env.HINDSIGHT_BASE_URL?.trim();
  if (!baseUrl) return null;
  return {
    baseUrl,
    apiKey: process.env.HINDSIGHT_API_KEY?.trim() || undefined,
    bankId: process.env.HINDSIGHT_BANK_ID?.trim() || "memoryops-demo-northstar",
  };
}

export function isHindsightConfigured(): boolean {
  return getHindsightConfig() !== null;
}

export function createHindsightClient(): { client: HindsightClient; bankId: string } | null {
  const config = getHindsightConfig();
  if (!config) return null;
  const client = new HindsightClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    maxAttempts: 2,
  });
  return { client, bankId: config.bankId };
}

export async function checkHindsightHealth(): Promise<{ configured: boolean; reachable: boolean; detail: string }> {
  const config = getHindsightConfig();
  if (!config) {
    return {
      configured: false,
      reachable: false,
      detail: "HINDSIGHT_BASE_URL not configured — demo memory is explicitly simulated.",
    };
  }

  try {
    const hindsight = createHindsightClient();
    if (!hindsight) {
      return {
        configured: false,
        reachable: false,
        detail: "HINDSIGHT_BASE_URL is invalid or missing.",
      };
    }
    const version = await hindsight.client.getVersion({
      signal: AbortSignal.timeout(4000),
    });
    return {
      configured: true,
      reachable: true,
      detail: `Connected to Hindsight API v${version.api_version || "unknown"} (bank: ${config.bankId})`,
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      detail: `Hindsight configured at ${config.baseUrl} but unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Format an evidence-grounded, verified lesson.
 * Only retained after successful synthetic verification.
 */
export function formatRetainedContent(input: RetainLessonInput): string {
  const conditions = input.conditions || `Applies to ${input.service} when encountering similar error signatures or deployment changes.`;
  return [
    `Incident ${input.publicId} on service ${input.service}.`,
    `Symptoms: ${input.symptoms}`,
    input.evidenceSummary ? `Evidence: ${input.evidenceSummary}` : null,
    `Verified Root Cause: ${input.rootCause}`,
    `Successful Remediation: ${input.actionsTaken}`,
    `Lessons Learned: ${input.lessonsLearned}`,
    `Applicable Conditions: ${conditions}`,
  ].filter(Boolean).join(" ");
}

/**
 * Retain verified lesson in Hindsight (or record failure / fallback).
 */
export async function retainVerifiedLesson(
  input: RetainLessonInput,
  simulatedFallbackFn: (content: string) => { id: string }
): Promise<RetainResult> {
  const hindsight = createHindsightClient();
  const content = formatRetainedContent(input);

  if (!hindsight) {
    // Unconfigured: use explicit simulated fallback
    const local = simulatedFallbackFn(content);
    return {
      success: true,
      isLive: false,
      bankId: process.env.HINDSIGHT_BANK_ID || "memoryops-demo-northstar",
      memoryId: local.id,
      content,
      source: "Simulated demo memory — Hindsight unavailable",
    };
  }

  const { client, bankId } = hindsight;

  try {
    // Retain with documentId for idempotent replacement on retry
    const res = await client.retain(bankId, content, {
      context: `Verified post-mortem for incident ${input.publicId} (${input.service})`,
      documentId: `incident-${input.incidentId}`,
      metadata: {
        incident_id: input.incidentId,
        public_id: input.publicId,
        service: input.service,
        verified: "true",
        outcome: "verified_success",
      },
      tags: [input.service, "incident-response", "verified-lesson"],
      signal: AbortSignal.timeout(8000),
    });

    if (res && res.success !== false) {
      return {
        success: true,
        isLive: true,
        bankId,
        memoryId: `hindsight-${input.publicId}`,
        content,
        source: `Live Hindsight bank (${bankId})`,
      };
    }

    throw new Error("Hindsight retain returned unsuccessful response");
  } catch (caught) {
    const errorMsg = caught instanceof Error ? caught.message : String(caught);
    // CRITICAL: A remote operation failure must never be displayed as live success!
    return {
      success: false,
      isLive: false,
      bankId,
      memoryId: "",
      content,
      source: `Failed Hindsight retain — ${errorMsg}`,
      error: errorMsg,
    };
  }
}

/**
 * Query Hindsight for relevant prior incident memories.
 */
export async function recallMemories(
  input: RecallInput,
  fallbackLocalMemoriesFn: (query: string, service: string) => RecalledMemoryItem[]
): Promise<RecallOutput> {
  const queryParts = [input.service, input.symptoms];
  if (input.errorSignature) queryParts.push(input.errorSignature);
  if (input.deploymentContext) queryParts.push(input.deploymentContext);
  const query = input.query || queryParts.join(" ");

  const hindsight = createHindsightClient();
  const bankId = hindsight?.bankId || process.env.HINDSIGHT_BANK_ID || "memoryops-demo-northstar";

  if (!hindsight) {
    // Hindsight is not configured: use simulated fallback
    const localMemories = fallbackLocalMemoriesFn(query, input.service).map((m) => ({
      ...m,
      is_live: false,
      source: "Simulated demo memory — Hindsight unavailable",
    }));
    return {
      memories: localMemories,
      isLive: false,
      query,
      bankId,
    };
  }

  try {
    const res = await hindsight.client.recall(bankId, query, {
      budget: "mid",
      signal: AbortSignal.timeout(8000),
    });

    if (res && Array.isArray(res.results)) {
      const liveMemories: RecalledMemoryItem[] = res.results.map((r: RecallResult, idx: number) => ({
        id: r.id || `live-mem-${idx}`,
        title: r.context || `Live Hindsight memory (${input.service})`,
        service: (r.entities && r.entities[0]) || input.service,
        outcome: "verified_success",
        root_cause: r.text,
        content: r.text,
        relevance: "retrieved_from_live_bank",
        source: `Live Hindsight bank (${bankId})`,
        created_at: r.mentioned_at || r.occurred_start || new Date().toISOString(),
        incident_id: r.document_id || "",
        is_live: true,
      }));

      return {
        memories: liveMemories,
        isLive: true,
        query,
        bankId,
      };
    }

    throw new Error("Malformed recall response from Hindsight");
  } catch (caught) {
    const errorMsg = caught instanceof Error ? caught.message : String(caught);
    // Fall back to local store with clear error annotation
    const localMemories = fallbackLocalMemoriesFn(query, input.service).map((m) => ({
      ...m,
      is_live: false,
      source: `Simulated demo memory — Hindsight recall failed: ${errorMsg}`,
    }));
    return {
      memories: localMemories,
      isLive: false,
      query,
      bankId,
      error: errorMsg,
    };
  }
}

/**
 * Reflect across memories in the configured bank.
 */
export async function reflectOnMemories(
  query: string,
  context?: string,
  fallbackSimulatedFn?: (q: string) => string
): Promise<ReflectOutput> {
  const hindsight = createHindsightClient();
  const bankId = hindsight?.bankId || process.env.HINDSIGHT_BANK_ID || "memoryops-demo-northstar";

  if (!hindsight) {
    const fallbackText = fallbackSimulatedFn
      ? fallbackSimulatedFn(query)
      : "No live Hindsight configured. Across retained demo records, verified rollback or configuration correction restored service; restart did not hold.";
    return {
      text: fallbackText,
      source: "Simulated reflect — Hindsight unavailable",
      isLive: false,
      bankId,
    };
  }

  try {
    const res = await hindsight.client.reflect(bankId, query, {
      context,
      budget: "mid",
      signal: AbortSignal.timeout(10000),
    });

    if (res && typeof res.text === "string") {
      return {
        text: res.text,
        source: `Live Hindsight reflect (${bankId})`,
        isLive: true,
        bankId,
      };
    }

    throw new Error("Malformed reflect response from Hindsight");
  } catch (caught) {
    const errorMsg = caught instanceof Error ? caught.message : String(caught);
    const fallbackText = fallbackSimulatedFn
      ? fallbackSimulatedFn(query)
      : "Fallback synthesis: across retained payment incidents, restart attempts failed while rollback restored health.";
    return {
      text: fallbackText,
      source: `Simulated reflect — Hindsight call failed: ${errorMsg}`,
      isLive: false,
      bankId,
      error: errorMsg,
    };
  }
}
