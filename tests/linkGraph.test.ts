import { describe, expect, it } from "vitest";
import { buildOrphanStats } from "../src/utils/linkGraph.js";
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

describe("linkGraph orphan statistics", () => {
  it("separates active PARA notes from archives and root files", () => {
    const nodes = [
      note("projects/a.md"),
      note("areas/b.md"),
      note("archives/2025/c.md"),
      note("README.md"),
    ];
    const stats = buildOrphanStats(nodes, [nodes[0]!, nodes[2]!, nodes[3]!]);

    expect(stats.all).toEqual({ notes: 4, orphans: 3, orphanRate: 0.75 });
    expect(stats.active).toEqual({ notes: 2, orphans: 1, orphanRate: 0.5 });
    expect(stats.byArea.archives).toEqual({
      notes: 1,
      orphans: 1,
      orphanRate: 1,
    });
    expect(stats.byArea.root).toEqual({ notes: 1, orphans: 1, orphanRate: 1 });
  });
});
