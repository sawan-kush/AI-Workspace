import { useState } from "react";
import { Plus } from "lucide-react";
import { api, ApiError } from "./api";
import { POLL_SECONDS, useEmailAgent } from "./useEmailAgent";
import RuleForm from "./RuleForm";
import RuleList from "./RuleList";
import MatchedEmails from "./MatchedEmails";
import EmailModal from "./EmailModal";
import type { Rule, RuleInput } from "./types";

export default function EmailAgentPage() {
  const { rules, matches, loading, error, refreshError, updatedAt, newIds, refresh } = useEmailAgent();
  const [editing, setEditing] = useState<Rule | "new" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; mode: "read" | "reply" } | null>(null);

  // Runs a rule change, then reloads rules and matches together.
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setActionError(null);
      await refresh();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.errors.join(" ") : "Something went wrong.");
    }
  };

  const save = async (input: RuleInput) => {
    if (editing && editing !== "new") await api.updateRule(editing.id, input);
    else await api.createRule(input);
    setEditing(null);
    await refresh();
  };

  if (loading) return <div className="panel empty">Loading…</div>;
  if (error) {
    return (
      <div className="panel empty">
        <p>{error}</p>
        <button className="btn btn-light" onClick={refresh}>Try again</button>
      </div>
    );
  }

  return (
    <div className="email-agent">
      <section>
        <div className="section-head">
          <h2>Selection rules</h2>
          {!editing && (
            <button className="btn btn-light btn-sm" onClick={() => setEditing("new")}>
              <Plus size={16} aria-hidden /> Add rule
            </button>
          )}
        </div>
        <p className="muted small">An email appears here only if it matches at least one enabled rule. Everything else stays hidden.</p>

        {actionError && <div className="alert" role="alert"><p>{actionError}</p></div>}

        {editing && (
          <RuleForm key={editing === "new" ? "new" : editing.id} rule={editing === "new" ? undefined : editing}
            onSave={save} onCancel={() => setEditing(null)} />
        )}

        {rules.length > 0 && (
          <RuleList rules={rules} onEdit={setEditing}
            onToggle={(r) => act(() => api.setEnabled(r.id, !r.enabled))}
            onDelete={(r) => window.confirm(`Delete the rule “${r.name}”?`) && act(() => api.deleteRule(r.id))} />
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>Matching emails{matches && matches.emails.length > 0 ? ` (${matches.emails.length})` : ""}</h2>
        </div>
        <p className={`sync-status ${refreshError ? "warn" : ""}`} role="status" aria-live="polite">
          <span className="dot" aria-hidden />
          {refreshError
            ? `Couldn't refresh: ${refreshError} Showing the last results and trying again.`
            : `Updated ${updatedAt ? updatedAt.toLocaleTimeString() : "…"} · checks for new mail every ${POLL_SECONDS} seconds`}
          {newIds.size > 0 && <strong className="new-count"> · {newIds.size} new</strong>}
        </p>
        {matches && (
          <MatchedEmails matches={matches} newIds={newIds}
            onRead={(id) => setOpen({ id, mode: "read" })} onReply={(id) => setOpen({ id, mode: "reply" })} />
        )}
      </section>

      {open && <EmailModal key={open.id} id={open.id} startWithReply={open.mode === "reply"} onClose={() => setOpen(null)} />}
    </div>
  );
}