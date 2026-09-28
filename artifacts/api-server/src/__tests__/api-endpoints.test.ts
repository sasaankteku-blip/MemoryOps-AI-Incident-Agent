import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import type { Server } from "node:http";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import app from "../app";
import { resetDemo, loadDemo } from "../memoryops/store";

describe("Phase 4 & 5: HTTP Endpoints, Router Mount, Health, and Core API", () => {
  let server: Server;
  let baseUrl: string;
  const testStateFile = resolve(".data/test-api-store.json");

  before(async () => {
    process.env.MEMORYOPS_STATE_FILE = testStateFile;
    resetDemo();
    loadDemo();
    await new Promise<void>((res) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        res();
      });
    });
  });

  after(async () => {
    await new Promise<void>((res) => server.close(() => res()));
    try {
      rmSync(testStateFile, { force: true });
    } catch {}
  });

  describe("9. Correct health endpoint", () => {
    it("returns 200 on /api/healthz with valid health payload", async () => {
      const res = await fetch(`${baseUrl}/api/healthz`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.deepStrictEqual(body, {
        status: "ok",
        version: "0.1.0",
        db: "ok",
      });
    });

    it("returns 404 for unmatched top-level routes", async () => {
      const res = await fetch(`${baseUrl}/healthz`);
      assert.strictEqual(res.status, 404);
    });
  });

  describe("10. Fixture loading, dashboard, incidents, and lifecycle via HTTP", () => {
    it("GET /api/dashboard returns metrics and service status", async () => {
      const res = await fetch(`${baseUrl}/api/dashboard`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(typeof body.active_incidents === "number");
      assert.ok(Array.isArray(body.services));
      assert.ok(Array.isArray(body.recent_incidents));
    });

    it("GET /api/incidents returns loaded fixture summaries", async () => {
      const res = await fetch(`${baseUrl}/api/incidents`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body));
      assert.ok(body.length >= 5);
      const incA = body.find(
        (i: { scenario_key?: string }) => i.scenario_key === "payment-outage-a",
      );
      assert.ok(incA);
      assert.strictEqual(incA.service, "payment-api");
    });

    it("POST /api/incidents creates a custom incident safely", async () => {
      const res = await fetch(`${baseUrl}/api/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Custom checkout degradation",
          service: "checkout-service",
          severity: "sev2",
          summary: "Checkout queue depth elevated after DB maintenance",
        }),
      });
      assert.strictEqual(res.status, 201);
      const created = await res.json();
      assert.match(created.public_id, /^INC-CUSTOM-/);
      assert.strictEqual(created.service, "checkout-service");
    });

    it("GET /api/demo/scenarios lists available scenarios with loaded state", async () => {
      const res = await fetch(`${baseUrl}/api/demo/scenarios`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body));
      assert.ok(
        body.some((s: { key: string }) => s.key === "payment-outage-a"),
      );
    });

    it("POST /api/demo/load is idempotent and does not create duplicate fixtures", async () => {
      const res = await fetch(`${baseUrl}/api/demo/load`, { method: "POST" });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.incidents >= 5);

      // Verify no duplicate keys exist
      const incListRes = await fetch(`${baseUrl}/api/incidents`);
      const allIncidents = await incListRes.json();
      const keys = allIncidents
        .map((i: { scenario_key?: string }) => i.scenario_key)
        .filter(Boolean);
      const uniqueKeys = new Set(keys);
      assert.strictEqual(keys.length, uniqueKeys.size);
    });

    it("GET /api/integrations/status reports truthful integration status", async () => {
      const res = await fetch(`${baseUrl}/api/integrations/status`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body));
      const hindsight = body.find(
        (i: { name: string }) => i.name === "Hindsight",
      );
      assert.ok(hindsight);
      assert.strictEqual(hindsight.configured, false);
      assert.strictEqual(hindsight.reachable, false);
      assert.match(hindsight.detail, /not configured/i);
    });

    it("runs complete lifecycle via HTTP API: investigate -> approve -> verify -> retain", async () => {
      // Find payment outage A
      const listRes = await fetch(`${baseUrl}/api/incidents`);
      const incidents = await listRes.json();
      const incA = incidents.find(
        (i: { scenario_key?: string }) => i.scenario_key === "payment-outage-a",
      );
      assert.ok(incA);

      // 1. Start investigation
      const invRes = await fetch(
        `${baseUrl}/api/incidents/${incA.id}/investigate`,
        { method: "POST" },
      );
      assert.strictEqual(invRes.status, 202);

      // 2. Fetch investigation
      const getInvRes = await fetch(
        `${baseUrl}/api/incidents/${incA.id}/investigation`,
      );
      const inv = await getInvRes.json();
      assert.strictEqual(inv.status, "awaiting_approval");
      assert.strictEqual(inv.proposal.action_type, "rollback");

      // 3. Verify before execution returns 409
      const earlyVerify = await fetch(
        `${baseUrl}/api/incidents/${incA.id}/verify`,
        { method: "POST" },
      );
      assert.strictEqual(earlyVerify.status, 409);

      // 4. Approve
      const approveRes = await fetch(
        `${baseUrl}/api/incidents/${incA.id}/approve-remediation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Approved simulated rollback" }),
        },
      );
      assert.strictEqual(approveRes.status, 200);
      const approvedInv = await approveRes.json();
      assert.ok(approvedInv.execution);
      assert.strictEqual(approvedInv.verification, null);

      // 5. Verify
      const verifyRes = await fetch(
        `${baseUrl}/api/incidents/${incA.id}/verify`,
        { method: "POST" },
      );
      assert.strictEqual(verifyRes.status, 200);
      const verifiedInv = await verifyRes.json();
      assert.strictEqual(verifiedInv.verification.passed, true);
      assert.strictEqual(verifiedInv.status, "completed");

      // 6. Retain postmortem before review is REJECTED with 409
      const unreviewedRetainRes = await fetch(
        `${baseUrl}/api/incidents/${incA.id}/postmortem/retain`,
        { method: "POST" },
      );
      assert.strictEqual(unreviewedRetainRes.status, 409);
      const unreviewedErr = await unreviewedRetainRes.json();
      assert.match(
        unreviewedErr.error.message,
        /Post-mortem must be reviewed before retention/,
      );

      // 7. Review postmortem via review endpoint
      const reviewRes = await fetch(
        `${baseUrl}/api/incidents/${incA.id}/postmortem/review`,
        { method: "POST" },
      );
      assert.strictEqual(reviewRes.status, 200);
      const reviewedPm = await reviewRes.json();
      assert.strictEqual(reviewedPm.review_status, "reviewed");

      // 8. Retain reviewed postmortem succeeds
      const retainRes = await fetch(
        `${baseUrl}/api/incidents/${incA.id}/postmortem/retain`,
        { method: "POST" },
      );
      assert.strictEqual(retainRes.status, 200);
      const retainedPm = await retainRes.json();
      assert.strictEqual(retainedPm.retention_status, "retained");

      // 7. Verify memory is retrievable via GET /api/memories
      const memRes = await fetch(`${baseUrl}/api/memories?service=payment-api`);
      assert.strictEqual(memRes.status, 200);
      const memories = await memRes.json();
      assert.ok(memories.length > 0);
      assert.match(memories[0].content, /Verified Root Cause/);

      // 8. Test memory reflect endpoint
      const reflectRes = await fetch(`${baseUrl}/api/memories/reflect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "What was learned about payment-api connection pool?",
        }),
      });
      assert.strictEqual(reflectRes.status, 200);
      const reflectBody = await reflectRes.json();
      assert.ok(reflectBody.text);
      assert.ok(reflectBody.source);
    });
  });
});
