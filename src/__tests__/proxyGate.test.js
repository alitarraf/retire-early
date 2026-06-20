// /api/chat × entitlement gate wiring (PRD §10.3). The gate itself is unit-
// tested in gate.test.js; here we mock it to verify chat.js acts on its verdict.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../../api/_lib/gate.js", () => ({ checkEntitlement: vi.fn() }));

import handler from "../../api/chat.js";
import { checkEntitlement } from "../../api/_lib/gate.js";

const body = { model: "claude-haiku-4-5", max_tokens: 1024, system: "s", tools: [], messages: [{ role: "user", content: "hi" }] };

function makeReq(ip) {
  const headers = new Headers();
  headers.set("x-nf-client-connection-ip", ip);
  headers.set("content-type", "application/json");
  return new Request("http://localhost/api/chat", { method: "POST", headers, body: JSON.stringify(body) });
}

let fetchSpy;
let ipN = 0;
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  delete process.env.ASK_ALLOWED_ORIGINS;
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
afterEach(() => {
  fetchSpy.mockRestore();
  vi.mocked(checkEntitlement).mockReset();
});
const freshIp = () => `5.5.5.${ipN++}`;

describe("/api/chat entitlement wiring", () => {
  it("blocks with 402 at the paywall and never calls upstream", async () => {
    vi.mocked(checkEntitlement).mockResolvedValue({ allow: false, status: 402, body: { error: "quota_exhausted", tier: "free" } });
    const res = await handler(makeReq(freshIp()));
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: "quota_exhausted" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks anonymous with 401 signup_required", async () => {
    vi.mocked(checkEntitlement).mockResolvedValue({ allow: false, status: 401, body: { error: "signup_required", tier: "anon" } });
    const res = await handler(makeReq(freshIp()));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows, streams, and commits exactly once after a successful start", async () => {
    const commit = vi.fn().mockResolvedValue();
    vi.mocked(checkEntitlement).mockResolvedValue({ allow: true, tier: "free", remaining: 3, commit });
    const res = await handler(makeReq(freshIp()));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/event-stream/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("does NOT commit when the upstream start fails (no quota burned)", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 402 })); // e.g. credits
    const commit = vi.fn();
    vi.mocked(checkEntitlement).mockResolvedValue({ allow: true, commit });
    const res = await handler(makeReq(freshIp()));
    expect(res.status).toBe(402);
    expect(commit).not.toHaveBeenCalled();
  });

  it("sets the device cookie when the gate issues one", async () => {
    vi.mocked(checkEntitlement).mockResolvedValue({ allow: true, commit: vi.fn().mockResolvedValue(), setCookie: "ask_did=abc; Path=/; HttpOnly" });
    const res = await handler(makeReq(freshIp()));
    expect(res.headers.get("set-cookie")).toMatch(/ask_did=abc/);
  });

  it("fails OPEN if the gate throws (chat keeps working)", async () => {
    vi.mocked(checkEntitlement).mockRejectedValue(new Error("db down"));
    const res = await handler(makeReq(freshIp()));
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
