// Tiny dependency-free markdown renderer for assistant messages. Handles the
// subset Haiku actually emits: paragraphs, bullet/numbered lists, **bold**,
// `code`, and # headings. Builds React elements (text is auto-escaped — no raw
// HTML injection). Re-runs cheaply on every streamed token.
import { neutral } from "../../theme.js";

// **bold**, `code`, and _italic_. Italic is rendered muted — the agent uses it
// to mark external/general estimates ("not from your plan"), so provenance
// reads as a visual side-note. The italic boundary requires whitespace/start so
// snake_case identifiers (which the agent puts in `code` anyway) aren't matched.
function inline(text, keyBase) {
  const nodes = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|(?:^|(?<=\s))_([^_\n]+?)_(?=$|[\s.,!?;:)])/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] != null) nodes.push(<strong key={`${keyBase}-b${i++}`}>{m[1]}</strong>);
    else if (m[2] != null)
      nodes.push(
        <code key={`${keyBase}-c${i++}`} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.92em", background: neutral.fill, padding: "0 3px", borderRadius: 3 }}>
          {m[2]}
        </code>,
      );
    else if (m[3] != null)
      nodes.push(
        <em key={`${keyBase}-i${i++}`} style={{ fontStyle: "italic", color: neutral.textMuted }}>
          {m[3]}
        </em>,
      );
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MiniMarkdown({ text }) {
  const lines = (text ?? "").split("\n");
  const blocks = [];
  let para = [];
  let list = null; // { type: "ul" | "ol", items: [] }

  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", lines: para });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const num = line.match(/^\s*\d+\.\s+(.*)$/);
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ type: "h", text: heading[1] });
    } else if (bullet) {
      flushPara();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(bullet[1]);
    } else if (num) {
      flushPara();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(num[1]);
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return (
    <>
      {blocks.map((b, bi) => {
        if (b.type === "h") {
          return (
            <div key={bi} style={{ fontWeight: 700, color: neutral.ink, margin: "8px 0 4px" }}>
              {inline(b.text, `h${bi}`)}
            </div>
          );
        }
        if (b.type === "p") {
          return (
            <p key={bi} style={{ margin: "0 0 8px" }}>
              {b.lines.map((ln, li) => (
                <span key={li}>
                  {inline(ln, `p${bi}-${li}`)}
                  {li < b.lines.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
          );
        }
        const Tag = b.type === "ol" ? "ol" : "ul";
        return (
          <Tag key={bi} style={{ margin: "0 0 8px", paddingLeft: 20 }}>
            {b.items.map((it, ii) => (
              <li key={ii} style={{ marginBottom: 2 }}>
                {inline(it, `l${bi}-${ii}`)}
              </li>
            ))}
          </Tag>
        );
      })}
    </>
  );
}
