import { Router } from "express";
import { getNews } from "../news/source.js";

export const newsAgentRouter = Router();
newsAgentRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const MESSAGES = {
  ok: "",
  empty: "No AI news has been collected yet. The n8n workflow adds new articles every few hours.",
};

// GET /api/news-agent/articles   (add ?refresh=1 for the Refresh button)
newsAgentRouter.get("/articles", async (req, res) => {
  const articles = await getNews({ fresh: req.query.refresh === "1" });
  const status = articles.length ? "ok" : "empty";
  res.json({ status, message: MESSAGES[status], updated_at: new Date().toISOString(), articles });
});