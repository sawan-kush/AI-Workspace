import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The browser only ever talks to /api. The proxy forwards it to our own
// Node backend, which is the only thing that will ever talk to n8n.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:8787" } },
});
