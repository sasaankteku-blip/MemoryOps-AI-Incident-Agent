import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import {
  checkHindsightHealth,
  isHindsightConfigured,
  recallMemories,
  reflectOnMemories,
  retainVerifiedLesson,
  type RecalledMemoryItem,
} from "./hindsight";

export type Severity = "sev1" | "sev2" | "sev3" | "sev4";
export type IncidentStatus =
  | "new"
  | "investigating"
  | "awaiting_approval"
  | "remediating"
  | "verifying"
  | "resolved"
  | "unresolved"
  | "investigation_failed"
  | "remediation_failed";

export interface Evidence {
  id: string;
  kind: string;
  label: string;
  detail: string;
  origin: string;
  observed_at: string;
}

export interface Incident {
  id: string;
  public_id: string;
  title: string;
  service: string;
  severity: Severity;
  status: IncidentStatus;
  summary: string;
  started_at: string;
  resolved_at: string | null;
  source: "fixture" | "custom";
  is_demo: boolean;
  scenario_key: string | null;
  evidence: Evidence[];
}

export interface MemoryRecord {
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
  is_live?: boolean;
}

export interface Hypothesis {
  rank: number;
  statement: string;
  confidence: string;
  rationale: string;
  supporting: string[];
  contradicting: string[];
  influence: string;
}

export interface Proposal {
  id: string;
  action_type: string;
  target: string;
  rationale: string;
  risk: string;
  expected_result: string;
  status: string;
  historical_note: string;
}

export interface ExecutionRecord {
  status: string;
  action_type: string;
  simulated: boolean;
  detail: string;
  executed_at?: string;
}

export interface VerificationRecord {
  passed: boolean;
  method: string;
  observed_state: string;
  verified_at?: string;
}

export interface Investigation {
  run_id: string;
  status: string;
  stage: string;
  steps: Array<{ name: string; label: string; status: string; detail: string }>;
  evidence: Evidence[];
  memories: MemoryRecord[];
  hypotheses: Hypothesis[];
  proposal: Proposal | null;
  execution: ExecutionRecord | null;
  verification: VerificationRecord | null;
  degraded: boolean;
  pre_recall_analysis: string;
  after_recall_analysis: string;
  reflection: string | null;
  missing_info: string[];
  approval?: { decision: string; reason?: string; decided_at?: string };
}

export interface Postmortem {
  id: string;
  incident_id: string;
  summary: string;
  root_cause: string;
  timeline: string;
  lessons_learned: string;
  actions_taken: string;
  review_status: "draft" | "reviewed";
  retention_status: "not_retained" | "retained" | "failed";
  retained_at: string | null;
  retention_source?: string;
  error?: string;
}

interface Scenario {
  key: string;
  title: string;
  service: string;
  severity: Severity;
  description: string;
  postRemediation: Record<string, { passed: boolean; state: string }>;
  evidence: Evidence[];
}

interface State {
  incidents: Incident[];
  memories: MemoryRecord[];
  investigations: Record<string, Investigation>;
  postmortems: Record<string, Postmortem>;
  retainedOperations: Array<{
    id: string;
    incident_id: string;
    op: string;
    status: string;
    created_at: string;
    source?: string;
    is_live?: boolean;
    error?: string;
  }>;
  resetAt: string | null;
}

const now = () => new Date().toISOString();

