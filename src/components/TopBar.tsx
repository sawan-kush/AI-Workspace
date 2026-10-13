import { Link } from "react-router-dom";
import { profile } from "../config/profile";

export default function TopBar() {
  return (
    <header className="topbar">
      <Link to="/" className="brand">My AI Workspace</Link>
      <div className="me">
        <span>{profile.name}</span>
        <div className="avatar" style={{ backgroundImage: `url(${profile.photo})` }} aria-hidden />
      </div>
    </header>
  );
}