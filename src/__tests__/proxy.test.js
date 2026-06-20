import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import handler from "../../api/chat.js";

// Proxy contract tests (PRD §14): origin rejection, method/validation, rate
// limit, and server-enforced max_tokens — with a mocked upstream.

function makeReq({ method = "POST", origin, ip = "1.2.3.4", body } = {}) {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  headers.set("x-nf-client-connection-ip", ip);
  headers.set("content-type", "application/json");
  return new Request("http://localhost/api/chat", {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const validBody = { model: "claude-haiku-4-5", max_tokens: 4096, system: "s", tools: [], messages: [{ role: "user", content: "hi" }] };

let fetchSpy;
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  process.env.ASK_ALLOWED_ORIGINS = "https://allowed.app";
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("event: message_stop\ndata: {}\n\n"));
        c.close();
      },
    });
    return new Response(stream, { status: 200 });
  });
});
afterEach(() => fetchSpy.mockRestore());

describe("/api/chat proxy", () => {
  it("rejects a disallowed origin with 403", async () => {
    const res = await handler(makeReq({ origin: "https://evil.com", body: validBody, ip: "10.0.0.1" }));
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows a permitted origin and caps max_tokens at 1024", async () => {
    const res = await handler(makeReq({ origin: "https://allowed.app", body: validBody, ip: "10.0.0.2" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/event-stream/);
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(sent.max_tokens).toBe(1024); // server-enforced cap (§9)
    expect(sent.stream).toBe(true);
  });

  it("rejects non-POST with 405", async () => {
    const res = await handler(makeReq({ method: "GET", ip: "10.0.0.3" }));
    expect(res.status).toBe(405);
  });

  it("rejects a body with no messages (400)", async () => {
    const res = await handler(makeReq({ body: { messages: [] }, ip: "10.0.0.4" }));
    expect(res.status).toBe(400);
  });

  it("500s when the API key is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await handler(makeReq({ body: validBody, ip: "10.0.0.5" }));
    expect(res.status).toBe(500);
  });

  it("rate-limits a single IP after the window cap", async () => {
    let last;
    for (let i = 0; i < 32; i++) {
      last = await handler(makeReq({ body: validBody, ip: "10.9.9.9" }));
    }
    expect(last.status).toBe(429);
  });
});
