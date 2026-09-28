# MemoryOps — Video Recording Shot List & Capture Plan

This shot list details the exact sequence of screens, camera framings, user interactions, and visual proofs required to record a compelling 3–5 minute submission video.

---

## Technical Recording Setup

- **Display Resolution**: 1920x1080 (1080p, 16:9 ratio) at 60 FPS.
- **Browser**: Chrome / Brave / Edge in Clean Profile (no extraneous extensions, bookmarks bar hidden).
- **Console URLs**:
  - Frontend: `http://localhost:5173/`
  - Health endpoint: `http://localhost:3000/api/healthz`
  - Integration endpoint: `http://localhost:3000/api/integrations/status`
- **Audio**: Dedicated microphone with crisp vocal track, no background music or quiet ambient track only.

---

## Detailed Shot Sequence

| Shot # | Timestamp | Page / Route | Visual Focus / Action | Evidence & Proof to Capture |
|:---:|:---:|:---|:---|:---|
| **01** | `0:00 - 0:25` | `/dashboard` | Wide shot of the Command Center dashboard. Show summary cards (Active incidents, Mean time to detect, Total memories retained). | Sleek dark UI, modern telemetry metrics, live status badge. |
| **02** | `0:25 - 0:50` | `/settings` | Navigate to Settings. Focus on **API health** and **Integration health** cards. | Show truthful status: If live Hindsight is connected, highlight emerald badge `connected real hindsight` (v0.10.1). If in fallback mode, highlight honest amber badge `simulated fallback`. |
| **03** | `0:50 - 1:25` | `/incidents` | Select incident **INC-2025-0117** (`payment-api` pool exhaustion). Open the detail drawer. | 38% error burst, 503 error logs, DB connection saturation telemetry. |
| **04** | `1:25 - 1:55` | `/incidents/INC-2025-0117` | Click **Investigate**. Show investigation workflow stepper completing. Switch to **Hindsight** tab. | Show that initial recall returned *no prior experience* (clean bank). Show proposal: "Rollback d-4821". |
| **05** | `1:55 - 2:20` | Incident Modal | Highlight the **Human Approval Gate**. Click **Approve remediation**. Show execution state. | Explicit visual cue: "Execution status: simulated_success; Verification: Pending". Proof that execution $\neq$ resolution. |
| **06** | `2:20 - 2:45` | Incident Modal | Click **Run verification**. Watch synthetic verification check pass. | Verification badge turns green (`passed: true`), observed state confirms 2xx rate restored, status transitions to `resolved`. |
| **07** | `2:45 - 3:15` | `/postmortems` | Navigate to Post-mortems. Select INC-2025-0117. Point out amber badge `Review status: draft (review required)`. | Highlight disabled "Retain in memory" button with warning tooltip. Click **Save draft** (proves draft stays draft). Then click **Approve & Mark Reviewed** (badge turns green). |
| **08** | `3:15 - 3:35` | `/postmortems` | Click **Retain in memory**. | Success notification displays: "Post-mortem retained in memory bank". Retention status updates to `retained`. |
| **09** | `3:35 - 4:15` | `/incidents` | Open second incident **INC-2025-0164** (Payment gateway timeout surge). Click **Investigate**. Switch to **Hindsight** tab. | **CRITICAL CLIMAX**: Show recalled memory from Incident A (`INC-2025-0117`). In Hypotheses and Proposal, show: *"Restart previously failed to hold... restart intentionally deprioritized in favor of rollback"*. |
| **10** | `4:15 - 4:45` | `/memories` | Navigate to Memory Explorer. Search `payment-api`. Enter prompt in **Ask Hindsight to reflect**: *"What patterns recur across checkout incidents?"*. Click **Reflect**. | Displays synthesized opinion over the bank's stored memories. Final closing logo/title card. |

---

## Contingency Recording Plan: Live vs. Fallback

### Scenario A: Recording with Live Hindsight Credentials
1. Ensure `.env` contains valid `HINDSIGHT_BASE_URL` and `HINDSIGHT_API_KEY`.
2. Verify connectivity beforehand:
   ```bash
   pnpm --filter @workspace/api-server run verify-hindsight
   ```
3. In Shot 02 (`/settings`), point the camera directly at the emerald badge:
   `connected real hindsight · Connected to Hindsight API v0.10.1 (bank: memoryops-demo-northstar)`.
4. In Shot 09, show the memory source pill: `Live Hindsight bank (memoryops-demo-northstar)`.

### Scenario B: Recording in Fallback Mode (No Live Credentials)
1. If live credentials are not available at recording time, **do not attempt to fake live connectivity**.
2. In Shot 02 (`/settings`), highlight the honest transparency of the console:
   `simulated fallback · HINDSIGHT_BASE_URL is not configured — simulated fallback active`.
3. Frame this as a deliberate architectural strength:
   *"MemoryOps is built with honest telemetry boundaries—it never reports simulated memory as live Hindsight data, ensuring operators always know the exact provenance of institutional knowledge."*
4. Run the full lifecycle identically—the local memory bank faithfully demonstrates the learning loop from Incident A to Incident B.
