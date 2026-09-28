---
name: Demo safety boundaries
description: Safety rules for the MemoryOps synthetic incident workflow and destructive demo controls.
---

Demo reset is intentionally destructive to simulated application state only and
must require an explicit confirmation flag. Fixture loading is idempotent so
repeatable walkthroughs never create duplicate scenarios or memories.

**Why:** The product is designed for safe incident-response demonstrations and
must never imply that a reset or remediation touched live infrastructure.

**How to apply:** Preserve the confirmation gate, the synthetic-state wording,
and idempotent scenario keys whenever demo controls or persistence are changed.