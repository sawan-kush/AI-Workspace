import { ListFilter } from "lucide-react";

// Phase 1B replaces this with the rule builder and the matched-email list.
export default function EmailAgentPage() {
  return (
    <div className="panel empty">
      <ListFilter size={28} aria-hidden />
      <h2>No rules yet</h2>
      <p>Add a rule to choose which emails appear here. Until you do, this agent shows nothing.</p>
      <button className="btn btn-light" disabled>Add rule (next phase)</button>
    </div>
  );
}