const evidenceFor = (scenario: string, service: string, started: string): Evidence[] => {
  const shared = [
    {
      id: `${scenario}-log-01`,
      kind: "log",
      label: "Error signature",
      detail: scenario === "payment-outage-a" || scenario === "payment-outage-b"
        ? "HTTP 503 rate increased while payment requests reported upstream connection timeouts."
        : scenario === "auth-regression"
          ? "JWT validation rejected login tokens: issuer or audience did not match the configured contract."
          : scenario === "latency-deployment"
            ? "p95 latency rose immediately after the latest order-service deployment."
            : "notification requests timed out while the SMTP dependency was unavailable.",
      origin: "fixture",
      observed_at: started,
    },
    {
      id: `${scenario}-metric-01`,
      kind: "metric",
      label: "Service telemetry",
      detail: scenario === "payment-outage-a"
        ? "payment-api error rate 38%; postgres-primary active connections at the configured ceiling."
        : scenario === "payment-outage-b"
          ? "payment-api error rate 21%; database connections elevated but not at the ceiling."
          : scenario === "auth-regression"
            ? "auth-service login failure rate 47%; postgres-primary connections normal."
            : scenario === "latency-deployment"
              ? "order-service p95 latency 2.8s; CPU steady at 46%."
              : "notification-service timeout rate 63%; SMTP dependency health check failed.",
      origin: "fixture",
      observed_at: new Date(Date.parse(started) + 60_000).toISOString(),
    },
    {
      id: `${scenario}-deploy-01`,
      kind: "deployment",
      label: "Latest deployment",
      detail: scenario === "payment-outage-a"
        ? "d-4821 changed DB_POOL_MAX from 50 to 10 and added a connection-heavy retry loop."
        : scenario === "payment-outage-b"
          ? "d-5107 introduced a new payment provider SDK; no pool-limit change was recorded."
          : scenario === "auth-regression"
            ? "auth-config-221 changed the JWT issuer and audience values."
            : scenario === "latency-deployment"
              ? "d-5312 added synchronous inventory enrichment to the checkout path."
              : "No internal deployment correlated with the dependency failure; the SMTP provider reported errors.",
      origin: "fixture",
      observed_at: new Date(Date.parse(started) - 300_000).toISOString(),
    },
  ];
  if (scenario === "payment-outage-a") {
    shared.push({
      id: `${scenario}-config-01`,
      kind: "config_change",
      label: "Pool configuration",
      detail: "DB_POOL_MAX: 50 → 10; retry backoff was removed.",
      origin: "fixture",
      observed_at: new Date(Date.parse(started) - 280_000).toISOString(),
    });
  }
  if (scenario === "payment-outage-b") {
    shared.push({
      id: `${scenario}-dependency-01`,
      kind: "dependency",
      label: "Provider SDK timeout",
      detail: "New provider SDK requests exceeded the 1.5s timeout on card authorization.",
      origin: "fixture",
      observed_at: new Date(Date.parse(started) + 90_000).toISOString(),
    });
  }
  return shared;
};

const scenarios: Scenario[] = [
  {
    key: "payment-outage-a",
    title: "Payment connection pool exhaustion",
    service: "payment-api",
    severity: "sev1",
    description: "503s after a pool limit and retry-loop change.",
    postRemediation: {
      restart: { passed: false, state: "error rate returned within minutes" },
      rollback: { passed: true, state: "payment-api 2xx rate restored" },
      config_fix: { passed: true, state: "pool pressure normalized" },
      scale: { passed: false, state: "capacity increased but error signature persisted" },
    },
    evidence: evidenceFor("payment-outage-a", "payment-api", "2025-06-16T09:14:00Z"),
  },
  {
    key: "payment-outage-b",
    title: "Payment provider timeout burst",
    service: "payment-api",
    severity: "sev1",
    description: "A second payment incident after a different provider SDK deployment.",
    postRemediation: {
      restart: { passed: false, state: "provider timeouts returned" },
      rollback: { passed: true, state: "authorization success rate restored" },
      config_fix: { passed: true, state: "provider timeout setting corrected" },
      scale: { passed: false, state: "upstream timeout remained" },
    },
    evidence: evidenceFor("payment-outage-b", "payment-api", "2025-07-03T18:21:00Z"),
  },
  {
    key: "auth-regression",
    title: "Auth token validation regression",
    service: "auth-service",
    severity: "sev2",
    description: "Login failures after a JWT issuer/audience configuration change.",
    postRemediation: {
      restart: { passed: false, state: "invalid tokens continued" },
      rollback: { passed: true, state: "login success rate restored" },
      config_fix: { passed: true, state: "issuer and audience match restored" },
      scale: { passed: false, state: "validation mismatch remained" },
    },
    evidence: evidenceFor("auth-regression", "auth-service", "2025-07-08T11:05:00Z"),
  },
  {
    key: "latency-deployment",
    title: "Checkout latency after enrichment deploy",
    service: "order-service",
    severity: "sev2",
    description: "p95 latency increased after synchronous inventory enrichment.",
    postRemediation: {
      restart: { passed: false, state: "latency returned after warmup" },
      rollback: { passed: true, state: "checkout p95 returned below 800ms" },
      config_fix: { passed: false, state: "enrichment remained synchronous" },
      scale: { passed: true, state: "latency reduced while capacity was expanded" },
    },
    evidence: evidenceFor("latency-deployment", "order-service", "2025-07-11T15:40:00Z"),
  },
  {
    key: "notification-dependency",
    title: "Notification delivery dependency failure",
    service: "notification-service",
    severity: "sev2",
    description: "SMTP provider failure causing downstream notification timeouts.",
    postRemediation: {
      restart: { passed: false, state: "SMTP dependency remained unavailable" },
      rollback: { passed: false, state: "no internal deployment to roll back" },
      config_fix: { passed: true, state: "failover SMTP route enabled" },
      scale: { passed: false, state: "dependency timeout remained" },
    },
    evidence: evidenceFor("notification-dependency", "notification-service", "2025-07-14T07:30:00Z"),
  },
];

