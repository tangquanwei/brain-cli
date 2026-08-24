import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildLinkGraph, buildOrphanStats } from "../src/utils/linkGraph.js";
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

describe("Obsidian-compatible link graph", () => {
  const tempDirs: string[] = [];

  function vault(): string {
    const dir = mkdtempSync(join(tmpdir(), "brain-cli-link-graph-"));
    tempDirs.push(dir);
    return dir;
  }

  function write(root: string, rel: string, content: string): void {
    const path = join(root, rel);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content, "utf8");
  }

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves WikiLinks, note embeds, headings, blocks, and images", () => {
    const dir = vault();
    write(
      dir,
      "areas/Target Note.md",
      "# Target\n\n## Heading One\n\nA reusable block. ^block-1\n",
    );
    write(
      dir,
      "projects/Source.md",
      [
        "[[areas/Target Note#Heading One|Alias]]",
        "[[Target Note#^block-1]]",
        "![[Target Note#Heading One]]",
        "![[assets/present.png]]",
        "![missing](missing.png)",
      ].join("\n"),
    );
    write(dir, "assets/present.png", "image");

    const graph = buildLinkGraph(dir);

    expect(graph.edges).toHaveLength(3);
    expect(graph.edges.every((edge) => edge.status === "resolved")).toBe(true);
    expect(graph.edges.every((edge) => edge.syntax === "wikilink")).toBe(true);
    expect(graph.backlinks["areas/Target Note.md"]).toHaveLength(3);
    expect(graph.missingHeadingLinks).toHaveLength(0);
    expect(graph.missingAssets.map((asset) => asset.target)).toEqual([
      "missing.png",
    ]);
    expect(graph.nonStandardLinks).toHaveLength(0);
  });

  it("reports broken, ambiguous, missing-reference, and missing-asset cases", () => {
    const dir = vault();
    write(dir, "a/Duplicate.md", "# A\n");
    write(dir, "b/Duplicate.md", "# B\n");
    write(
      dir,
      "Source.md",
      [
        "[[Duplicate]]",
        "[[Ghost]]",
        "[[a/Duplicate#Absent]]",
        "![[missing.png]]",
      ].join("\n"),
    );

    const graph = buildLinkGraph(dir);

    expect(graph.brokenLinks).toHaveLength(2);
    expect(graph.nonStandardLinks).toHaveLength(1);
    expect(graph.nonStandardLinks[0]?.reason).toBe("ambiguous");
    expect(graph.missingHeadingLinks).toHaveLength(1);
    expect(graph.missingAssets).toHaveLength(1);
  });

  it("validates same-note heading and block anchors", () => {
    const dir = vault();
    write(
      dir,
      "Note.md",
      "# Note\n\n## Existing\n\nText ^known\n\n[ok](#existing) [block](#^known) [bad](#missing)\n",
    );

    const graph = buildLinkGraph(dir);
    expect(graph.missingHeadingLinks).toHaveLength(1);
    expect(graph.missingHeadingLinks[0]?.suffix).toBe("#missing");
  });
});
