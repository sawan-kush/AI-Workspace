import { Router } from "express";
import { validateRule } from "../rules/validate.js";
import * as store from "../rules/store.js";
import { getEmails } from "../email/source.js";
import { activeRules, matchEmails } from "../filter/matchEmails.js";

export const emailAgentRouter = Router();
emailAgentRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const notFound = (res) => res.status(404).json({ errors: ["Rule not found."] });

// ---- rules (create, read, edit, enable/disable, delete) ----
emailAgentRouter.get("/rules", async (_req, res) => res.json({ rules: await store.list() }));

emailAgentRouter.post("/rules", async (req, res) => {
  const v = validateRule(req.body);
  if (!v.ok) return res.status(400).json({ errors: v.errors });
  res.status(201).json({ rule: await store.create(v.value) });
});

emailAgentRouter.put("/rules/:id", async (req, res) => {
  const v = validateRule(req.body);
  if (!v.ok) return res.status(400).json({ errors: v.errors });
  const rule = await store.replace(req.params.id, v.value);
  return rule ? res.json({ rule }) : notFound(res);
});

emailAgentRouter.patch("/rules/:id", async (req, res) => {
  if (typeof req.body?.enabled !== "boolean") return res.status(400).json({ errors: ["Enabled must be true or false."] });
  const rule = await store.setEnabled(req.params.id, req.body.enabled);
  return rule ? res.json({ rule }) : notFound(res);
});

emailAgentRouter.delete("/rules/:id", async (req, res) =>
  (await store.remove(req.params.id)) ? res.status(204).end() : notFound(res)
);

// ---- matches: the only way emails ever reach the dashboard ----
const MESSAGES = {
  ok: "",
  no_match: "No emails matched your selected criteria.",
  no_rules: "No rules are enabled yet. Add or enable a rule to see emails here.",
};

const preview = (body) => {
  const text = String(body ?? "").replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
};

emailAgentRouter.get("/matches", async (_req, res) => {
  const rules = await store.list();
  // No active rule means we don't even fetch emails.
  if (activeRules(rules).length === 0) return res.json({ status: "no_rules", message: MESSAGES.no_rules, emails: [] });

  const matches = matchEmails(await getEmails(), rules);
  const status = matches.length ? "ok" : "no_match";
  res.json({
    status,
    message: MESSAGES[status],
    // Only these fields leave the server. The full body is never in the list.
    emails: matches.map(({ email, matchedRules }) => ({
      email_id: email.id,
      sender: { name: email.from.name, email: email.from.email },
      subject: email.subject,
      received_at: email.receivedAt,
      preview: preview(email.body),
      matched_rule: matchedRules,
    })),
  });
});