const makeIncident = (scenario: Scenario, index: number): Incident => ({
  id: randomUUID(),
  public_id: scenario.key === "payment-outage-a"
    ? "INC-2025-0117"
    : scenario.key === "payment-outage-b"
      ? "INC-2025-0164"
      : scenario.key === "auth-regression"
        ? "INC-2025-0171"
        : `INC-2025-01${72 + index}`,
  title: scenario.title,
  service: scenario.service,
  severity: scenario.severity,
  status: "new",
  summary: scenario.description,
  started_at: scenario.evidence[0]?.observed_at ?? now(),
  resolved_at: null,
  source: "fixture",
  is_demo: true,
  scenario_key: scenario.key,
  evidence: scenario.evidence,
});

const stateFile = resolve(process.env.MEMORYOPS_STATE_FILE ?? ".data/memoryops.json");

const initialState = (): State => ({
  incidents: scenarios.map(makeIncident),
  memories: [],
  investigations: {},
  postmortems: {},
  retainedOperations: [],
  resetAt: null,
});

const load = (): State => {
  try {
    const raw = readFileSync(stateFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      incidents: Array.isArray(parsed.incidents) ? parsed.incidents : scenarios.map(makeIncident),
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      investigations: parsed.investigations && typeof parsed.investigations === "object" ? parsed.investigations : {},
      postmortems: parsed.postmortems && typeof parsed.postmortems === "object" ? parsed.postmortems : {},
      retainedOperations: Array.isArray(parsed.retainedOperations) ? parsed.retainedOperations : [],
      resetAt: typeof parsed.resetAt === "string" ? parsed.resetAt : null,
    };
  } catch {
    const fresh = initialState();
    persist(fresh);
    return fresh;
  }
};

const state = load();

function persist(next = state) {
  try {
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify(next, null, 2));
  } catch (err) {
    console.error("Failed to persist state file:", err);
  }
}

export const listScenarios = () =>
  scenarios.map((scenario) => ({
    key: scenario.key,
    title: scenario.title,
    service: scenario.service,
    severity: scenario.severity,
    description: scenario.description,
    loaded: state.incidents.some((incident) => incident.scenario_key === scenario.key),
  }));

export const getScenario = (key: string | null | undefined) =>
  scenarios.find((scenario) => scenario.key === key);

export const listIncidents = (filters: { status?: string; severity?: string; service?: string }) =>
  state.incidents
    .filter((incident) => !filters.status || incident.status === filters.status)
    .filter((incident) => !filters.severity || incident.severity === filters.severity)
    .filter((incident) => !filters.service || incident.service === filters.service)
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));

export const findIncident = (id: string) =>
  state.incidents.find((incident) => incident.id === id || incident.public_id === id);

export const dashboard = () => {
  const resolved = state.incidents.filter((incident) => incident.status === "resolved");
  const active = state.incidents.filter((incident) => !["resolved", "unresolved"].includes(incident.status));
  const durations = resolved
    .filter((incident) => incident.resolved_at)
    .map((incident) => Date.parse(incident.resolved_at as string) - Date.parse(incident.started_at));
  const breakdown = (["sev1", "sev2", "sev3", "sev4"] as Severity[]).map((severity) => ({
    severity,
    count: state.incidents.filter((incident) => incident.severity === severity).length,
  }));
  return {
    active_incidents: active.length,
    resolved_incidents: resolved.length,
    mttr_minutes: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60) : null,
    recurrence_count: state.incidents.filter((incident) => {
      const run = state.investigations[incident.id];
      return Boolean(run?.memories.length);
    }).length,
    memory_count: state.memories.length,
    severity_breakdown: breakdown,
    services: [
      { name: "payment-api", status: active.some((i) => i.service === "payment-api") ? "degraded" : "healthy", note: "Synthetic fixture telemetry" },
      { name: "order-service", status: "healthy", note: "Synthetic fixture telemetry" },
      { name: "auth-service", status: "healthy", note: "Synthetic fixture telemetry" },
      { name: "postgres-primary", status: "healthy", note: "Synthetic fixture telemetry" },
    ],
    recent_incidents: listIncidents({}).slice(0, 5).map(summary),
  };
};

