// Phase 1A: a minimal backend so the architecture is in place.
// Phase 1B adds rule storage; Phase 1C adds the authenticated n8n calls.
import http from "node:http";

const PORT = process.env.PORT || 8787;

const server = http.createServer((req, res) => {
  if (req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
