import { describe, it, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import {
  decideRemediation,
  findIncident,
  getInvestigation,
  getPostmortem,
  listIncidents,
  loadDemo,
  resetDemo,
  retainPostmortem,
  reviewPostmortem,
  startInvestigation,
  updatePostmortem,
  verifyRemediation,
} from "../memoryops/store";

describe("Phase 3 & 5: Incident Lifecycle, Synthetic Verification, and End-to-End Recall Flow", () => {
  const testStateFile = resolve(".data/test-lifecycle-store.json");
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.HINDSIGHT_BASE_URL;
    delete process.env.HINDSIGHT_API_KEY;
    delete process.env.HINDSIGHT_BANK_ID;
    process.env.MEMORYOPS_STATE_FILE = testStateFile;
    resetDemo();
    loadDemo();
  });

  afterEach(() => {
    process.env = { ...origEnv };
    try {
      rmSync(testStateFile, { force: true });
    } catch {}
  });

  after(() => {
    process.env = { ...origEnv };
  });

  describe("5. Verification with missing execution or failed synthetic outcome", () => {
    it("fails verification if no simulated execution exists", () => {
      const incidents = listIncidents({});
      const incA = incidents.find((i) => i.scenario_key === "payment-outage-a");
      assert.ok(incA);

      assert.throws(() => verifyRemediation(incA.id), {
        message: /No simulated execution exists to verify/,
      });
    });

    it("human approval creates execution but keeps verification null", async () => {
      const incidents = listIncidents({});
      const incA = incidents.find((i) => i.scenario_key === "payment-outage-a");
      assert.ok(incA);

      await startInvestigation(incA.id);
      const afterApproval = decideRemediation(
        incA.id,
        "approved",
        "Operator approved rollback",
      );

      assert.strictEqual(afterApproval.approval?.decision, "approved");
      assert.ok(afterApproval.execution);
      assert.strictEqual(afterApproval.execution.action_type, "rollback");
      assert.strictEqual(afterApproval.execution.simulated, true);

      // CRITICAL: execution does NOT equal verification!
      assert.strictEqual(afterApproval.verification, null);
      const currentInc = findIncident(incA.id);
      assert.strictEqual(currentInc?.status, "remediating");
    });

    it("records failed synthetic verification when action does not resolve fixture", async () => {
      const incidents = listIncidents({});
      const incA = incidents.find((i) => i.scenario_key === "payment-outage-a");
      assert.ok(incA);

      const run = await startInvestigation(incA.id);
      // Simulate an operator choosing "restart" (which scenario defines as passed: false)
      if (run.proposal) {
        run.proposal.action_type = "restart";
      }
      decideRemediation(incA.id, "approved", "Trying restart");

      const verifiedRun = verifyRemediation(incA.id);
      assert.ok(verifiedRun.verification);
      assert.strictEqual(verifiedRun.verification.passed, false);
      assert.strictEqual(verifiedRun.status, "remediation_failed");
      assert.strictEqual(verifiedRun.stage, "remediation_failed");

      const inc = findIncident(incA.id);
      assert.strictEqual(inc?.status, "remediation_failed");
      assert.strictEqual(inc?.resolved_at, null);
    });

    it("prevents retention if incident is not resolved and verified", async () => {
      const incidents = listIncidents({});
      const incA = incidents.find((i) => i.scenario_key === "payment-outage-a");
      assert.ok(incA);

      await startInvestigation(incA.id);
      // Attempt to retain before approval/verification
      await assert.rejects(
        async () => {
          await retainPostmortem(incA.id);
        },
        {
          message:
            /Synthetic execution required before retention|Incident must be resolved before retention|Post-mortem not found/,
        },
      );
    });

    it("prevents retention if incident does not exist", async () => {
      await assert.rejects(
        async () => {
          await retainPostmortem("non-existent-incident-id");
        },
        {
          message: /Incident not found/,
        },
      );
    });

    it("prevents post-mortem review for unverified or unresolved incidents", async () => {
      const incidents = listIncidents({});
      const incA = incidents.find((i) => i.scenario_key === "payment-outage-a");
      assert.ok(incA);

      await startInvestigation(incA.id);
      assert.throws(() => reviewPostmortem(incA.id), {
        message: /Post-mortem not found/,
      });
    });
  });

  describe("6 & 7. Successful verification, review guard, retention, and idempotency", () => {
    it("editing post-mortem preserves draft status and does NOT automatically mark as reviewed", async () => {
      const incidents = listIncidents({});
      const incA = incidents.find((i) => i.scenario_key === "payment-outage-a");
      assert.ok(incA);

      await startInvestigation(incA.id);
      decideRemediation(incA.id, "approved", "Approved rollback");
      verifyRemediation(incA.id);

      const pm = getPostmortem(incA.id);
      assert.ok(pm);
      assert.strictEqual(pm.review_status, "draft");

      // Edit post-mortem content without explicitly marking reviewed
      const updated = updatePostmortem(incA.id, {
        summary: "Updated draft summary by operator",
        lessons_learned: "Updated lessons learned",
      });

      // MUST still be in draft! Editing does not bypass review!
      assert.strictEqual(updated.review_status, "draft");
      const pmAfterEdit = getPostmortem(incA.id);
      assert.strictEqual(pmAfterEdit?.review_status, "draft");

      // PROOF: draft post-mortem cannot be retained!
      await assert.rejects(
        async () => {
          await retainPostmortem(incA.id);
        },
        {
          message: /Post-mortem must be reviewed before retention/,
        },
      );
    });

    it("completes full lifecycle for Incident A: approve -> execute -> verify -> review -> retain", async () => {
      const incidents = listIncidents({});
      const incA = incidents.find((i) => i.scenario_key === "payment-outage-a");
      assert.ok(incA);

      // Step 1: investigate
      const run = await startInvestigation(incA.id);
      assert.strictEqual(run.proposal?.action_type, "rollback");

      // Step 2: approve
      decideRemediation(
        incA.id,
        "approved",
        "Operator approved verified proposal",
      );

      // Step 3: verify synthetic outcome
      const verifiedRun = verifyRemediation(incA.id);
      assert.ok(verifiedRun.verification);
      assert.strictEqual(verifiedRun.verification.passed, true);
      assert.match(
        verifiedRun.verification.observed_state,
        /payment-api 2xx rate restored/,
      );
      assert.ok(verifiedRun.verification.verified_at);

      const incAfterVerify = findIncident(incA.id);
      assert.strictEqual(incAfterVerify?.status, "resolved");
      assert.ok(incAfterVerify?.resolved_at);

      // Postmortem should now be generated in draft status
      const pm = getPostmortem(incA.id);
      assert.ok(pm);
      assert.strictEqual(pm.review_status, "draft");
      assert.strictEqual(pm.retention_status, "not_retained");

      // Step 4: retention is STRICTLY rejected while post-mortem is unreviewed
      await assert.rejects(
        async () => {
          await retainPostmortem(incA.id);
        },
        {
          message: /Post-mortem must be reviewed before retention/,
        },
      );

      // Step 5: human review of post-mortem
      const reviewedPm = reviewPostmortem(incA.id);
      assert.strictEqual(reviewedPm.review_status, "reviewed");

      // Step 6: retain verified and reviewed lesson
      const retainedPm = await retainPostmortem(incA.id);
      assert.strictEqual(retainedPm.retention_status, "retained");
      assert.ok(retainedPm.retained_at);

      // Step 7: repeated calls are idempotent
      const verifyAgain = verifyRemediation(incA.id);
      assert.strictEqual(verifyAgain.verification?.passed, true);

      const retainAgain = await retainPostmortem(incA.id);
      assert.strictEqual(retainAgain.retention_status, "retained");
    });
  });

  describe("8. Incident B calling recall and consuming Incident A lesson", () => {
    it("Incident B investigation recalls lesson from Incident A and deprioritizes restart", async () => {
      // 1. Resolve, verify, review, and retain Incident A
      const incidents = listIncidents({});
      const incA = incidents.find((i) => i.scenario_key === "payment-outage-a");
      assert.ok(incA);

      await startInvestigation(incA.id);
      decideRemediation(
        incA.id,
        "approved",
        "Approved rollback for Incident A",
      );
      verifyRemediation(incA.id);
      reviewPostmortem(incA.id);
      await retainPostmortem(incA.id);

      // 2. Open Incident B (payment-outage-b on payment-api)
      const incB = incidents.find((i) => i.scenario_key === "payment-outage-b");
      assert.ok(incB);

      // 3. Investigate Incident B
      const runB = await startInvestigation(incB.id);

      // 4. Verify memories were recalled from configured bank / store
      assert.ok(
        runB.memories.length > 0,
        "Incident B should have recalled memories for payment-api",
      );
      assert.match(
        runB.memories[0]?.content as string,
        /Incident INC-2025-0117/,
      );

      // 5. Verify recalled lesson influenced reasoning
      assert.match(
        runB.hypotheses[0]?.influence as string,
        /restart previously failed to hold|Hindsight supplies historical context/,
      );

      // 6. Verify proposal cites historical lesson and carries forward restraint
      assert.match(
        runB.proposal?.historical_note as string,
        /restart failed on a related payment incident/,
      );

      // 7. Complete Incident B lifecycle
      decideRemediation(
        incB.id,
        "approved",
        "Approved rollback for provider SDK",
      );
      const verifiedRunB = verifyRemediation(incB.id);
      assert.strictEqual(verifiedRunB.verification?.passed, true);
      const incBResolved = findIncident(incB.id);
      assert.strictEqual(incBResolved?.status, "resolved");
    });
  });
});
