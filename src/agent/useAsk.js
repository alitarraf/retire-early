// ─────────────────────────────────────────────────────────────
//  useAsk — React hook owning the "Ask" conversation (PRD §4–§8).
//
//  Holds the display transcript, the model history, the structured
//  change log, staged confirmations, token usage, and the session
//  baseline for "Undo all agent changes". Drives runAgentTurn and
//  wires the write-tool actions to the App's input setters.
// ─────────────────────────────────────────────────────────────

import { useCallback, useMemo, useRef, useState } from "react";
import { runAgentTurn } from "./agentLoop.js";
import { buildPlanContext } from "./context.js";
import { setChangeStatus } from "./changeLog.js";
import { getConfirmMode, TOKEN_BUDGET } from "./featureFlags.js";

let _uid = 0;
const uid = () => `ui_${++_uid}`;

export function useAsk({ inputs, plan, results, actions, auth }) {
  const [display, setDisplay] = useState([]); // [{id, role, text, trajectory, incomplete}]
  const [history, setHistory] = useState([]); // model messages
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [changeLog, setChangeLog] = useState([]);
  const [pending, setPending] = useState([]); // staged confirmation cards
  const [usage, setUsage] = useState({ input_tokens: 0, output_tokens: 0 });

  const baselineRef = useRef(null); // inputs snapshot before first agent mutation
  const lastUserText = useRef("");
  const confirmMode = getConfirmMode();

  const totalTokens = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
  const tokenWarn = totalTokens >= TOKEN_BUDGET.warnAt;
  const tokenStopped = totalTokens >= TOKEN_BUDGET.hardStopAt;

  const snapshotBaseline = useCallback(() => {
    if (baselineRef.current == null) baselineRef.current = actions.getInputs();
  }, [actions]);

  // Undo all agent changes (§4.3) — restore the original-inputs baseline.
  // Defined before writeActions: the revert_changes tool routes through it.
  const undoAll = useCallback(() => {
    if (baselineRef.current != null) actions.restoreInputs(baselineRef.current);
    baselineRef.current = null;
    setChangeLog((log) =>
      log.map((e) => (e.status === "applied" || e.status === "awaiting_confirmation" ? { ...e, status: "reverted" } : e)),
    );
    setPending([]);
  }, [actions]);

  // Write-tool actions (snapshot the baseline on first mutation). View
  // navigation deliberately takes no snapshot — it isn't a plan mutation.
  const writeActions = useMemo(
    () => ({
      applyInputs: (patch) => {
        snapshotBaseline();
        actions.applyInputs(patch);
      },
      applyAge: (age) => {
        snapshotBaseline();
        actions.applyAge(age);
      },
      applyScenario: (patch) => {
        snapshotBaseline();
        actions.applyScenario(patch);
      },
      setView: (tab) => actions.setView?.(tab),
      triggerMc: () => actions.triggerMc?.(),
      undoAllAgentChanges: undoAll,
    }),
    [actions, snapshotBaseline, undoAll],
  );

  const send = useCallback(
    async (rawText) => {
      const text = (rawText ?? "").trim();
      if (!text || streaming || tokenStopped) return;
      lastUserText.current = text;
      setError(null);

      const userId = uid();
      const assistantId = uid();
      setDisplay((d) => [
        ...d,
        { id: userId, role: "user", text },
        { id: assistantId, role: "assistant", text: "", trajectory: [], incomplete: false, _raw: "", actions: [] },
      ]);
      setStreaming(true);

      const planContext = buildPlanContext(inputs, plan, results, changeLog);

      try {
        const out = await runAgentTurn({
          userText: text,
          history,
          planContext,
          plan,
          changeLog,
          confirmMode,
          authToken: auth?.getToken?.() ?? undefined,
          actions: writeActions,
          stageConfirmation: (card) => {
            setPending((p) => [...p, { id: uid(), ...card }]);
          },
          callbacks: {
            // Accumulate the RAW stream, then split off the trailing action-chip
            // comment (parseActions) so it's never shown as text and its chips
            // ride along on the message.
            onText: (t) =>
              setDisplay((d) =>
                d.map((m) => {
                  if (m.id !== assistantId) return m;
                  const raw = (m._raw ?? m.text ?? "") + t;
                  const { text, actions } = parseActions(raw);
                  return { ...m, _raw: raw, text, actions };
                }),
              ),
            onToolResult: (step) =>
              setDisplay((d) =>
                d.map((m) => (m.id === assistantId ? { ...m, trajectory: [...m.trajectory, step] } : m)),
              ),
          },
        });

        setHistory(out.messages);
        setChangeLog(out.changeLog);
        setUsage((u) => ({
          input_tokens: (u.input_tokens ?? 0) + (out.usage.input_tokens ?? 0),
          output_tokens: (u.output_tokens ?? 0) + (out.usage.output_tokens ?? 0),
        }));
        if (out.incomplete || out.hitCeiling) {
          setDisplay((d) => d.map((m) => (m.id === assistantId ? { ...m, incomplete: true } : m)));
        }
        auth?.onTurnComplete?.(); // refresh the prompt counter (§10.5)
      } catch (e) {
        // Entitlement wall (§10): no quota was burned. Surface the sign-up/paywall
        // card, drop the optimistic bubbles, and keep the text for auto-resend
        // once the gate clears — not a generic error.
        if (e?.status === 401 || e?.status === 402) {
          setDisplay((d) => d.filter((m) => m.id !== assistantId && m.id !== userId));
          auth?.onBlocked?.({ status: e.status, text });
        } else {
          // Network/proxy error: preserve the typed message, mark retryable (§7).
          setError({ message: e?.message ?? "Something went wrong.", retryable: e?.retryable ?? true });
          // Drop the empty assistant bubble so retry reuses the same question.
          setDisplay((d) => d.filter((m) => m.id !== assistantId));
        }
      } finally {
        setStreaming(false);
      }
    },
    [streaming, tokenStopped, inputs, plan, results, history, changeLog, confirmMode, writeActions, auth],
  );

  const retry = useCallback(() => {
    if (lastUserText.current) {
      // Remove the failed user bubble (last one) so send re-adds it cleanly.
      setDisplay((d) => {
        const idx = [...d].reverse().findIndex((m) => m.role === "user");
        if (idx === -1) return d;
        return d.slice(0, d.length - 1 - idx);
      });
      const t = lastUserText.current;
      setError(null);
      send(t);
    }
  }, [send]);

  // Confirmation cards (§4.2).
  const confirm = useCallback(
    (pendingId) => {
      const card = pending.find((p) => p.id === pendingId);
      if (!card) return;
      if (card.kind === "revert") {
        // undoAll restores the baseline, flips every applied/awaiting entry
        // to reverted, and clears all pending cards (including this one).
        undoAll();
        return;
      }
      snapshotBaseline();
      if (card.kind === "inputs") actions.applyInputs(card.payload);
      else if (card.kind === "age") actions.applyAge(card.payload);
      else if (card.kind === "scenario") actions.applyScenario(card.payload);
      setChangeLog((log) => card.changes.reduce((l, ch) => setChangeStatus(l, ch.id, "applied"), log));
      setPending((p) => p.filter((x) => x.id !== pendingId));
    },
    [pending, actions, snapshotBaseline, undoAll],
  );

  const reject = useCallback(
    (pendingId) => {
      const card = pending.find((p) => p.id === pendingId);
      if (!card) return;
      setChangeLog((log) => card.changes.reduce((l, ch) => setChangeStatus(l, ch.id, "rejected"), log));
      setPending((p) => p.filter((x) => x.id !== pendingId));
    },
    [pending],
  );

  // Per-row revert (§4.3) — set the field back to its pre-change value.
  const revertChange = useCallback(
    (id) => {
      const entry = changeLog.find((e) => e.id === id);
      if (!entry || entry.status !== "applied") return;
      if (entry.scope === "age") actions.applyAge(entry.from);
      else actions.applyInputs({ [entry.field]: entry.from });
      setChangeLog((log) => setChangeStatus(log, id, "reverted"));
    },
    [changeLog, actions],
  );

  // Start a fresh conversation (§9 soft/hard token budget escape hatch).
  // Clears the transcript, model history, staged cards, and the token
  // counter (which is what actually clears the budget notice). Deliberately
  // KEEPS the applied plan changes, the baseline, and the audit trail — a new
  // conversation must not silently revert edits the user accepted ("Undo all"
  // is the separate control for that). Any change still awaiting confirmation
  // is marked rejected so an abandoned card can't leak into the next
  // conversation's change log / get_change_log.
  const reset = useCallback(() => {
    if (streaming) return; // never reset mid-stream (would orphan the in-flight turn)
    setDisplay([]);
    setHistory([]);
    setError(null);
    setPending([]);
    setUsage({ input_tokens: 0, output_tokens: 0 });
    lastUserText.current = "";
    setChangeLog((log) =>
      log.map((e) => (e.status === "awaiting_confirmation" ? { ...e, status: "rejected" } : e)),
    );
  }, [streaming]);

  const appliedCount = changeLog.filter((e) => e.status === "applied").length;
  const hasChanges = appliedCount > 0 || pending.length > 0;

  return {
    display,
    streaming,
    error,
    changeLog,
    appliedCount,
    pending,
    usage,
    totalTokens,
    tokenWarn,
    tokenStopped,
    hasChanges,
    send,
    retry,
    confirm,
    reject,
    revertChange,
    undoAll,
    reset,
  };
}

