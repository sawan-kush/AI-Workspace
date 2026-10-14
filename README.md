# My AI Workspace

## Setup
1. `npm install`
2. Copy `.env.example` to `.env`
3. Terminal 1: `npm run server` (API on http://127.0.0.1:8787)
4. Terminal 2: `npm run dev` (UI on http://localhost:5173)
5. Tests: `npm test`

## Add an agent
Build its page in `src/agents/<name>/`, then add one entry to `src/agents/registry.ts`.

## Specific Email Agent (Phase 1B)
- Rules are saved on the server in `server/data/rules.json` (git-ignored).
- An email is shown only if it matches at least one enabled rule. Rules with no conditions match nothing.
- Emails currently come from a built-in sample inbox (`server/email/sample-emails.json`). Phase 1C swaps this for Gmail via n8n.