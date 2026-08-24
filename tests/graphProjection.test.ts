import { describe, expect, it } from "vitest";
import { projectLinkGraph } from "../src/graph/projection.js";
import type { LinkGraph } from "../src/utils/linkGraph.js";

function graphFixture(): LinkGraph {
  const nodes = [
    {
      title: "中文 A",
      path: "/notes/areas/中文 A.md",
      relPath: "areas/中文 A.md",
      tags: ["中文"],
      headings: [],
    },
    {
      title: "B",
      path: "/notes/projects/B.md",
      relPath: "projects/B.md",
      tags: [],
      headings: ["目标"],
    },
    {
      title: "Index",
      path: "/notes/areas/_index.md",
      relPath: "areas/_index.md",
      tags: [],
      headings: [],
    },
    {
      title: "Old",
      path: "/notes/archives/Old.md",
      relPath: "archives/Old.md",
      tags: [],
      headings: [],
    },
  ];
  const edges = [
    {
      from: nodes[0]!.path,
      fromRel: nodes[0]!.relPath,
      to: nodes[1]!.path,
      toRel: nodes[1]!.relPath,
      text: "B",
      href: "../projects/B.md",
      suffix: "#目标",
      raw: "[B](../projects/B.md#目标)",
      status: "resolved" as const,
    },
    {
      from: nodes[0]!.path,
      fromRel: nodes[0]!.relPath,
      to: nodes[1]!.path,
      toRel: nodes[1]!.relPath,
      text: "B again",
      href: "../projects/B.md",
      suffix: "",
      raw: "[B](../projects/B.md)",
      status: "resolved" as const,
    },
    {
      from: nodes[2]!.path,
      fromRel: nodes[2]!.relPath,
      to: nodes[0]!.path,
      toRel: nodes[0]!.relPath,
      text: "A",
      href: "中文 A.md",
      suffix: "",
      raw: "[A](<中文 A.md>)",
      status: "resolved" as const,
    },
  ];
  return {
    generatedAt: "2026-07-11T00:00:00.000Z",
    nodes,
    edges,
    backlinks: {},
    brokenLinks: [],
    missingHeadingLinks: [],
    orphanNotes: [nodes[3]!],
    orphanStats: {
      all: { notes: 4, orphans: 1, orphanRate: 0.25 },
      active: { notes: 3, orphans: 0, orphanRate: 0 },
      byArea: {},
    },
    nonStandardLinks: [],
    missingAssets: [],
  };
}

describe("graph projection", () => {
  it("uses relative ids, aggregates duplicate edges, and separates index degree", () => {
    const projected = projectLinkGraph(graphFixture());
    expect(JSON.stringify(projected)).not.toContain("/notes/");
    const linkEdges = projected.edges.filter((edge) => edge.kind !== "folder");
    expect(linkEdges).toHaveLength(2);
    expect(linkEdges.find((edge) => edge.kind === "semantic")?.count).toBe(2);
    const a = projected.nodes.find((node) => node.id === "areas/中文 A.md")!;
    expect(a.area).toBe("areas");
    expect(a.semanticDegree).toBe(2);
    expect(a.indexDegree).toBe(1);
    expect(
      projected.nodes.find((node) => node.id === "areas/_index.md")?.isIndex,
    ).toBe(true);
    expect(
      projected.nodes.find((node) => node.id === "archives/Old.md")?.isArchive,
    ).toBe(true);
  });

  it("adds folder nodes and containment edges", () => {
    const projected = projectLinkGraph(graphFixture());
    const folders = projected.nodes.filter((node) => node.isFolder);
    expect(folders.map((node) => node.id)).toEqual([
      "archives",
      "areas",
      "projects",
    ]);
    const folderEdges = projected.edges.filter(
      (edge) => edge.kind === "folder",
    );
    expect(folderEdges).toHaveLength(4);
    expect(
      folderEdges.some(
        (edge) => edge.source === "areas" && edge.target === "areas/中文 A.md",
      ),
    ).toBe(true);
    // 包含关系单独计数，不影响语义/索引度数
    const a = projected.nodes.find((node) => node.id === "areas/中文 A.md")!;
    expect(a.folderDegree).toBe(1);
    expect(a.semanticDegree).toBe(2);
    const areasFolder = folders.find((node) => node.id === "areas")!;
    expect(areasFolder.folderDegree).toBe(2);
    expect(areasFolder.inDegree).toBe(0);
    // 文件夹节点不计入默认可见统计
    expect(projected.stats.visibleNodes).toBe(2);
  });
});
