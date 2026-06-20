// ─────────────────────────────────────────────────────────────
//  chatClient (PRD §11) — fetch wrapper around the /api/chat proxy
//  with SSE parsing. The proxy injects the API key and pipes the
//  Anthropic SSE stream back unchanged; we parse it here.
//
//  Assembles streamed content blocks into a final assistant message
//  { role, content: [...], stop_reason, usage } and fires onText /
//  onToolUse callbacks for live rendering. Tool_use inputs arrive as
//  partial JSON across input_json_delta events and are parsed on
//  content_block_stop.
// ─────────────────────────────────────────────────────────────

export const CHAT_ENDPOINT = "/api/chat";
export const HAIKU_MODEL = "claude-haiku-4-5";

export class ChatError extends Error {
  constructor(message, { retryable = false, status } = {}) {
    super(message);
    this.name = "ChatError";
    this.retryable = retryable;
    this.status = status;
  }
}

/**
 * Stream one model turn through the proxy.
 * @returns {Promise<{content: Array, stop_reason: string|null, usage: object, incomplete: boolean}>}
 */
export async function streamChat({
  system,
  tools,
  messages,
  model = HAIKU_MODEL,
  maxTokens = 1024,
  signal,
  onText,
  onToolUseStart,
  authToken,
  fetchImpl = fetch,
} = {}) {
  let resp;
  try {
    const headers = { "content-type": "application/json" };
    if (authToken) headers.authorization = `Bearer ${authToken}`;
    resp = await fetchImpl(CHAT_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, max_tokens: maxTokens, system, tools, messages }),
      signal,
      credentials: "same-origin", // send the anon device cookie
    });
  } catch (e) {
    throw new ChatError(`Couldn't reach the assistant — ${e?.message ?? "network error"}.`, { retryable: true });
  }

  if (!resp.ok) {
    let detail = "";
    try {
      detail = (await resp.text())?.slice(0, 300) ?? "";
    } catch {
      /* ignore */
    }
    const retryable = resp.status === 429 || resp.status >= 500;
    throw new ChatError(`Assistant request failed (${resp.status}). ${detail}`, { retryable, status: resp.status });
  }
  if (!resp.body) throw new ChatError("Empty response stream.", { retryable: true });

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const content = [];
  const jsonBuffers = {}; // index → accumulated tool_use input JSON
  let stopReason = null;
  let usage = {};
  let incomplete = false;

  const handleEvent = (raw) => {
    // Each SSE block: lines of "event: X" / "data: {...}".
    let dataStr = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith("data:")) dataStr += line.slice(5).trim();
    }
    if (!dataStr) return;
    let evt;
    try {
      evt = JSON.parse(dataStr);
    } catch {
      return;
    }
    switch (evt.type) {
      case "message_start":
        usage = { ...(evt.message?.usage ?? {}) };
        break;
      case "content_block_start": {
        const block = evt.content_block ?? {};
        if (block.type === "tool_use") {
          content[evt.index] = { type: "tool_use", id: block.id, name: block.name, input: {} };
          jsonBuffers[evt.index] = "";
          onToolUseStart?.({ id: block.id, name: block.name });
        } else if (block.type === "text") {
          content[evt.index] = { type: "text", text: "" };
        } else {
          // thinking or other — keep a placeholder so indices line up.
          content[evt.index] = { type: block.type ?? "unknown", ...block };
        }
        break;
      }
      case "content_block_delta": {
        const d = evt.delta ?? {};
        if (d.type === "text_delta") {
          const b = content[evt.index];
          if (b && b.type === "text") b.text += d.text;
          onText?.(d.text);
        } else if (d.type === "input_json_delta") {
          jsonBuffers[evt.index] = (jsonBuffers[evt.index] ?? "") + (d.partial_json ?? "");
        }
        break;
      }
      case "content_block_stop": {
        const b = content[evt.index];
        if (b && b.type === "tool_use") {
          const raw = jsonBuffers[evt.index] ?? "";
          try {
            b.input = raw ? JSON.parse(raw) : {};
          } catch {
            b.input = {};
          }
        }
        break;
      }
      case "message_delta":
        if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
        if (evt.usage) usage = { ...usage, ...evt.usage };
        break;
      case "error":
        throw new ChatError(evt.error?.message ?? "Assistant stream error.", { retryable: true });
      case "message_stop":
      default:
        break;
    }
  };

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        handleEvent(raw);
      }
    }
    if (buffer.trim()) handleEvent(buffer);
  } catch (e) {
    if (e instanceof ChatError) throw e;
    // Partial stream: render what arrived, mark incomplete (§7).
    incomplete = true;
  }

  if (stopReason == null) incomplete = true;

  return {
    content: content.filter(Boolean),
    stop_reason: stopReason,
    usage,
    incomplete,
  };
}