export const summary = (incident: Incident) => ({
  id: incident.id,
  public_id: incident.public_id,
  title: incident.title,
  service: incident.service,
  severity: incident.severity,
  status: incident.status,
  summary: incident.summary,
  started_at: incident.started_at,
  resolved_at: incident.resolved_at,
  source: incident.source,
  is_demo: incident.is_demo,
  scenario_key: incident.scenario_key,
});

const buildHypotheses = (incident: Incident, memories: MemoryRecord[]): Hypothesis[] => {
  const hasRestartFailureMemory = memories.some(
    (m) => m.content.toLowerCase().includes("restart") && (m.content.toLowerCase().includes("failed") || m.content.toLowerCase().includes("transient") || m.content.toLowerCase().includes("returned"))
  );

  if (incident.scenario_key === "payment-outage-b" || (incident.service === "payment-api" && memories.length > 0)) {
    return [
      {
        rank: 1,
        statement: "A connection-leak or pool interaction remains possible, but the current evidence does not establish it as the root cause.",
        confidence: "medium",
        rationale: "503s and elevated database connections overlap with the prior incident, but the pool is not at its ceiling and the deployment is different.",
        supporting: [`${incident.scenario_key ?? "incident"}-log-01`, `${incident.scenario_key ?? "incident"}-metric-01`],
        contradicting: [`${incident.scenario_key ?? "incident"}-deploy-01`],
        influence: memories.length
          ? (hasRestartFailureMemory
              ? "Hindsight supplies historical context from the bank: restart previously failed to hold, so restart is deprioritized while investigating the new SDK deployment."
              : "Hindsight supplies related service experience from the bank.")
          : "No recalled memory influence.",
      },
      {
        rank: 2,
        statement: "The new provider SDK may be introducing upstream authorization timeouts.",
        confidence: "medium",
        rationale: "The fixture contains a provider timeout from the new SDK and no pool-limit change.",
        supporting: [`${incident.scenario_key ?? "incident"}-dependency-01`, `${incident.scenario_key ?? "incident"}-deploy-01`].filter((id) =>
          incident.evidence.some((e) => e.id === id)
        ),
        contradicting: [],
        influence: "Current evidence keeps this alternative visible rather than assuming the past cause repeated.",
      },
    ];
  }

  if (incident.scenario_key === "auth-regression") {
    return [{
      rank: 1,
      statement: "The JWT issuer and audience configuration no longer match the identity provider contract.",
      confidence: "high",
      rationale: "The login errors are explicit validation failures and database telemetry is normal.",
      supporting: [`${incident.scenario_key}-log-01`, `${incident.scenario_key}-deploy-01`],
      contradicting: [],
      influence: memories.length ? "Recalled memories evaluated and determined not applicable to JWT config." : "Hindsight stayed out of the recommendation because no relevant auth memory was recalled.",
    }];
  }

  if (incident.scenario_key === "payment-outage-a") {
    return [{
      rank: 1,
      statement: "The pool limit and retry-loop change exhausted postgres connection capacity.",
      confidence: "high",
      rationale: "The deployment changed DB_POOL_MAX to 10 and the database reached its connection ceiling.",
      supporting: [`${incident.scenario_key}-log-01`, `${incident.scenario_key}-metric-01`, `${incident.scenario_key}-config-01`],
      contradicting: [],
      influence: memories.length ? "Prior incident experience considered." : "No prior experience was found in the memory bank.",
    }];
  }

  return [{
    rank: 1,
    statement: incident.scenario_key === "latency-deployment"
      ? "Synchronous inventory enrichment in the new deployment is on the critical checkout path."
      : "The downstream SMTP dependency is the most likely source of the notification timeouts.",
    confidence: "medium",
    rationale: "The timing and dependency telemetry correlate with the incident, but verification is still required.",
    supporting: [`${incident.scenario_key ?? "incident"}-log-01`, `${incident.scenario_key ?? "incident"}-metric-01`, `${incident.scenario_key ?? "incident"}-deploy-01`].filter((id) =>
      incident.evidence.some((e) => e.id === id)
    ),
    contradicting: [],
    influence: memories.length ? "Informed by prior engineering memory." : "Recommendation is based on current evidence only.",
  }];
};

