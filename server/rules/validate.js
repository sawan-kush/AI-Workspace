// Validates and normalizes a rule coming from the browser. The server never
// trusts the client: anything not on this whitelist is rejected or ignored.
export const MAX_RULES = 50;
export const MAX_CONDITIONS = 10;

export const FIELDS = {
  sender_email: { ops: ["equals"] },
  sender_name: { ops: ["contains", "equals"] },
  sender_domain: { ops: ["equals"] },
  subject: { ops: ["contains", "equals"] },
  keyword: { ops: ["contains"] }, // looks in subject and body
  received_date: { ops: ["on_or_after", "on_or_before"], date: true },
};

const isRealDate = (v) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

export function validateRule(input) {
  if (!input || typeof input !== "object") return { ok: false, errors: ["Invalid rule."] };
  const errors = [];

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) errors.push("Give the rule a name.");
  else if (name.length > 80) errors.push("Rule name is too long (max 80 characters).");

  const operator = input.operator ?? "AND";
  if (operator !== "AND" && operator !== "OR") errors.push("Operator must be AND or OR.");

  const enabled = input.enabled ?? true;
  if (typeof enabled !== "boolean") errors.push("Enabled must be true or false.");

  const conditions = [];
  if (!Array.isArray(input.conditions) || input.conditions.length === 0) {
    errors.push("A rule needs at least one condition.");
  } else if (input.conditions.length > MAX_CONDITIONS) {
    errors.push(`A rule can have at most ${MAX_CONDITIONS} conditions.`);
  } else {
    input.conditions.forEach((c, i) => {
      const n = i + 1;
      const spec = FIELDS[c?.field];
      if (!spec) return errors.push(`Condition ${n}: unknown field.`);
      if (!spec.ops.includes(c.op)) return errors.push(`Condition ${n}: that comparison isn't allowed for this field.`);
      let value = typeof c.value === "string" ? c.value.trim() : "";
      if (!value) return errors.push(`Condition ${n}: enter a value.`);
      if (value.length > 200) return errors.push(`Condition ${n}: value is too long (max 200 characters).`);
      if (spec.date) {
        if (!isRealDate(value)) return errors.push(`Condition ${n}: enter a valid date.`);
      } else {
        value = value.toLowerCase();
        if (c.field === "sender_domain") value = value.replace(/^@/, "");
        if (c.field === "sender_email" && !value.includes("@")) return errors.push(`Condition ${n}: enter a full email address.`);
      }
      conditions.push({ field: c.field, op: c.op, value });
    });
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: { name, enabled, operator, conditions } };
}