// The model appends a "<!--actions: a | b | c-->" comment naming the 2–3 next
// steps most relevant to what it just said (see systemPrompt.js). parseActions
// splits raw assistant text into the visible prose + those chips.
//
// _raw accumulates across EVERY loop iteration of a turn (agentLoop streams
// text, calls a tool, streams more), so a comment can land mid-string — before
// a tool call — not only at the end. We therefore strip ALL closed comments
// (the LAST one wins as the chips) rather than anchoring at $. MiniMarkdown
// renders an unknown HTML comment verbatim, so a not-yet-closed marker must be
// hidden the instant "<!--" appears; a truncated block (max_tokens cut before
// "-->") thus yields no chips → the caller falls back to followUpChips.
const ACTIONS_BLOCK = /\n*[ \t]*<!--\s*actions\s*:\s*([\s\S]*?)-->[ \t]*/gi;
// A trailing, not-yet-closed "<!--", optionally partway through "actions:...".
const ACTIONS_PARTIAL = /\n*[ \t]*<!--(?:\s*a(?:c(?:t(?:i(?:o(?:n(?:s(?:\s*:[\s\S]*)?)?)?)?)?)?)?)?$/i;

export function parseActions(raw = "") {
  let actions = [];
  let text = raw.replace(ACTIONS_BLOCK, (_m, body) => {
    actions = body
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    return "\n"; // keep a paragraph break for a mid-text comment; trimmed if trailing
  });
  // Hide a trailing, still-open marker (mid-stream or a max_tokens-truncated block).
  const partial = text.match(ACTIONS_PARTIAL);
  if (partial) text = text.slice(0, partial.index);
  return { text: text.replace(/\s+$/, ""), actions };
}

