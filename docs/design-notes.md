# MemoryOps design notes

## Product boundary

MemoryOps is a single-persona incident-response console for SRE and platform
engineers. It demonstrates one loop: collect evidence, recall prior
experience, investigate, request approval, simulate remediation, verify, and
retain the reviewed lesson.

Monitoring data is synthetic Northstar Commerce fixture data. Remediation is
always simulated. No shell, deployment, cloud, monitoring, Jira, Slack, or
GitHub operation is performed.

## State machine

```text
new -> investigating
investigating -> awaiting_approval | investigation_failed | unresolved
awaiting_approval -> remediating (approve) | investigating (reject) | unresolved
remediating -> verifying | remediation_failed
verifying -> resolved (pass) | awaiting_approval (fail)
resolved -> terminal
unresolved -> investigating
```

The API keeps decisions idempotent by proposal ID. The UI never makes
remediation look live.

## Persistence boundary

The current starter uses an append-safe JSON state file for the demo so the
single preview service stays runnable without provisioning a database. The
store mirrors the requested domain records: incidents, evidence, runs,
memories, post-mortems, and integration operation summaries. It is deliberately
replaceable with the SQLite/SQLAlchemy persistence layer in the production
hardening pass.

## API summary

- Dashboard and incidents: `/api/dashboard`, `/api/incidents`
- Investigation lifecycle: `/api/incidents/:id/investigate`,
  `/investigation`, approval, rejection, verification, and memory trace
- Learning loop: post-mortem edit/retain and `/api/memories`
- Demo safety: `/api/demo/load` and confirmed `/api/demo/reset`
- Honest dependency state: `/api/integrations/status`