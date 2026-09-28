import { Router, type IRouter, type Request, type Response } from "express";
import {
  createCustomIncident,
  dashboard,
  decideRemediation,
  findIncident,
  getInvestigation,
  getPostmortem,
  integrationStatus,
  listIncidents,
  listMemories,
  listScenarios,
  loadDemo,
  resetDemo,
  retainPostmortem,
  startInvestigation,
  summary,
  trace,
  updatePostmortem,
  verifyRemediation,
} from "../memoryops/store";
import { reflectOnMemories } from "../memoryops/hindsight";

const router: IRouter = Router();

const error = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message, details: {} } });

const id = (req: Request) => req.params.incidentId as string;
const requireIncident = (req: Request, res: Response) => {
  const incident = findIncident(id(req));
  if (!incident) {
    error(res, 404, "not_found", "Incident not found");
    return null;
  }
  return incident;
};

router.get("/dashboard", (_req, res) => res.json(dashboard()));

router.get("/incidents", (req, res) => {
  res.json(listIncidents({
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    severity: typeof req.query.severity === "string" ? req.query.severity : undefined,
    service: typeof req.query.service === "string" ? req.query.service : undefined,
  }).map(summary));
});

router.post("/incidents", (req, res) => {
  const body = req.body as Record<string, string | undefined>;
  if (body.scenario_key) {
    const existing = listIncidents({}).find((incident) => incident.scenario_key === body.scenario_key && !["resolved", "unresolved"].includes(incident.status));
    if (existing) return error(res, 409, "duplicate_incident", "An active incident already exists for this scenario.");
  }
  if (body.scenario_key) {
    const incident = listIncidents({}).find((candidate) => candidate.scenario_key === body.scenario_key);
    if (incident) return res.status(201).json(summary(incident));
  }
  const incident = createCustomIncident(body);
  return res.status(201).json(summary(incident));
});

router.get("/incidents/:incidentId", (req, res) => {
  const incident = requireIncident(req, res);
  if (!incident) return;
  const investigation = getInvestigation(incident.id);
  return res.json({ ...summary(incident), evidence: incident.evidence, latest_run: investigation });
});

router.post("/incidents/:incidentId/investigate", async (req, res) => {
  const incident = requireIncident(req, res);
  if (!incident) return;
  try {
    const run = await startInvestigation(incident.id);
    return res.status(202).json({ run_id: run.run_id });
  } catch (caught) {
    return error(res, 409, "investigation_failed", caught instanceof Error ? caught.message : "Investigation failed");
  }
});

router.get("/incidents/:incidentId/investigation", (req, res) => {
  const incident = requireIncident(req, res);
  if (!incident) return;
  return res.json(getInvestigation(incident.id) ?? {
    run_id: "",
    status: "not_started",
    stage: "new",
    steps: [],
    evidence: incident.evidence,
    memories: [],
    hypotheses: [],
    proposal: null,
    execution: null,
    verification: null,
    degraded: false,
    pre_recall_analysis: "",
    after_recall_analysis: "",
    reflection: null,
    missing_info: [],
  });
});

router.post("/incidents/:incidentId/approve-remediation", (req, res) => {
  const incident = requireIncident(req, res);
  if (!incident) return;
  try {
    return res.json(decideRemediation(incident.id, "approved", (req.body as { reason?: string }).reason));
  } catch (caught) {
    return error(res, 409, "approval_failed", caught instanceof Error ? caught.message : "Approval failed");
  }
});

router.post("/incidents/:incidentId/reject-remediation", (req, res) => {
  const incident = requireIncident(req, res);
  if (!incident) return;
  try {
    return res.json(decideRemediation(incident.id, "rejected", (req.body as { reason?: string }).reason));
  } catch (caught) {
    return error(res, 409, "rejection_failed", caught instanceof Error ? caught.message : "Rejection failed");
  }
});

router.post("/incidents/:incidentId/verify", (req, res) => {
  const incident = requireIncident(req, res);
  if (!incident) return;
  try {
    const run = verifyRemediation(incident.id);
    return res.json(run);
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : "Verification failed";
    const status = msg.includes("not found") ? 404 : 409;
    return error(res, status, "verification_failed", msg);
  }
});

router.get("/incidents/:incidentId/memory-trace", (req, res) => {
  const incident = requireIncident(req, res);
  if (!incident) return;
  return res.json(trace(incident.id));
});

router.get("/incidents/:incidentId/postmortem", (req, res) => {
  const incident = requireIncident(req, res);
  if (!incident) return;
  const pm = getPostmortem(incident.id);
  if (!pm) return error(res, 404, "not_found", "Post-mortem is generated after a verified resolution.");
  return res.json(pm);
});

router.put("/incidents/:incidentId/postmortem", (req, res) => {
  const incident = requireIncident(req, res);
  if (!incident) return;
  try {
    return res.json(updatePostmortem(incident.id, req.body));
  } catch (caught) {
    return error(res, 400, "invalid_postmortem", caught instanceof Error ? caught.message : "Invalid post-mortem");
  }
});

router.post("/incidents/:incidentId/postmortem/retain", async (req, res) => {
  const incident = requireIncident(req, res);
  if (!incident) return;
  try {
    const pm = await retainPostmortem(incident.id);
    return res.json(pm);
  } catch (caught) {
    return error(res, 409, "retention_failed", caught instanceof Error ? caught.message : "Retention failed");
  }
});

router.get("/memories", (req, res) => res.json(listMemories({
  service: typeof req.query.service === "string" ? req.query.service : undefined,
  q: typeof req.query.q === "string" ? req.query.q : undefined,
  outcome: typeof req.query.outcome === "string" ? req.query.outcome : undefined,
  root_cause: typeof req.query.root_cause === "string" ? req.query.root_cause : undefined,
})));

router.get("/memories/:memoryId", (req, res) => {
  const memory = listMemories({}).find((candidate) => candidate.id === req.params.memoryId);
  if (!memory) return error(res, 404, "not_found", "Memory not found");
  return res.json({ hindsight: memory, app_metadata: { incident_id: memory.incident_id, operation_status: "success", source: memory.source } });
});

router.post("/memories/reflect", async (req, res) => {
  const query = String((req.body as { query?: string }).query ?? "").trim();
  if (!query) return error(res, 422, "validation_error", "A reflection query is required.");
  try {
    const result = await reflectOnMemories(query, undefined, (q) => {
      const memories = listMemories({ q });
      return memories.length
        ? `Across ${memories.length} retained demo memory record(s), verified rollback or configuration correction restored service. The prior restart attempt did not hold.`
        : "No retained memory matches this query. Resolve and review an incident to teach MemoryOps.";
    });
    return res.json({ text: result.text, source: result.source });
  } catch (caught) {
    return error(res, 500, "reflection_failed", caught instanceof Error ? caught.message : "Reflection failed");
  }
});

router.get("/demo/scenarios", (_req, res) => res.json(listScenarios()));
router.post("/demo/load", (_req, res) => res.json({ message: "Synthetic Northstar Commerce fixtures loaded.", incidents: loadDemo() }));
router.post("/demo/reset", (req, res) => {
  if (!((req.body as { confirm?: boolean } | undefined)?.confirm)) return error(res, 400, "confirmation_required", "Reset requires confirm=true.");
  resetDemo();
  return res.json({ message: "Demo incidents and simulated demo memory were removed. No live infrastructure was touched.", incidents: 0 });
});
router.get("/integrations/status", async (_req, res) => res.json(await integrationStatus()));

export default router;