const recommendation = (incident: Incident, memories: MemoryRecord[]): Proposal => {
  const action = incident.scenario_key === "auth-regression" ? "config_fix"
    : incident.scenario_key === "notification-dependency" ? "config_fix"
      : incident.scenario_key === "latency-deployment" ? "rollback"
        : "rollback";

  const hasRestartFailureMemory = memories.some(
    (m) => m.content.toLowerCase().includes("restart") && (m.content.toLowerCase().includes("failed") || m.content.toLowerCase().includes("transient") || m.content.toLowerCase().includes("returned"))
  );

  return {
    id: `proposal-${incident.id}`,
    action_type: action,
    target: incident.scenario_key === "payment-outage-b" ? "payment-api / d-5107" : incident.service,
    rationale: incident.scenario_key === "payment-outage-b"
      ? "Rollback the new provider SDK deployment while checking pool settings in parallel. This limits blast radius without asserting an identical root cause."
      : incident.scenario_key === "payment-outage-a"
        ? "Rollback d-4821 to restore the known-good pool limit and remove the connection-heavy retry loop."
        : incident.scenario_key === "auth-regression"
          ? "Restore the issuer and audience values to the identity provider contract."
          : incident.scenario_key === "notification-dependency"
            ? "Enable the configured SMTP failover route and verify delivery on a synthetic notification."
            : "Rollback the latest enrichment change and re-check checkout latency.",
    risk: "Simulated only. In production, validate blast radius and owner approval before changing traffic.",
    expected_result: "Error rate and the affected service health check return to the fixture's known-good state.",
    status: "proposed",
    historical_note: memories.length
      ? (hasRestartFailureMemory
          ? `Retrieved memory (${memories[0]?.source || "Hindsight"}): restart failed on a related payment incident, so restart is intentionally deprioritized in favor of ${action}.`
          : `Retrieved memory from bank (${memories[0]?.source || "Hindsight"}): applying verified pattern to guide remediation.`)
      : "No relevant prior experience found; this recommendation is based on current evidence.",
  };
};

export const startInvestigation = async (incidentId: string): Promise<Investigation> => {
  const incident = findIncident(incidentId);
  if (!incident) throw new Error("Incident not found");
  const existing = state.investigations[incident.id];
  if (existing && ["awaiting_approval", "verifying", "completed", "resolved"].includes(existing.status)) {
    return existing;
  }
  const scenario = getScenario(incident.scenario_key);
  if (!scenario && incident.source !== "custom") throw new Error("Scenario fixture not found");
  incident.status = "investigating";

  // Query Hindsight bank using service, symptoms, error signatures, and deployment context
  const logEvidence = incident.evidence.find((e) => e.kind === "log")?.detail;
  const deployEvidence = incident.evidence.find((e) => e.kind === "deployment")?.detail;

  const recallResult = await recallMemories(
    {
      service: incident.service,
      symptoms: incident.summary,
      errorSignature: logEvidence,
      deploymentContext: deployEvidence,
    },
    (_query, service) => {
      // Local simulated fallback
      return state.memories
        .filter((memory) => memory.service === service || memory.content.toLowerCase().includes(service.toLowerCase()))
        .map((m) => ({ ...m, is_live: false, relevance: "retrieved_from_demo_bank" }));
    }
  );

  const memories: MemoryRecord[] = recallResult.memories.map((m) => ({
    id: m.id,
    title: m.title,
    service: m.service,
    outcome: m.outcome,
    root_cause: m.root_cause,
    content: m.content,
    relevance: m.relevance,
    source: m.source,
    created_at: m.created_at,
    incident_id: m.incident_id,
    is_live: m.is_live,
  }));

  let reflectionText: string | null = null;
  if (memories.length > 1) {
    const reflectRes = await reflectOnMemories(
      `Across past incidents for service ${incident.service}, what remediation patterns recur and which actions succeeded vs failed?`,
      `Incident ${incident.public_id} (${incident.service})`,
      () => "Across past payment incidents, restarts did not hold; rollback or configuration correction restored service when verified."
    );
    reflectionText = reflectRes.text;
  }

  const hypotheses = buildHypotheses(incident, memories);
  const run: Investigation = {
    run_id: randomUUID(),
    status: "awaiting_approval",
    stage: "awaiting_approval",
    steps: [
      { name: "intake_validate", label: "Validate intake", status: "completed", detail: "Incident accepted and moved to investigation." },
      { name: "collect_evidence", label: "Collect evidence", status: "completed", detail: `${incident.evidence.length} immutable fixture observations collected.` },
      {
        name: "hindsight_recall",
        label: "Recall Hindsight",
        status: "completed",
        detail: memories.length
          ? `Retrieved ${memories.length} related memory from ${recallResult.isLive ? `live Hindsight bank (${recallResult.bankId})` : "demo memory bank"}.`
          : "No relevant prior experience found.",
      },
      {
        name: "pattern_synthesis",
        label: "Synthesize patterns",
        status: memories.length > 1 ? "completed" : "skipped",
        detail: memories.length > 1 ? "Reflection synthesized recurring causes and outcomes." : "Skipped: fewer than two memories available.",
      },
      { name: "analyze_current", label: "Analyze current evidence", status: "completed", detail: "Current-evidence analysis stored before recall influence." },
      { name: "generate_hypotheses", label: "Generate hypotheses", status: "completed", detail: `${hypotheses.length} evidence-cited hypotheses ranked.` },
      { name: "assess_confidence", label: "Assess confidence", status: "completed", detail: "Confidence capped by supporting and contradicting evidence." },
      { name: "recommend_remediation", label: "Recommend action", status: "completed", detail: "Proposal is waiting for human approval." },
    ],
    evidence: incident.evidence,
    memories,
    hypotheses,
    proposal: recommendation(incident, memories),
    execution: null,
    verification: null,
    degraded: true,
    pre_recall_analysis: incident.scenario_key === "payment-outage-b"
      ? "503s and elevated connections suggest a payment-path capacity issue, but the current evidence does not isolate the cause."
      : hypotheses[0]?.statement ?? "The fixture does not contain enough evidence for a safe conclusion.",
    after_recall_analysis: memories.length
      ? `Recalled ${memories.length} relevant lesson(s) from ${memories[0]?.source || "Hindsight"}. The recalled payment incident overlaps on 503s and connection pressure, but differs in deployment and provider timeout signals. The prior failed restart is carried forward as a constraint, avoiding repeat mistakes.`
      : "No relevant prior experience found. The recommendation is based on current evidence only.",
    reflection: reflectionText,
    missing_info: incident.scenario_key === "payment-outage-b"
      ? ["Confirm whether provider SDK requests leak connections under timeout.", "Compare pool wait time before and after d-5107."]
      : [],
  };

  state.investigations[incident.id] = run;
  persist();
  return run;
};

