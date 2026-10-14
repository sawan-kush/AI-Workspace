import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { ApiError } from "./api";
import { FIELDS, OP_LABELS, type Condition, type Field, type Rule, type RuleInput } from "./types";

const MAX_CONDITIONS = 10;
const blank = (): Condition => ({ field: "sender_email", op: "equals", value: "" });

interface Props {
  rule?: Rule;
  onSave: (input: RuleInput) => Promise<void>;
  onCancel: () => void;
}

export default function RuleForm({ rule, onSave, onCancel }: Props) {
  const [name, setName] = useState(rule?.name ?? "");
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [operator, setOperator] = useState<RuleInput["operator"]>(rule?.operator ?? "AND");
  const [conditions, setConditions] = useState<Condition[]>(rule?.conditions ?? [blank()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const setCond = (i: number, patch: Partial<Condition>) =>
    setConditions((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const changeField = (i: number, field: Field) => setCond(i, { field, op: FIELDS[field].ops[0], value: "" });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problems: string[] = [];
    if (!name.trim()) problems.push("Give the rule a name.");
    if (conditions.some((c) => !c.value.trim())) problems.push("Fill in a value for every condition.");
    if (problems.length) return setErrors(problems);

    setSaving(true);
    try {
      await onSave({ name: name.trim(), enabled, operator, conditions });
    } catch (err) {
      setErrors(err instanceof ApiError ? err.errors : ["Something went wrong."]);
      setSaving(false);
    }
  }

  return (
    <form className="panel rule-form" onSubmit={submit}>
      <h3>{rule ? "Edit rule" : "New rule"}</h3>

      <label className="field">
        <span>Rule name</span>
        <input value={name} maxLength={80} placeholder="e.g. Placement coordinator" onChange={(e) => setName(e.target.value)} />
      </label>

      {conditions.length > 1 && (
        <label className="field inline">
          <span>Show an email when</span>
          <select value={operator} onChange={(e) => setOperator(e.target.value as RuleInput["operator"])}>
            <option value="AND">all</option>
            <option value="OR">any</option>
          </select>
          <span>of these conditions match</span>
        </label>
      )}

      <div className="conditions">
        {conditions.map((c, i) => (
          <div className="cond-row" key={i}>
            <select aria-label="Field" value={c.field} onChange={(e) => changeField(i, e.target.value as Field)}>
              {Object.entries(FIELDS).map(([key, f]) => <option key={key} value={key}>{f.label}</option>)}
            </select>
            <select aria-label="Comparison" value={c.op} onChange={(e) => setCond(i, { op: e.target.value as Condition["op"] })}>
              {FIELDS[c.field].ops.map((op) => <option key={op} value={op}>{OP_LABELS[op]}</option>)}
            </select>
            <input
              aria-label="Value"
              type={FIELDS[c.field].type}
              value={c.value}
              maxLength={200}
              placeholder={FIELDS[c.field].placeholder}
              onChange={(e) => setCond(i, { value: e.target.value })}
            />
            <button type="button" className="icon-btn" aria-label="Remove condition" disabled={conditions.length === 1}
              onClick={() => setConditions((cs) => cs.filter((_, j) => j !== i))}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-dark btn-sm" disabled={conditions.length >= MAX_CONDITIONS}
        onClick={() => setConditions((cs) => [...cs, blank()])}>
        <Plus size={16} aria-hidden /> Add condition
      </button>

      <label className="check">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Rule is enabled
      </label>

      {errors.length > 0 && <div className="alert" role="alert">{errors.map((m) => <p key={m}>{m}</p>)}</div>}

      <div className="form-actions">
        <button className="btn btn-light" disabled={saving}>{saving ? "Saving…" : "Save rule"}</button>
        <button type="button" className="btn btn-dark" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}