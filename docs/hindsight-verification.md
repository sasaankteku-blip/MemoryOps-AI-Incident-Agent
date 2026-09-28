# Hindsight TypeScript SDK Verification & Integration

Verified against the official `@vectorize-io/hindsight-client` package (v0.10.1) and the `vectorize-io/hindsight` API specification.

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
    context: `Verified post-mortem for incident ${publicId} (${service})`,
    documentId: `incident-${incidentId}`,
    metadata: { incident_id, public_id, service, verified: "true", outcome: "verified_success" },
    tags: [service, "incident-response", "verified-lesson"],
    updateMode: "replace",
    signal: AbortSignal.timeout(8000),
  });
  ```
   - Gated strictly by all 6 retention preconditions:
     1. Incident exists in store.
     2. Synthetic execution exists (`incident.synthetic_execution`).
     3. Synthetic verification passed (`incident.synthetic_verification.passed === true`).
     4. Incident is in resolved state (`status === "resolved"`).
     5. Post-mortem exists.
     6. Post-mortem review status is explicitly `"reviewed"`.
   - Editing post-mortem content saves drafts and preserves `draft` status; human review must be explicitly invoked via `POST /api/incidents/:id/postmortem/review`.
   - Returns `Promise<RetainResponse>` (`{ success: boolean, bank_id: string, items_count: number }`).
- **Recall**:
  ```typescript
  await client.recall(bankId, query, {
    budget: "mid",
    signal: AbortSignal.timeout(8000),
  });
  ```
  - Query is dynamically assembled from incident service, symptoms, error signatures, and deployment context.
  - Returns `Promise<RecallResponse>` containing `results: Array<RecallResult>`.
- **Reflect**:
  ```typescript
  await client.reflect(bankId, query, {
    context,
    budget: "mid",
    signal: AbortSignal.timeout(10000),
  });
  ```
  - Synthesizes reasoned answers over the bank's stored memories across related incidents.
  - Returns `Promise<ReflectResponse>` (`{ text: string }`).
- **Health / Connectivity Check**:
  ```typescript
  await client.getVersion({ signal: AbortSignal.timeout(4000) });
  ```
  - Calls `GET /version` to verify reachability and live connectivity before reporting healthy.
  - Returns `Promise<VersionResponse>` (`{ api_version: string }`).

## Environment Configuration

The server-side adapter in `artifacts/api-server/src/memoryops/hindsight.ts` reads:
- `HINDSIGHT_BASE_URL`: Base URL of self-hosted Hindsight or Hindsight Cloud (must use `http://` or `https://`).
- `HINDSIGHT_API_KEY`: Optional Bearer token for authenticated Hindsight deployments.
- `HINDSIGHT_BANK_ID`: Namespace for incident memories (defaults to `memoryops-demo-northstar`).

## Failure and Fallback Behavior

1. **Not Configured**: When `HINDSIGHT_BASE_URL` is omitted, MemoryOps operates in explicit simulated fallback mode. All memories are labeled `Simulated demo memory — Hindsight unavailable`.
2. **Malformed Configuration**: If `HINDSIGHT_BASE_URL` is set to an invalid URL or non-HTTP protocol, `validateHindsightConfig()` detects it safely without throwing unhandled exceptions, and `/api/integrations/status` reports a configuration error.
3. **Remote Service Error**: If Hindsight is configured but unreachable or fails during network execution, MemoryOps catches the error, marks the remote operation as failed (`success: false`, `is_live: false`), labels the memory as `Simulated demo memory — Hindsight recall failed: <error>`, and keeps the application operational.
4. **Truthful Status Reporting**: A remote operation failure is **never** converted into a live success. The integration status endpoint (`/api/integrations/status`) accurately reports whether Hindsight is `connected real hindsight`, `simulated fallback`, `not configured`, or `remote service error`.

## Incident Learning Loop

```
Incident A (INC-2025-0117 on payment-api)
  → Investigate (gather logs, metrics, deployment changes)
  → Recall Hindsight (empty initial bank)
  → Propose remediation (Rollback d-4821)
  → Require human approval
  → Execute synthetic remediation (pool exhausted on restart, restored on rollback)
  → Verify synthetic outcome (metrics check against postRemediation fixture)
  → Generate post-mortem (draft status)
  → Operator review & approval (review_status = "reviewed")
  → Retain verified lesson in Hindsight bank
Incident B (INC-2025-0164 on payment-api)
  → Investigate (payment-api 503 & connection pressure)
  → Recall Hindsight (retrieves Incident A lesson from same bank)
  → Proposal deprioritizes restart and applies verified rollback strategy
```

## How to Run Live Integration Tests

When live Hindsight credentials are ready:

1. Set the environment variables in `.env` (or in your shell session):
   ```bash
   HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
   HINDSIGHT_API_KEY=your-hindsight-api-key
   HINDSIGHT_BANK_ID=memoryops-demo-northstar
   ```
2. Run the dedicated live verification script:
   ```bash
   pnpm --filter @workspace/api-server run verify-hindsight
   ```
   This script performs a real health check (`getVersion`), safe live `retain` with a unique marker, safe live `recall` verifying the marker, live `reflect`, and the Incident A $\rightarrow$ Incident B learning flow against the real bank.

3. Run automated tests with live network enabled:
   ```bash
   pnpm test
   ```

## Current Test Suite Status

- **Automated Tests**: 35 tests passing across 12 test suites in `artifacts/api-server/src/__tests__/`.
- **Type Checking**: Clean (`pnpm run typecheck` passes across all workspace packages with 0 errors).
- **Live Integration**: Live credentials (`HINDSIGHT_BASE_URL`, `HINDSIGHT_API_KEY`) are not present in this local environment. All unit, contract, and lifecycle tests run against verified mocks and fallbacks. The adapter and `verify-hindsight` runner are fully implemented and ready for live execution.