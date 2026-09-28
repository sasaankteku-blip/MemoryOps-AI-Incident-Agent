# Hindsight verification

Checked on 2026-09-28 against the official Hindsight docs and the
`vectorize-io/hindsight` repository.

## Confirmed

- Python package: `hindsight-client`
- Import: `from hindsight_client import Hindsight`
- Client construction: `Hindsight(base_url="...", timeout=30.0, api_key="...")`
- Synchronous calls are documented as:
  - `client.retain(bank_id="...", content="...")`
  - `client.recall(bank_id="...", query="...")`
  - `client.reflect(bank_id="...", query="...")`
- Async variants are exposed with an `a` prefix, such as `arecall` and
  `areflect`, so an async FastAPI adapter can use them without blocking.
- Hindsight Cloud uses a base URL plus an optional bearer API key passed to the
  client. The exact Cloud URL and account setup are environment-specific.
- Recall returns a response containing source chunks. Reflect returns an
  object with generated text and cited memories in the current docs.
- Groq’s current Python SDK exposes `client.models.list()` and the
  OpenAI-compatible chat completions API. Structured output uses
  `response_format` with `json_schema` on supported models; JSON prompting and
  validation remain the fallback.
- LangGraph’s current Python API uses `StateGraph`, `add_node`, `add_edge`,
  `set_entry_point`, and `compile()`.

## Not verified in this environment

- No Hindsight or Groq credentials are present, so a live round trip was not
  attempted.
- The exact Cloud bank-creation/configuration endpoint and optional document
  metadata/upsert parameters should be checked against the installed SDK
  version before enabling live retention.
- The installed Python SDK was not added to this Node-based starter project.

MemoryOps therefore keeps live adapters isolated behind the integration-status
surface. The runnable demo uses synthetic fixture data and labels it as
simulated; it does not claim that simulated recall or retention is a Hindsight
call.