export const getInvestigation = (incidentId: string) => {
  const incident = findIncident(incidentId);
  return incident ? state.investigations[incident.id] ?? null : null;
};

/**
 * Human Approval Gate:
 * Approves or rejects remediation proposal.
 * Note: Approval triggers simulated execution, but DOES NOT perform verification.
 * Execution attempted != successful verification.
 */
export const decideRemediation = (incidentId: string, decision: "approved" | "rejected", reason?: string) => {
  const incident = findIncident(incidentId);
  if (!incident) throw new Error("Incident not found");
  const run = state.investigations[incident.id];
  if (!run?.proposal) throw new Error("No remediation proposal is available");
  if (run.approval) return run;

  const decisionTime = now();
  run.approval = { decision, reason, decided_at: decisionTime };
  run.proposal.status = decision === "approved" ? "executed" : "rejected";

  if (decision === "rejected") {
    run.status = "unresolved";
    run.stage = "unresolved";
    incident.status = "unresolved";
    persist();
    return run;
  }

  // Approved: initiate simulated execution
  incident.status = "remediating";
  run.stage = "verifying";

  run.execution = {
    status: "succeeded",
    action_type: run.proposal.action_type,
    simulated: true,
    detail: `SIMULATED: ${run.proposal.action_type} executed on ${run.proposal.target}. Synthetic verification pending. No real infrastructure was changed.`,
    executed_at: decisionTime,
  };

  // Crucial: verification is not completed yet!
  run.verification = null;
  persist();
  return run;
};

/**
 * Dedicated Synthetic Verification:
 * Checks synthetic execution result against fixture expected outcome,
 * records verification results and timestamp, and transitions state.
 * Only successful verification qualifies an incident for resolution & retention.
 */
export const verifyRemediation = (incidentId: string): Investigation => {
  const incident = findIncident(incidentId);
  if (!incident) throw new Error("Incident not found");

  const run = state.investigations[incident.id];
  if (!run?.execution) {
    throw new Error("No simulated execution exists to verify.");
  }

  // Idempotent check: if already verified and passed, return existing state safely
  if (run.verification?.passed && incident.status === "resolved") {
    return run;
  }

  const scenario = getScenario(incident.scenario_key);
  const actionType = run.execution.action_type;
  const outcome = scenario?.postRemediation[actionType] ?? {
    passed: false,
    state: `No synthetic fixture outcome defined for action: ${actionType}`,
  };

  const verifiedAt = now();
  run.verification = {
    passed: outcome.passed,
    method: "Compared simulated observed state with scenario fixture post-remediation criteria.",
    observed_state: outcome.state,
    verified_at: verifiedAt,
  };

  if (outcome.passed) {
    run.status = "completed";
    run.stage = "resolved";
    incident.status = "resolved";
    incident.resolved_at = verifiedAt;

    // Create draft postmortem for review
    if (!state.postmortems[incident.id]) {
      state.postmortems[incident.id] = {
        id: `pm-${incident.id}`,
        incident_id: incident.id,
        summary: incident.summary,
        root_cause: run.hypotheses[0]?.statement ?? "Under investigation",
        timeline: `${incident.started_at} — evidence collected; simulated ${actionType} approved and verified.`,
        lessons_learned: incident.scenario_key === "payment-outage-a"
          ? "A restart only improved the payment path transiently. Rollback restored service; pool and retry settings are the durable fix."
          : "Use verified fixture outcomes to distinguish mitigation from durable correction.",
        actions_taken: `${actionType} — ${run.execution.detail}`,
        review_status: "draft",
        retention_status: "not_retained",
        retained_at: null,
      };
    }
  } else {
    run.status = "remediation_failed";
    run.stage = "remediation_failed";
    incident.status = "remediation_failed";
  }

  persist();
  return run;
};

