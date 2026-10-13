import { Link } from "react-router-dom";
import type { AgentDefinition } from "../agents/types";

export default function AgentCard({ agent }: { agent: AgentDefinition }) {
  const Icon = agent.icon;
  const live = agent.status === "live";
  const body = (
    <>
      <Icon className="card-watermark" size={150} strokeWidth={1} aria-hidden />
      <span className={`chip ${live ? "chip-live" : ""}`}>{live ? "Live" : "Coming soon"}</span>
      <div className="card-text">
        <Icon size={22} aria-hidden />
        <h3>{agent.title}</h3>
        <p>{agent.description}</p>
      </div>
    </>
  );
  const style = { background: `linear-gradient(145deg, ${agent.accent[0]}, ${agent.accent[1]})` };

  return live ? (
    <Link to={`/agent/${agent.id}`} className="card card-live" style={style}>{body}</Link>
  ) : (
    <div className="card card-idle" style={style} aria-disabled="true">{body}</div>
  );
}
