# MemoryOps

An incident-response console that turns verified simulated outages into
searchable engineering memory and uses that context in later investigations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/memoryops run dev` — run the MemoryOps console
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Optional env: `HINDSIGHT_BASE_URL`, `HINDSIGHT_API_KEY`, `GROQ_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 with a replaceable MemoryOps persistence adapter
- Persistence: append-safe JSON demo store in `.data/memoryops.json`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/memoryops/src/App.tsx` — console shell and all product pages
- `artifacts/memoryops/src/index.css` — MemoryOps console theme
- `artifacts/api-server/src/memoryops/store.ts` — fixture scenarios and lifecycle
- `artifacts/api-server/src/routes/memoryops.ts` — API surface
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `docs/hindsight-verification.md` — SDK verification and limitations

## Architecture decisions

- Demo data is synthetic and always labeled in the UI.
- Remediation is simulator-only and approval-gated.
- Hindsight is an explicit integration boundary; simulated memory never claims a live call.
- The frontend consumes generated OpenAPI hooks rather than hardcoded API responses.

## Product

The console includes command-center metrics, incident search and creation,
investigation evidence, memory recall, explainable trace, approval-gated
simulated remediation, post-mortem review, retention, a memory explorer, demo
reset, and integration health.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