export const getPostmortem = (incidentId: string) => state.postmortems[findIncident(incidentId)?.id ?? ""] ?? null;

export const updatePostmortem = (
  incidentId: string,
  input: Omit<Postmortem, "id" | "incident_id" | "review_status" | "retention_status" | "retained_at">
) => {
  const incident = findIncident(incidentId);
  if (!incident) throw new Error("Incident not found");
  const existing = state.postmortems[incident.id];
  const postmortem: Postmortem = {
    id: existing?.id ?? `pm-${incident.id}`,
    incident_id: incident.id,
    ...input,
    review_status: "reviewed",
    retention_status: existing?.retention_status ?? "not_retained",
    retained_at: existing?.retained_at ?? null,
    retention_source: existing?.retention_source,
    error: existing?.error,
  };
  state.postmortems[incident.id] = postmortem;
  persist();
  return postmortem;
};

/**
 * Retain post-mortem in Hindsight.
 * Only allowed after synthetic verification has passed.
 * Avoids duplicate retention on retries.
 */
export const retainPostmortem = async (incidentId: string): Promise<Postmortem> => {
  const incident = findIncident(incidentId);
  if (!incident) throw new Error("Incident not found");
  const pm = state.postmortems[incident.id];
  if (!pm) throw new Error("Generate and review the post-mortem before retention");

  const run = getInvestigation(incident.id);
  if (incident.status !== "resolved" || !run?.verification?.passed) {
    throw new Error("Only verified-resolved incidents can be retained");
  }

  // Idempotent: avoid duplicate retention
  if (pm.retention_status === "retained") return pm;

  const retainResult = await retainVerifiedLesson(
    {
      incidentId: incident.id,
      publicId: incident.public_id,
      title: incident.title,
      service: incident.service,
      rootCause: pm.root_cause,
      symptoms: incident.summary,
      actionsTaken: pm.actions_taken,
      lessonsLearned: pm.lessons_learned,
      evidenceSummary: incident.evidence.map((e) => `${e.label}: ${e.detail}`).join("; "),
    },
    (content) => {
      // Local fallback ID generator
      const memId = `memory-${incident.public_id}`;
      return { id: memId };
    }
  );

  if (retainResult.success) {
    pm.retention_status = "retained";
    pm.retained_at = now();
    pm.retention_source = retainResult.source;

    // Remove any existing duplicate memory entry for this incident ID
    state.memories = state.memories.filter((m) => m.incident_id !== incident.id);

    state.memories.push({
      id: retainResult.memoryId || `memory-${incident.public_id}`,
      title: `${incident.public_id}: ${incident.title}`,
      service: incident.service,
      outcome: "verified_success",
      root_cause: run?.hypotheses[0]?.statement ?? pm.root_cause,
      content: retainResult.content,
      relevance: "retrieved_from_bank",
      source: retainResult.source,
      created_at: pm.retained_at,
      incident_id: incident.id,
      is_live: retainResult.isLive,
    });

    state.retainedOperations.push({
      id: randomUUID(),
      incident_id: incident.id,
      op: "retain",
      status: "success",
      created_at: pm.retained_at,
      source: retainResult.source,
      is_live: retainResult.isLive,
    });

    persist();
    return pm;
  }

  // Failed remote retention: record failure truthfully
  pm.retention_status = "failed";
  pm.error = retainResult.error;
  pm.retention_source = retainResult.source;

  state.retainedOperations.push({
    id: randomUUID(),
    incident_id: incident.id,
    op: "retain",
    status: "failed",
    created_at: now(),
    source: retainResult.source,
    is_live: false,
    error: retainResult.error,
  });

  persist();
  throw new Error(`Remote Hindsight retention failed: ${retainResult.error}`);
};

