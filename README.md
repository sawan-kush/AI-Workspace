# My AI Workspace

## Setup
1. `npm install`
2. Copy `.env.example` to `.env`
3. Terminal 1: `npm run server` (API on http://127.0.0.1:8787)
4. Terminal 2: `npm run dev` (UI on http://localhost:5173)
5. Tests: `npm test`

## Add an agent
Build its page in `src/agents/<name>/`, then add one entry to `src/agents/registry.ts`.

## Specific Email Agent
- Rules are saved on the server in `server/data/rules.json` (git-ignored).
- An email is shown only if it matches at least one enabled rule. Rules with no conditions match nothing.
- `EMAIL_SOURCE=mock` uses a built-in sample inbox (`server/email/sample-emails.json`).
- `EMAIL_SOURCE=n8n` reads your Gmail through the n8n workflow in `n8n/specific-email-agent.workflow.json`.

### Connect n8n (Phase 1C)
1. In n8n: create a workflow, then menu (...) > Import from file > pick `n8n/specific-email-agent.workflow.json`.
2. Webhook node: Credential > Create new > Header Auth. Name = `X-Workspace-Secret`, Value = your secret (the same value as `N8N_WEBHOOK_SECRET` in `.env`).
3. "Get inbox emails" node: Credential > Create new > Sign in with Google.
4. Publish the workflow. In the Webhook node, copy the Production URL into `N8N_WEBHOOK_URL` in `.env`.
5. Set `EMAIL_SOURCE=n8n` in `.env` and restart `npm run server`.

The filter in the n8n Code node is generated from `server/filter/matchEmails.js`. If you change that file, run `node scripts/build-n8n-workflow.mjs` and re-import the workflow. The backend also re-checks every email n8n returns.