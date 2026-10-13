import { Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock } from "lucide-react";
import { getAgent } from "../agents/registry";

export default function AgentView() {
  const { id = "" } = useParams();
  const agent = getAgent(id);

  if (!agent) {
    return (
      <main className="agent-view">
        <Link to="/" className="back"><ArrowLeft size={18} /> Back to dashboard</Link>
        <div className="panel empty"><h2>Agent not found</h2><p>Go back and pick an agent from the dashboard.</p></div>
      </main>
    );
  }

  const Page = agent.page;
  return (
    <main className="agent-view">
      <Link to="/" className="back"><ArrowLeft size={18} /> Back to dashboard</Link>
      <h1>{agent.title}</h1>
      <p className="muted">{agent.description}</p>
      {Page ? (
        <Suspense fallback={<div className="panel empty">Loading…</div>}>
          <Page />
        </Suspense>
      ) : (
        <div className="panel empty">
          <Clock size={28} aria-hidden />
          <h2>Coming soon</h2>
          <p>This agent is not built yet.</p>
        </div>
      )}
    </main>
  );
}
