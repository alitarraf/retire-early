import { describe, it, expect } from "vitest";
import { streamChat, ChatError } from "../agent/chatClient.js";

// Build a fake fetch returning an SSE ReadableStream from raw event chunks.
function fakeFetch(chunks, { ok = true, status = 200 } = {}) {
  return async () => ({
    ok,
    status,
    body: ok
      ? new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            for (const c of chunks) controller.enqueue(enc.encode(c));
            controller.close();
          },
        })
      : null,
    text: async () => "error body",
  });
}

const sse = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;

describe("chatClient — SSE parsing", () => {
  it("assembles text deltas and a tool_use block with parsed input", async () => {
    const chunks = [
      sse("message_start", { message: { usage: { input_tokens: 100 } } }),
      sse("content_block_start", { index: 0, content_block: { type: "text", text: "" } }),
      sse("content_block_delta", { index: 0, delta: { type: "text_delta", text: "Hi " } }),
      sse("content_block_delta", { index: 0, delta: { type: "text_delta", text: "there" } }),
      sse("content_block_stop", { index: 0 }),
      sse("content_block_start", { index: 1, content_block: { type: "tool_use", id: "tu_1", name: "run_scenario", input: {} } }),
      // input streamed as partial JSON across two deltas
      sse("content_block_delta", { index: 1, delta: { type: "input_json_delta", partial_json: '{"age":' } }),
      sse("content_block_delta", { index: 1, delta: { type: "input_json_delta", partial_json: "60}" } }),
      sse("content_block_stop", { index: 1 }),
      sse("message_delta", { delta: { stop_reason: "tool_use" }, usage: { output_tokens: 20 } }),
      sse("message_stop", {}),
    ];

    const texts = [];
    const out = await streamChat({
      messages: [{ role: "user", content: "hi" }],
      fetchImpl: fakeFetch(chunks),
      onText: (t) => texts.push(t),
    });

    expect(texts.join("")).toBe("Hi there");
    expect(out.stop_reason).toBe("tool_use");
    expect(out.incomplete).toBe(false);
    const toolUse = out.content.find((b) => b.type === "tool_use");
    expect(toolUse).toMatchObject({ id: "tu_1", name: "run_scenario", input: { age: 60 } });
    expect(out.usage.output_tokens).toBe(20);
  });

  it("handles events split across chunk boundaries", async () => {
    const full = sse("content_block_start", { index: 0, content_block: { type: "text", text: "" } }) +
      sse("content_block_delta", { index: 0, delta: { type: "text_delta", text: "ok" } }) +
      sse("message_delta", { delta: { stop_reason: "end_turn" } }) +
      sse("message_stop", {});
    // Slice mid-event to force buffer reassembly.
    const mid = Math.floor(full.length / 2);
    const out = await streamChat({
      messages: [{ role: "user", content: "x" }],
      fetchImpl: fakeFetch([full.slice(0, mid), full.slice(mid)]),
    });
    expect(out.content[0].text).toBe("ok");
    expect(out.stop_reason).toBe("end_turn");
  });

  it("throws a retryable ChatError on a 5xx", async () => {
    await expect(
      streamChat({ messages: [{ role: "user", content: "x" }], fetchImpl: fakeFetch([], { ok: false, status: 503 }) }),
    ).rejects.toMatchObject({ name: "ChatError", retryable: true });
  });

  it("surfaces an SSE error event as a ChatError", async () => {
    await expect(
      streamChat({
        messages: [{ role: "user", content: "x" }],
        fetchImpl: fakeFetch([sse("error", { error: { message: "overloaded" } })]),
      }),
    ).rejects.toBeInstanceOf(ChatError);
  });
});
