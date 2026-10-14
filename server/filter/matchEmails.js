// The strict filter. Pure and deterministic: same emails + same rules = same
// result, no AI, no randomness. It only ever returns emails that satisfy at
// least one enabled rule, and it fails closed on anything it doesn't understand.
const norm = (s) => String(s ?? "").trim().toLowerCase();
const domainOf = (addr) => norm(addr).split("@").pop();

// Dates are whole days in the server's local time (your own timezone).
const startOfDay = (d) => new Date(`${d}T00:00:00`).getTime();
const endOfDay = (d) => new Date(`${d}T23:59:59.999`).getTime();

const tests = {
  sender_email: { equals: (e, v) => norm(e.from.email) === v },
  sender_name: {
    contains: (e, v) => norm(e.from.name).includes(v),
    equals: (e, v) => norm(e.from.name) === v,
  },
  sender_domain: { equals: (e, v) => domainOf(e.from.email) === v },
  subject: {
    contains: (e, v) => norm(e.subject).includes(v),
    equals: (e, v) => norm(e.subject) === v,
  },
  keyword: { contains: (e, v) => norm(e.subject).includes(v) || norm(e.body).includes(v) },
  received_date: {
    on_or_after: (e, v) => new Date(e.receivedAt).getTime() >= startOfDay(v),
    on_or_before: (e, v) => new Date(e.receivedAt).getTime() <= endOfDay(v),
  },
};

export function matchesCondition(email, { field, op, value }) {
  const test = tests[field]?.[op];
  const v = field === "received_date" ? String(value ?? "").trim() : norm(value);
  if (!test || !v) return false; // unknown or empty condition never matches
  return test(email, v);
}

export function matchesRule(email, rule) {
  if (!rule.enabled || !Array.isArray(rule.conditions) || rule.conditions.length === 0) return false;
  const check = (c) => matchesCondition(email, c);
  return rule.operator === "OR" ? rule.conditions.some(check) : rule.conditions.every(check);
}

/** Rules that are allowed to select emails at all. */
export const activeRules = (rules) =>
  rules.filter((r) => r.enabled && Array.isArray(r.conditions) && r.conditions.length > 0);

/**
 * Returns [{ email, matchedRules: [names] }], newest first.
 * An email appears if ANY enabled rule matches it. Nothing else is ever added.
 */
export function matchEmails(emails, rules) {
  const active = activeRules(rules);
  const out = [];
  for (const email of emails) {
    const names = active.filter((r) => matchesRule(email, r)).map((r) => r.name);
    if (names.length) out.push({ email, matchedRules: names });
  }
  return out.sort((a, b) => new Date(b.email.receivedAt) - new Date(a.email.receivedAt));
}