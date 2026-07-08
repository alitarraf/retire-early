import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Dev-only proxy for /api/chat. In production the Netlify function (api/chat.js)
// holds the key; locally `npm run dev` forwards to Anthropic using ANTHROPIC_API_KEY
// from .env, so the agent works without `netlify dev`. The key never reaches the
// client bundle — it's read here in the Node dev server only.
function askDevProxy(apiKey) {
  return {
    name: "ask-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/chat", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end(JSON.stringify({ error: "method_not_allowed" }));
        }
        if (!apiKey) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: "no_api_key", detail: "ANTHROPIC_API_KEY missing from .env" }));
        }
        try {
          const chunks = [];
          for await (const c of req) chunks.push(c);
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          const cappedMaxTokens = Math.min(Number(body.max_tokens) || 1024, 1024);

          const upstream = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: body.model || "claude-haiku-4-5",
              max_tokens: cappedMaxTokens,
              system: body.system,
              tools: body.tools,
              messages: body.messages,
              stream: true,
            }),
          });

          if (!upstream.ok || !upstream.body) {
            const detail = (await upstream.text().catch(() => "")).slice(0, 500);
            res.statusCode = upstream.status || 502;
            res.setHeader("content-type", "application/json");
            return res.end(JSON.stringify({ error: "upstream_error", detail }));
          }

          res.statusCode = 200;
          res.setHeader("content-type", "text/event-stream");
          res.setHeader("cache-control", "no-cache");
          for await (const chunk of upstream.body) res.write(chunk);
          res.end();
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "proxy_error", detail: String(e?.message || e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load ALL env (empty prefix) so ANTHROPIC_API_KEY (no VITE_ prefix) is read
  // here without being exposed to client code.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), askDevProxy(env.ANTHROPIC_API_KEY)],
    server: {
      host: true,
      // Allow access from any device on the private Tailscale tailnet
      // (e.g. http://alipc-1:5173 from a phone). This dev server is never
      // exposed to the public internet, so disabling the DNS-rebinding host
      // check is safe here and lets the tailnet MagicDNS names through.
      allowedHosts: true,
      hmr: { host: "localhost" },
      watch: { usePolling: true, interval: 300 },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.{js,jsx}"],
    },
  };
});
