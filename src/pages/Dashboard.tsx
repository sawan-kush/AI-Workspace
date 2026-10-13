import Hero from "../components/Hero";
import AgentCard from "../components/AgentCard";
import { agents } from "../agents/registry";

export default function Dashboard() {
  return (
    <>
      <Hero />
      <section id="agents" className="agents">
        <h2>Your agents</h2>
        <div className="grid">
          {agents.map((a) => <AgentCard key={a.id} agent={a} />)}
        </div>
      </section>
    </>
  );
}
