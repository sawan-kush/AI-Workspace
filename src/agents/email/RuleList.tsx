import { Pencil, Trash2 } from "lucide-react";
import { FIELDS, OP_LABELS, type Rule } from "./types";

interface Props {
  rules: Rule[];
  onEdit: (rule: Rule) => void;
  onToggle: (rule: Rule) => void;
  onDelete: (rule: Rule) => void;
}

const describe = (r: Rule) =>
  r.conditions.map((c) => `${FIELDS[c.field].label} ${OP_LABELS[c.op]} “${c.value}”`).join(r.operator === "AND" ? "  AND  " : "  OR  ");

export default function RuleList({ rules, onEdit, onToggle, onDelete }: Props) {
  return (
    <ul className="rule-list">
      {rules.map((r) => (
        <li key={r.id} className={`rule-item ${r.enabled ? "" : "off"}`}>
          <button type="button" role="switch" aria-checked={r.enabled} aria-label={`${r.enabled ? "Disable" : "Enable"} ${r.name}`}
            className={`switch ${r.enabled ? "on" : ""}`} onClick={() => onToggle(r)} />
          <div className="rule-body">
            <strong>{r.name}</strong>
            <p>{describe(r)}</p>
          </div>
          <button type="button" className="icon-btn" aria-label={`Edit ${r.name}`} onClick={() => onEdit(r)}><Pencil size={16} /></button>
          <button type="button" className="icon-btn" aria-label={`Delete ${r.name}`} onClick={() => onDelete(r)}><Trash2 size={16} /></button>
        </li>
      ))}
    </ul>
  );
}