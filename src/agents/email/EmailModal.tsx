import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Loader2, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { api, ApiError } from "./api";
import type { FullEmail } from "./types";

interface Props {
  id: string;
  startWithReply: boolean;
  onClose: () => void;
}

const msg = (e: unknown) => (e instanceof ApiError ? e.errors.join(" ") : "Something went wrong.");
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });

export default function EmailModal({ id, startWithReply, onClose }: Props) {
  const [email, setEmail] = useState<FullEmail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [original, setOriginal] = useState(""); // the AI's text, to tell whether you edited it
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const draftCtrl = useRef<AbortController | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const edited = draft !== original;

  // Read the full email once when the window opens.
  useEffect(() => {
    const ctrl = new AbortController();
    api.getEmail(id, ctrl.signal)
      .then((r) => !ctrl.signal.aborted && setEmail(r.email))
      .catch((e) => !ctrl.signal.aborted && setLoadError(msg(e)));
    return () => ctrl.abort();
  }, [id]);

  // One draft request at a time: the button is disabled while one is running, and this guard catches the rest.
  const generate = useCallback(async () => {
    if (draftCtrl.current && !draftCtrl.current.signal.aborted) return; // a cancelled request doesn't count as running
    const ctrl = new AbortController();
    draftCtrl.current = ctrl;
    setDrafting(true);
    setDraftError(null);
    try {
      const r = await api.suggestReply(id, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setDraft(r.draft);
      setOriginal(r.draft);
    } catch (e) {
      if (!ctrl.signal.aborted) setDraftError(msg(e));
    } finally {
      if (draftCtrl.current === ctrl) draftCtrl.current = null;
      if (!ctrl.signal.aborted) setDrafting(false);
    }
  }, [id]);

  // Opened with "Suggest reply": start drafting straight away.
  useEffect(() => {
    if (startWithReply) void generate();
  }, [startWithReply, generate]);

  // Closing cancels anything still running.
  useEffect(() => () => draftCtrl.current?.abort(), []);

  const requestClose = useCallback(() => {
    if (edited && !window.confirm("Discard your edited reply draft?")) return;
    onClose();
  }, [edited, onClose]);

  // Esc closes, focus starts on the close button, page behind doesn't scroll.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [requestClose]);

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setDraftError("Couldn't copy automatically. Select the text and copy it.");
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="email-modal-title">
        <header className="modal-head">
          <div>
            <h2 id="email-modal-title">{email?.subject ?? "Loading email…"}</h2>
            {email && (
              <p className="modal-meta">
                <strong>{email.sender.name}</strong> &lt;{email.sender.email}&gt;
                {email.to && <> · to {email.to}</>} · {when(email.received_at)}
              </p>
            )}
          </div>
          <button ref={closeBtn} className="icon-btn" aria-label="Close" onClick={requestClose}><X size={18} /></button>
        </header>

        <div className="modal-body">
          {loadError ? (
            <div className="alert" role="alert"><p>{loadError}</p></div>
          ) : !email ? (
            <p className="muted-line"><Loader2 className="spin" size={16} aria-hidden /> Loading the full email…</p>
          ) : (
            <pre className="email-full">{email.body || "(This email has no text content.)"}</pre>
          )}

          <section className="reply" aria-label="Reply draft">
            <div className="reply-head">
              <h3>Reply draft</h3>
              <span className="muted-line">Review and edit it. Nothing is sent without your approval.</span>
            </div>

            {drafting ? (
              <p className="muted-line"><Loader2 className="spin" size={16} aria-hidden /> Writing a draft…</p>
            ) : draft ? (
              <textarea className="draft" value={draft} onChange={(e) => setDraft(e.target.value)} rows={10} aria-label="Reply draft (editable)" />
            ) : (
              <p className="muted-line">No draft yet.</p>
            )}

            {draftError && <div className="alert" role="alert"><p>{draftError}</p></div>}

            <div className="reply-actions">
              <button className="btn btn-light btn-sm" onClick={generate} disabled={drafting || !email}>
                {draft ? <><RefreshCw size={15} aria-hidden /> Regenerate</> : <><Sparkles size={15} aria-hidden /> Suggest reply</>}
              </button>
              {draft && (
                <button className="btn btn-dark btn-sm" onClick={copyDraft}><Copy size={15} aria-hidden /> {copied ? "Copied" : "Copy"}</button>
              )}
              <button className="btn btn-dark btn-sm" disabled title="Sending isn't built yet. For now, copy the draft and send it from Gmail.">
                <Send size={15} aria-hidden /> Approve &amp; send (coming soon)
              </button>
            </div>
            {draft && edited && <p className="muted-line">You've edited the draft. Regenerating will replace your changes.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}