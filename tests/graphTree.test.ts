import { describe, expect, it } from "vitest";
import { buildDirectoryTree } from "../src/graph/tree.js";
import type { NoteNode } from "../src/utils/noteIndex.js";

function note(relPath: string): NoteNode {
  return {
    title: relPath,
    path: `/notes/${relPath}`,
    relPath,
    tags: [],
    headings: [],
  };
}

describe("directory tree", () => {
  it("uses relative note ids and counts nested notes", () => {
    const tree = buildDirectoryTree([
      note("areas/NLP/Tokenizer.md"),
      note("areas/数学/SVD.md"),
      note("projects/OmniRAG.md"),
    ]);
    expect(tree.noteCount).toBe(3);
    expect(JSON.stringify(tree)).not.toContain("/notes/");
    const areas = tree.children.find(
      (child) => child.type === "folder" && child.name === "areas",
    );
    expect(areas?.type === "folder" && areas.noteCount).toBe(2);
  });
});
