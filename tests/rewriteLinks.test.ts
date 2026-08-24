import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractMarkdownLinks } from "../src/utils/markdownLinks.js";
import { toPosixPath } from "../src/utils/noteIndex.js";
import { settings } from "../src/config.js";
import {
  applyNoteMovePlan,
  buildNoteMovePlan,
} from "../src/utils/rewriteLinks.js";

describe("relative markdown links", () => {
  it("can be recomputed after moving a target note", () => {
    const source = resolve("/notes/areas/模型训练/Tokenizer.md");
    const newTarget = resolve("/notes/resources/模型训练/Padding.md");
    const href = toPosixPath(
      relative(resolve("/notes/areas/模型训练"), newTarget),
    );
    expect(href).toBe("../../resources/模型训练/Padding.md");
    expect(extractMarkdownLinks(`[Padding](${href})`)[0]?.kind).toBe("note");
  });

  it("rewrites Obsidian WikiLinks and note embeds during a rename", () => {
    const dir = mkdtempSync(join(tmpdir(), "brain-cli-rewrite-wiki-"));
    const originalNotesDir = settings.notesDir;
    try {
      settings.notesDir = dir;
      mkdirSync(join(dir, "areas"), { recursive: true });
      mkdirSync(join(dir, "projects"), { recursive: true });
      const oldPath = join(dir, "areas", "Old.md");
      const newPath = join(dir, "areas", "New.md");
      const refPath = join(dir, "projects", "Reference.md");
      writeFileSync(oldPath, "# Old\n\n## Intro\n", "utf8");
      writeFileSync(
        refPath,
        ["[[Old#Intro|Read]]", "![[Old]]", "[Old](../areas/Old.md#intro)"].join(
          "\n",
        ),
        "utf8",
      );

      const plan = buildNoteMovePlan(oldPath, newPath);
      expect(plan.linkRewrites).toHaveLength(3);
      applyNoteMovePlan(plan);

      const rewritten = readFileSync(refPath, "utf8");
      expect(rewritten).toContain("[[areas/New#Intro|Read]]");
      expect(rewritten).toContain("![[areas/New]]");
      expect(rewritten).toContain("[Old](../areas/New.md#intro)");
    } finally {
      settings.notesDir = originalNotesDir;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
