// One place that talks to n8n workflows (read email, suggest reply). Every call carries the
// same secret header; the secret lives only in .env and never reaches the browser.
const fail = (message, status = 502) => Object.assign(new Error(message), { status, expose: true });

/**
 * @param urlVar  name of the .env variable that holds the workflow's Production URL
 * @param payload JSON sent to the workflow
 */
export async function postToN8n(urlVar, payload, { timeoutMs = 45_000 } = {}) {
  const url = process.env[urlVar];
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!url || !secret) {
    throw fail(`n8n isn't set up for this yet. Add ${urlVar} and N8N_WEBHOOK_SECRET to .env and restart the server.`, 503);
  }

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workspace-Secret": secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw fail(
      e?.name === "TimeoutError"
        ? "n8n took too long to answer. Open the workflow's Executions tab in n8n to see what happened."
        : `Can't reach n8n. Check ${urlVar} and your internet connection.`
    );
  }

  if (res.status === 401 || res.status === 403) throw fail("n8n rejected the secret. The Header Auth value in n8n must match N8N_WEBHOOK_SECRET exactly.");
  if (res.status === 404) throw fail(`n8n webhook not found. Publish that workflow and use its Production URL (it contains /webhook/) in ${urlVar}.`);
  if (!res.ok) throw fail(`n8n returned an error (HTTP ${res.status}). Open that workflow's Executions tab in n8n to see why.`);

  try {
    return await res.json();
  } catch {
    throw fail("n8n sent back something that isn't JSON. Check the Respond to Webhook node.");
  }
}