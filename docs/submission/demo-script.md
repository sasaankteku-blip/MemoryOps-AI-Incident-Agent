# MemoryOps — 3–5 Minute Demonstration Video Script

> **Recording Notes for Presenter**:
> - **Total Target Duration**: ~4 minutes (comfortable pace).
> - **Pacing**: Speak deliberately. Give UI animations and status badges 1–2 seconds of visual hold time before clicking.
> - **Environment**: Browser window at 1920x1080 resolution, dark mode enabled, developer console closed unless verifying network calls.
> - **Mode Distinction**: If demonstrating with live credentials configured, highlight `"connected real hindsight"` and `"Live Hindsight bank"`. If demonstrating in local fallback mode, highlight the honesty of `"simulated fallback"` and `"Simulated demo memory — Hindsight unavailable"`.

---

## Act 1: The Engineering Incident Problem (0:00 – 0:45)

**[Visual: Title screen / MemoryOps Command Center overview `http://localhost:5173/`]**

**Audio / Voiceover**:
> "Every engineering team faces the same painful reality during critical production outages: high stress, fragmented alerts, and repeat mistakes.
>
> When an alert fires at 3 AM, an on-call engineer often tries an intuitive action—like restarting a pod or bouncing a service—without knowing that three months ago, another engineer discovered that restarting that exact service failed to hold and made the outage worse.
>
> Post-mortems are written, filed into wiki graveyards, and never seen again.
>
> Welcome to **MemoryOps** — an AI-powered Incident Response and Engineering Memory Agent. MemoryOps closes this learning loop: it grounds investigation in immutable telemetry, enforces strict human approval gates, verifies outcomes synthetically, and turns reviewed lessons into searchable institutional memory using **Vectorize Hindsight**."

---

## Act 2: Architecture & Honest Boundaries (0:45 – 1:15)

**[Visual: Navigate to Settings page `/settings`]**

**Audio / Voiceover**:
> "Before touching any incident, let's look at the operational boundaries in our Settings view.
>
> In MemoryOps, safety and truthfulness are first-class engineering principles:
> 1. Telemetry and metrics model our Northstar Commerce environment using synthetic, immutable fixtures.
> 2. Remediation actions are simulated—MemoryOps never connects to production infrastructure or executes arbitrary shell scripts.
> 3. Notice our **Integration Health**: MemoryOps truthfully reports whether our **Vectorize Hindsight** memory engine is connected to a live remote bank or operating in explicit simulated fallback. It never disguises a failure as a live success."

---

## Act 3: Incident A — The First Failure & Verified Resolution (1:15 – 2:30)

**[Visual: Navigate to Incidents `/incidents`. Select `INC-2025-0117` ("Payment pool exhaustion on payment-api"). Click "Investigate".]**

**Audio / Voiceover**:
> "Let's open Incident A: `INC-2025-0117`. Checkout payment error rates have spiked to 38%, with HTTP 503s flooding `payment-api`.
>
> When we click **Investigate**, MemoryOps queries Hindsight with the service, symptoms, error signatures, and deployment context. Because this is the first time this issue has occurred, Hindsight confirms: *no relevant prior experience found*.
>
> The agent analyzes the evidence: recent deployment `d-4821` reduced `DB_POOL_MAX` to 10, starving database connections. The agent recommends: **Rollback deployment d-4821**.
>
> Notice the strict **Human-in-the-Loop Gate**: the agent cannot remediate autonomously. An operator must review the blast radius and explicitly click **Approve remediation**."

**[Visual: Click "Approve remediation". Show execution state. Then click "Run verification".]**

**Voiceover**:
> "Remediation execution is simulated. But in MemoryOps, **execution is not verification**.
>
> We now click **Run verification**. The synthetic verification engine inspects post-remediation metrics: error rates drop below 0.1%, latency normalizes, and the check passes. Only now is the incident marked **Resolved**."

---

## Act 4: The Post-Mortem Human Review Gate & Retention (2:30 – 3:15)

**[Visual: Navigate to Post-mortems `/postmortems`. Select Incident A.]**

**Voiceover**:
> "Now comes the step that separates MemoryOps from typical AI prototypes: the **Post-Mortem Review Gate**.
>
> Upon resolution, an automated post-mortem draft is generated. Notice the amber badge: `Review status: draft (review required)`. Notice also that the **Retain in memory** button is strictly locked.
>
> If an operator edits the root cause or lessons learned and clicks **Save draft**, the draft updates, but it remains in `draft` status.
>
> MemoryOps enforces six strict preconditions before retention: the incident must exist, execution must have occurred, synthetic verification must have passed, the incident must be resolved, the post-mortem must exist, and an operator must explicitly approve it.
>
> Let's click **Approve & Mark Reviewed**. The badge transitions to emerald `reviewed`. Now, we click **Retain in memory**."

**[Visual: Click "Approve & Mark Reviewed", then click "Retain in memory". Show success banner.]**

**Voiceover**:
> "The verified lesson—that restarting payment-api failed to hold and only rollback restored connection capacity—is retained into our Hindsight memory bank."

---

## Act 5: Incident B — Institutional Memory in Action (3:15 – 4:15)

**[Visual: Navigate to Incidents `/incidents`. Select `INC-2025-0164` ("Payment gateway timeout surge"). Click "Investigate".]**

**Voiceover**:
> "Weeks later, Incident B occurs: `INC-2025-0164`. Once again, `payment-api` experiences elevated connections and HTTP 503 errors, but this time after a third-party SDK update.
>
> We click **Investigate**.
>
> Look at the **Hindsight** tab and the **Hypotheses** panel:
>
> MemoryOps automatically recalled the verified post-mortem from Incident A!
>
> Under the historical note, the agent explains: *'Restart previously failed to hold on a related payment incident; restart is intentionally deprioritized in favor of rollback.'*
>
> Instead of repeating the past mistake and rebooting the containers, the team immediately rolls back the SDK change and resolves the outage in minutes."

---

## Act 6: Wrap-up & Memory Explorer (4:15 – 4:45)

**[Visual: Navigate to Memory Explorer `/memories`. Type a query into "Ask Hindsight to reflect" and show the synthesized answer.]**

**Voiceover**:
> "In the **Memory Explorer**, operators can search institutional knowledge or ask Hindsight to **reflect** across recurring outage patterns.
>
> MemoryOps brings true institutional memory to SRE:
> - Grounded in immutable telemetry
> - Protected by strict human approval and review gates
> - Verified with 35 passing tests and production builds
> - Powered by Vectorize Hindsight
>
> Thank you!"
