import { describe, expect, it } from "vitest";
import { relative, resolve } from "node:path";
import { extractMarkdownLinks } from "../src/utils/markdownLinks.js";
import { toPosixPath } from "../src/utils/noteIndex.js";

describe("relative markdown links", () => {
  it("can be recomputed after moving a target note", () => {
    const source = resolve("/notes/areas/模型训练/Tokenizer.md");
    const newTarget = resolve("/notes/resources/模型训练/Padding.md");
    const href = toPosixPath(relative(resolve("/notes/areas/模型训练"), newTarget));
    expect(href).toBe("../../resources/模型训练/Padding.md");
    expect(extractMarkdownLinks(`[Padding](${href})`)[0]?.kind).toBe("note");
  });
});
