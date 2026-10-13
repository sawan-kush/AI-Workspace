import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { profile } from "../config/profile";
import { agents } from "../agents/registry";

export default function Hero() {
  const live = agents.filter((a) => a.status === "live");
  return (
    <section className="hero">
      <div className="hero-photo" style={{ backgroundImage: `url(${profile.photo})` }} aria-hidden />
      <div className="hero-copy">
        <p className="hero-kicker">My AI Workspace</p>
        <h1>{profile.name}</h1>
        <p className="hero-sub">{profile.headline}</p>
        <div className="hero-actions">
          {live[0] && (
            <Link className="btn btn-light" to={`/agent/${live[0].id}`}>
              <Play size={18} fill="currentColor" aria-hidden /> Open {live[0].title}
            </Link>
          )}
          <a className="btn btn-dark" href="#agents">All agents</a>
        </div>
      </div>
    </section>
  );
}