// Re-phrase an assistant-voiced option ("keeping your income low") as a user
// reply ("keeping my income low") so a clicked chip reads naturally.
function asUserVoice(s) {
  return s
    .replace(/\byou['’]re\b/gi, "I'm")
    .replace(/\byour\b/gi, "my")
    .replace(/\byou\b/gi, "I");
}

/**
 * Clickable follow-up suggestions shown under the latest assistant turn (§8.3).
 * If the assistant posed an either/or question with **bold** options, surface
 * each option as a chip; otherwise fall back to contextual next-steps from the
 * current results.
 */
export function followUpChips(text = "", results = {}, inputs = {}) {
  const bolds = [...text.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1].trim());
  // Option-like = a multi-word phrase, not a number/figure emphasis.
  const options = bolds.filter((b) => b.split(/\s+/).length >= 4 && !/\$|\d{2,}/.test(b));
  if (text.includes("?") && options.length >= 2) {
    return options.slice(0, 3).map((o) => {
      const v = asUserVoice(o).trim();
      return v.charAt(0).toUpperCase() + v.slice(1);
    });
  }
  const chips = [];
  if (results.earliest != null && results.earliest < inputs.retireAge) {
    chips.push(`Show me retiring at ${results.earliest}`);
  }
  if (results.mcSuccess != null && results.mcSuccess < 0.8) chips.push("How do I de-risk my plan?");
  chips.push("What if I delay Social Security to 70?");
  chips.push("Lower my spending until the plan is safe");
  return [...new Set(chips)].slice(0, 3);
}

// Suggested starter prompts derived from the current results (§8.3).
export function suggestedPrompts(results = {}, inputs = {}) {
  const out = [];
  if (results.earliest != null && results.earliest < inputs.retireAge) {
    out.push(`Can I retire sooner than ${inputs.retireAge}?`);
  }
  if (results.mcSuccess != null && results.mcSuccess < 0.8) {
    out.push("How do I de-risk my plan?");
  }
  if (results.survives === false) {
    out.push("Why does my money run out, and how do I fix it?");
  }
  out.push("What if the market crashes the year I retire?");
  out.push("How can I lower my lifetime taxes?");
  return out.slice(0, 4);
}