export const listMemories = (filters: { service?: string; q?: string; outcome?: string; root_cause?: string }) =>
  state.memories.filter((memory) =>
    (!filters.service || memory.service === filters.service) &&
    (!filters.outcome || memory.outcome === filters.outcome) &&
    (!filters.root_cause || memory.root_cause.toLowerCase().includes(filters.root_cause.toLowerCase())) &&
    (!filters.q || `${memory.title} ${memory.content}`.toLowerCase().includes(filters.q.toLowerCase())),
  );

export const resetDemo = () => {
  state.incidents = [];
  state.memories = [];
  state.investigations = {};
  state.postmortems = {};
  state.retainedOperations = [];
  state.resetAt = now();
  persist();
};

export const loadDemo = () => {
  const existing = new Set(state.incidents.map((incident) => incident.scenario_key));
  scenarios.forEach((scenario, index) => {
    if (!existing.has(scenario.key)) state.incidents.push(makeIncident(scenario, index));
  });
  persist();
  return state.incidents.length;
};

export const trace = (incidentId: string) => {
  const incident = findIncident(incidentId);
  const run = incident ? state.investigations[incident.id] : null;
  if (!incident || !run) return { nodes: [] };
  const memorySource = run.memories[0]?.source || (isHindsightConfigured() ? "live Hindsight bank" : "simulated demo memory");
  return {
    nodes: [
      { type: "current_incident", label: incident.public_id, value: incident.title, source: "application" },
      ...run.evidence.map((evidence) => ({ type: "current_evidence", label: evidence.label, value: evidence.detail, evidence_id: evidence.id, source: evidence.origin })),
      { type: "hindsight_recall", query: `${incident.service} ${incident.summary}`, count: run.memories.length, empty: run.memories.length === 0, source: memorySource },
      ...run.memories.map((memory) => ({
        type: "memory",
        label: memory.title,
        value: memory.content,
        why_relevant: `Matching service ${memory.service} and overlapping error signature.`,
        actions_that_failed: memory.content.toLowerCase().includes("restart") ? ["restart"] : [],
        influence_on_recommendation: memory.id,
        is_live: memory.is_live ?? false,
        source: memory.source,
      })),
      ...(run.reflection ? [{ type: "outcome_patterns", value: run.reflection, source: isHindsightConfigured() ? "live Hindsight reflect" : "simulated reflect" }] : []),
      { type: "diagnosis", value: run.hypotheses[0]?.statement ?? "No diagnosis", confidence: run.hypotheses[0]?.confidence ?? "low" },
      { type: "recommendation", value: run.proposal?.rationale ?? "No proposal", action: run.proposal?.action_type ?? "none" },
    ],
  };
};

export const integrationStatus = async () => {
  const hindsightHealth = await checkHindsightHealth();
  return [
    {
      name: "Hindsight",
      configured: hindsightHealth.configured,
      reachable: hindsightHealth.reachable,
      detail: hindsightHealth.detail,
    },
    {
      name: "LLM",
      configured: Boolean(process.env.GROQ_API_KEY),
      reachable: false,
      detail: process.env.GROQ_API_KEY ? "GROQ_API_KEY configured; LLM structured-output adapter enabled." : "GROQ_API_KEY not configured.",
    },
    {
      name: "GitHub",
      configured: Boolean(process.env.GITHUB_TOKEN),
      reachable: false,
      detail: process.env.GITHUB_TOKEN ? "GITHUB_TOKEN configured." : "Optional and disabled by default.",
    },
  ];
};

export const createCustomIncident = (input: { title?: string; service?: string; severity?: string; summary?: string }) => {
  const incident: Incident = {
    id: randomUUID(),
    public_id: `INC-CUSTOM-${String(state.incidents.length + 1).padStart(3, "0")}`,
    title: input.title?.trim() || "Custom production incident",
    service: input.service?.trim() || "unknown-service",
    severity: (input.severity as Severity) || "sev3",
    status: "new",
    summary: input.summary?.trim() || "Custom incident entered by an operator.",
    started_at: now(),
    resolved_at: null,
    source: "custom",
    is_demo: false,
    scenario_key: null,
    evidence: [{
      id: `custom-${Date.now()}`,
      kind: "log",
      label: "Operator summary",
      detail: input.summary?.trim() || "No additional evidence supplied.",
      origin: "operator",
      observed_at: now(),
    }],
  };
  state.incidents.push(incident);
  persist();
  return incident;
};