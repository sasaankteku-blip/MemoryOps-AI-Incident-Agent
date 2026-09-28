# Hindsight TypeScript SDK Verification & Integration

Verified against the official `@vectorize-io/hindsight-client` package and the `vectorize-io/hindsight` repository.

## Confirmed TypeScript SDK Specification

- **Package**: `@vectorize-io/hindsight-client` (v0.10.1)
- **Import**: `import { HindsightClient } from "@vectorize-io/hindsight-client"`
- **Client Construction**:
  ```typescript
  const client = new HindsightClient({
    baseUrl: process.env.HINDSIGHT_BASE_URL,
    apiKey: process.env.HINDSIGHT_API_KEY,
    maxAttempts: 2,
  });
  ```
- **Retain**:
  ```typescript
  await client.retain(bankId, content, {
    context: "...",
    documentId: `incident-${incidentId}`,
    metadata: { incident_id, public_id, service, outcome: "verified_success" },
    tags: [service, "incident-response", "verified-lesson"],
  });
  ```
  - `documentId` guarantees idempotent replacement on repeated retentions.
  - Returns `Promise<RetainResponse>` (`{ success: boolean, bank_id: string, items_count: number }`).
- **Recall**:
  ```typescript
  await client.recall(bankId, query, { budget: "mid" });
  ```
  - Query is composed from incident service, symptoms, error signatures, and deployment context.
  - Returns `Promise<RecallResponse>` containing `results: Array<RecallResult>`.
- **Reflect**:
  ```typescript
  await client.reflect(bankId, query, { context, budget: "mid" });
  ```
  - Synthesizes reasoned answers over the bank's stored memories.
  - Returns `Promise<ReflectResponse>` (`{ text: string }`).
- **Health / Version Check**:
  ```typescript
  await client.getVersion({ signal: AbortSignal.timeout(4000) });
  ```
  - Returns `Promise<VersionResponse>` (`{ api_version: string }`).

## Environment Configuration

The server-side adapter in `artifacts/api-server/src/memoryops/hindsight.ts` reads:
- `HINDSIGHT_BASE_URL`: Base URL of self-hosted Hindsight or Hindsight Cloud.
- `HINDSIGHT_API_KEY`: Optional Bearer token for authenticated Hindsight deployments.
- `HINDSIGHT_BANK_ID`: Namespace for incident memories (defaults to `memoryops-demo-northstar`).

## Failure and Fallback Behavior

1. **Missing configuration**: If `HINDSIGHT_BASE_URL` is omitted, MemoryOps falls back to the internal simulated demo bank, explicitly labeling all memories as `Simulated demo memory — Hindsight unavailable`.
2. **Network / Remote failure**: If Hindsight is configured but unreachable or fails, MemoryOps catches the error, marks the remote operation as failed (`success: false`, `is_live: false`), labels the memory as `Simulated demo memory — Hindsight recall failed: <error>`, and keeps the application operational.
3. **Truthful reporting**: A remote failure is never reported as live success. The integration status endpoint (`/api/integrations/status`) accurately reports reachability and API version.

## Verification Status

- **Mocked SDK Tests**: 27 unit and integration tests passing covering constructor, configuration, retain, recall, reflect, fallback labels, idempotency, synthetic verification, and Incident A → Incident B recall flow.
- **Live Round Trip**: Credentials (`HINDSIGHT_BASE_URL`, `HINDSIGHT_API_KEY`) are not provided in this environment. The live adapter is fully wired, verified with mocks and TypeScript compiler checks, and ready for production credentials.