import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { MiniMarkdown } from "../components/panels/MiniMarkdown.jsx";

describe("MiniMarkdown — assistant message formatting", () => {
  it("renders bold, bullet and numbered lists, code, and headings", () => {
    const md = [
      "## The core problem",
      "",
      "You spend **$14,258/month**.",
      "",
      "- Retire later",
      "- Spend less",
      "",
      "1. First",
      "2. Second",
      "",
      "Set `monthlyExpense` lower.",
    ].join("\n");
    const html = renderToString(<MiniMarkdown text={md} />);
    expect(html).toContain("<strong>$14,258/month</strong>");
    expect(html).toContain("<ul");
    expect(html).toContain("<ol");
    expect(html).toContain("<li");
    expect(html).toContain("<code");
    expect(html).toContain("The core problem");
  });

  it("renders _italic_ provenance notes as muted emphasis", () => {
    const html = renderToString(
      <MiniMarkdown text={"Benefits rise about 24% _(general estimate — not from your plan)_."} />,
    );
    expect(html).toContain("<em");
    expect(html).toContain("general estimate");
  });

  it("does NOT italicize snake_case identifiers", () => {
    const html = renderToString(<MiniMarkdown text={"Set some_field_name and another_one lower."} />);
    expect(html).not.toContain("<em");
  });

  it("escapes HTML (no injection)", () => {
    const html = renderToString(<MiniMarkdown text={"<script>alert(1)</script>"} />);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("handles empty / plain text", () => {
    expect(renderToString(<MiniMarkdown text="" />)).toBeDefined();
    expect(renderToString(<MiniMarkdown text="just a sentence" />)).toContain("just a sentence");
  });
});
