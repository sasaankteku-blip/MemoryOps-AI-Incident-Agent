# MemoryOps — Final Submission Checklist & Deliverables Tracker

Use this checklist to track the final recording, publishing, and submission assets before the event deadline.

---

## 1. Submission URLs & Assets Tracker

| Asset | Target Link / Value | Status |
|---|---|:---:|
| **Public GitHub Repository** | `https://github.com/sasaankteku-blip/MemoryOps-AI-Incident-Agent` | Ready |
| **Live Deployed Application** | `[Insert Deployment URL, e.g. Replit / Vercel / Cloud Run]` | *Pending User Deploy* |
| **Demonstration Video** | `[Insert Loom / YouTube / Vimeo Video URL]` | *Pending User Recording* |
| **Written Article / Write-up** | `[Insert Devpost / Medium / Blog Post URL]` | *Pending User Publishing* |
| **Social Media Announcement** | `[Insert X / LinkedIn Post URL]` | *Pending User Publishing* |

---

## 2. Pre-Recording & Local Validation Checklist

Before recording the demonstration video:

- [ ] **Run all automated tests**:
  ```bash
  pnpm test
  ```
  *Expected result: 35 passing tests across 12 suites, 0 failures.*
- [ ] **Run full TypeScript typecheck**:
  ```bash
  pnpm run typecheck
  ```
  *Expected result: 0 errors across api-server, memoryops, mockup-sandbox, and scripts.*
- [ ] **Verify production build**:
  ```bash
  pnpm run build
  ```
  *Expected result: Successful build in `artifacts/api-server/dist` and `artifacts/memoryops/dist/public`.*
- [ ] **Verify Git cleanliness**:
  ```bash
  git diff --check
  ```
  *Expected result: 0 whitespace errors or conflict markers.*
- [ ] **Verify Secret Protection**:
  Confirm that `.env` is NOT tracked in `git status`. Only `.env.example` should be tracked.

---

## 3. Live Hindsight Setup (If Demonstrating with Real Service)

If you have live Vectorize Hindsight credentials for the video recording:

- [ ] Create `.env` in the project root:
  ```env
  HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
  HINDSIGHT_API_KEY=your_actual_api_key
  HINDSIGHT_BANK_ID=memoryops-demo-northstar
  ```
- [ ] Run the live verification runner:
  ```bash
  pnpm --filter @workspace/api-server run verify-hindsight
  ```
  *Confirm that remote health check, marker retain, marker recall, and reflect succeed.*
- [ ] In `/settings`, confirm that Integration Health displays:
  `connected real hindsight · Connected to Hindsight API v0.10.1 (bank: memoryops-demo-northstar)`.

*(If credentials are not available, record using the transparent `simulated fallback` mode as outlined in `demo-shot-list.md`.)*

---

## 4. Video Recording Checklist

- [ ] Screen resolution set to 1920x1080 (16:9).
- [ ] Browser bookmarks bar hidden, tabs closed, browser zoom at 100%.
- [ ] Reset demo state before starting:
  - In UI: navigate to Command Center and click **Reset to starter**.
  - Or via API: `POST /api/demo/reset`.
- [ ] Follow `demo-script.md` and `demo-shot-list.md`:
  - [ ] Show problem statement & command center overview.
  - [ ] Show `/settings` honest boundary indicators.
  - [ ] Open Incident A (`INC-2025-0117`), investigate, approve remediation.
  - [ ] Run synthetic verification $\rightarrow$ incident resolved.
  - [ ] Show Post-Mortem in `draft` status (proves save draft keeps draft; approve mark reviewed unlocks retention).
  - [ ] Retain Incident A lesson into Hindsight.
  - [ ] Open Incident B (`INC-2025-0164`), investigate.
  - [ ] **Show the payoff**: Incident B recalls Incident A and intentionally deprioritizes restart!
  - [ ] Show Memory Explorer and Hindsight reflect synthesis.
- [ ] Video duration is between 3 and 5 minutes.
- [ ] Video uploaded with public or unlisted access.

---

## 5. Article & Submission Form Checklist

- [ ] Review `docs/submission/article-draft.md`.
- [ ] Copy and adapt into hackathon submission form (e.g., Devpost "Story / Overview").
- [ ] Ensure all claims are accurate (no fabricated metrics, 35 passing tests, honest boundaries).
- [ ] Check format requirements:
  - *Video length limit*: Confirm whether hackathon requires $\le$ 3 minutes or $\le$ 5 minutes. (Adjust script pacing accordingly).
  - *Public repo requirement*: Confirm repo is set to Public on GitHub.
  - *Track tag*: Tag with relevant track (e.g., AI Agents, Vectorize Hindsight, SRE / Infrastructure).

---

## 6. Post-Submission Actions

- [ ] Publish announcement post using `docs/submission/social-post-draft.md` on X / LinkedIn.
- [ ] Paste social post link into submission form if required.
- [ ] Retain backup copy of video recording and submission text.
