import express from "express";
import { emailAgentRouter } from "./routes/emailAgent.js";
import { newsAgentRouter } from "./routes/newsAgent.js";
import { jobsAgentRouter } from "./routes/jobsAgent.js";

const PORT = process.env.PORT || 8787;
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "50kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/email-agent", emailAgentRouter);
app.use("/api/news-agent", newsAgentRouter);
app.use("/api/jobs-agent", jobsAgentRouter);
app.use("/api", (_req, res) => res.status(404).json({ errors: ["Not found."] }));

// Express 5 forwards errors from async routes here.
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ errors: ["Invalid JSON."] });
  if (err.expose || (err.status && err.status < 500)) return res.status(err.status || 502).json({ errors: [err.message] });
  console.error(err);
  res.status(500).json({ errors: ["Something went wrong on the server."] });
});

// Listens on your own machine only, not on the network.
app.listen(PORT, "127.0.0.1", () => console.log(`API listening on http://127.0.0.1:${PORT}`));