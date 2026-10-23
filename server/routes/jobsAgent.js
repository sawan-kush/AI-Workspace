import { Router } from "express";
import { getJobs, startRun } from "../jobs/source.js";

export const jobsAgentRouter = Router();
jobsAgentRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// GET /api/jobs-agent/jobs   (add ?refresh=1 for the Refresh button)
jobsAgentRouter.get("/jobs", async (req, res) => {
  const data = await getJobs({ fresh: req.query.refresh === "1" });
  res.json({
    ...data,
    updated_at: new Date().toISOString(),
    mode: (process.env.JOBS_SOURCE || "mock") === "mock" ? "sample" : "live",
    upload_url: /^https?:\/\//i.test(process.env.N8N_JOBS_UPLOAD_URL || "") ? process.env.N8N_JOBS_UPLOAD_URL : "",
  });
});

// POST /api/jobs-agent/run   starts the n8n pipeline now (the schedule also runs it daily)
jobsAgentRouter.post("/run", async (_req, res) => {
  res.json(await startRun());
});