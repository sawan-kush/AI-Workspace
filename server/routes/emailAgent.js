import { Router } from "express";
import { validateRule } from "../rules/validate.js";
import * as store from "../rules/store.js";
import { getEmails } from "../email/source.js";
import { activeRules, matchEmails } from "../filter/matchEmails.js";
import { readFullEmail, suggestReply } from "../email/actions.js";

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

emailAgentRouter.get("/matches", async (req, res) => {
  const rules = await store.list();
  // No active rule means we don't even fetch emails.
  const active = activeRules(rules);
  if (active.length === 0) {
    return res.json({ status: "no_rules", message: MESSAGES.no_rules, updated_at: new Date().toISOString(), emails: [] });
  }

  // Even if the email source (n8n) already filtered, we filter again here: nothing
  // reaches the dashboard unless it passes your rules in this file's own check.
  // ?refresh=1 is sent by the dashboard's live refresh: skip any cached answer older than ~10s.
  const fresh = req.query.refresh === "1";
  const matches = matchEmails(await getEmails(active, { fresh }), rules);
  const status = matches.length ? "ok" : "no_match";
  res.json({
    status,
    message: MESSAGES[status],
    updated_at: new Date().toISOString(),
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

// ---- one email: read it in full, or draft a reply ----
// An email can only be opened if it is one of YOUR matching emails right now, so these
// routes can never be used to read anything else in the inbox.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

async function requireMatching(id) {
  const reject = (status, message) => Object.assign(new Error(message), { status, expose: true });
  if (!ID_PATTERN.test(id)) throw reject(400, "Invalid email id.");
  const rules = await store.list();
  const active = activeRules(rules);
  const matches = active.length ? matchEmails(await getEmails(active), rules) : [];
  if (!matches.some((m) => m.email.id === id)) throw reject(404, "That email doesn't match any of your enabled rules, so it can't be opened.");
  return active; // handed on to n8n, which checks the email against these rules again
}

emailAgentRouter.get("/emails/:id", async (req, res) => {
  const rules = await requireMatching(req.params.id);
  const e = await readFullEmail(req.params.id, rules);
  res.json({
    email: {
      email_id: e.id,
      sender: { name: e.from.name, email: e.from.email },
      to: e.to,
      subject: e.subject,
      received_at: e.receivedAt,
      body: e.body,
    },
  });
});

// Only creates a draft for you to review. There is no route that sends email.
emailAgentRouter.post("/emails/:id/draft", async (req, res) => {
  const rules = await requireMatching(req.params.id);
  res.json({ draft: await suggestReply(req.params.id, rules) });
});