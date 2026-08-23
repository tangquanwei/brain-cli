import { describe, expect, it } from "vitest";
import { isReviewableNoteName } from "../src/commands/review.js";

describe("review note filtering", () => {
  it("excludes navigation and repository documentation", () => {
    expect(isReviewableNoteName("_index.md")).toBe(false);
    expect(isReviewableNoteName("INDEX.md")).toBe(false);
    expect(isReviewableNoteName("README.md")).toBe(false);
  });

  it("keeps real notes whose names start with an underscore", () => {
    expect(isReviewableNoteName("_思必驰 ASR + RAG 项目.md")).toBe(true);
  });

  it("ignores non-Markdown files", () => {
    expect(isReviewableNoteName("index.json")).toBe(false);
  });
});
