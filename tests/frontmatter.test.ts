import { describe, it, expect } from "vitest";
import { parseFrontmatter, normalizeTags, extractSummary } from "../src/utils/frontmatter.js";

describe("frontmatter", () => {
  it("parses quoted strings", () => {
    const raw = `---\ntitle: "Hello"\ndate: "2025-06-05 10:30"\n---\n\nbody`;
    const { data, content } = parseFrontmatter(raw);
    expect(data.title).toBe("Hello");
    expect(content.trim()).toBe("body");
  });

  it("normalizes tag arrays and strings", () => {
    expect(normalizeTags(["a", "b"])).toEqual(["a", "b"]);
    expect(normalizeTags("a, b, c")).toEqual(["a", "b", "c"]);
    expect(normalizeTags("[ASR, LLM]")).toEqual(["ASR", "LLM"]);
    expect(normalizeTags(undefined)).toEqual([]);
  });

  it("extracts summary skipping headings", () => {
    const s = extractSummary("# Title\n\nFirst line\nSecond line\n");
    expect(s).toContain("First line");
  });
});
