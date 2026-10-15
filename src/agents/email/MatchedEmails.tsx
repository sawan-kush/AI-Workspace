import { MailX, ListFilter } from "lucide-react";
import type { MatchesResponse } from "./types";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

interface Props {
  matches: MatchesResponse;
  newIds: Set<string>;
  onRead: (id: string) => void;
  onReply: (id: string) => void;
}

export default function MatchedEmails({ matches, newIds, onRead, onReply }: Props) {
  if (matches.emails.length === 0) {
    const Icon = matches.status === "no_rules" ? ListFilter : MailX;
    return (
      <div className="panel empty">
        <Icon size={28} aria-hidden />
        <p>{matches.message}</p>
      </div>
    );
  }

  return (
    <ul className="email-list">
      {matches.emails.map((m) => (
        <li key={m.email_id} className={`panel email-card ${newIds.has(m.email_id) ? "is-new" : ""}`}>
          <div className="email-top">
            <span className="email-from">{m.sender.name} <span>&lt;{m.sender.email}&gt;</span></span>
            <time dateTime={m.received_at}>{when(m.received_at)}</time>
          </div>
          <h3>{m.subject}{newIds.has(m.email_id) && <span className="tag-new">New</span>}</h3>
          <p className="preview">{m.preview}</p>
          <div className="email-bottom">
            <span className="tags">
              {m.matched_rule.map((r) => <span className="tag" key={r}>{r}</span>)}
            </span>
            <span className="email-actions">
              <button className="btn btn-dark btn-sm" onClick={() => onRead(m.email_id)}>Read full email</button>
              <button className="btn btn-dark btn-sm" onClick={() => onReply(m.email_id)}>Suggest reply</button>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}