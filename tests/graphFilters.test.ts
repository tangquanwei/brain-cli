import { describe, expect, it } from "vitest";
import { filterGraphView, localGraphIds } from "../src/graph/filters.js";
import type { GraphViewData } from "../src/graph/projection.js";

const data: GraphViewData = {
  generatedAt: "x",
  nodes: [
    {
      id: "projects/a.md",
      title: "a",
      area: "projects",
      tags: [],
      inDegree: 1,
      outDegree: 1,
      semanticDegree: 1,
      indexDegree: 1,
      folderDegree: 0,
      isArchive: false,
      isIndex: false,
      isFolder: false,
    },
    {
      id: "areas/b.md",
      title: "b",
      area: "areas",
      tags: [],
      inDegree: 1,
      outDegree: 1,
      semanticDegree: 2,
      indexDegree: 0,
      folderDegree: 0,
      isArchive: false,
      isIndex: false,
      isFolder: false,
    },
    {
      id: "areas/_index.md",
      title: "index",
      area: "areas",
      tags: [],
      inDegree: 0,
      outDegree: 1,
      semanticDegree: 0,
      indexDegree: 1,
      folderDegree: 0,
      isArchive: false,
      isIndex: true,
      isFolder: false,
    },
    {
      id: "archives/c.md",
      title: "c",
      area: "archives",
      tags: [],
      inDegree: 1,
      outDegree: 0,
      semanticDegree: 1,
      indexDegree: 0,
      folderDegree: 0,
      isArchive: true,
      isIndex: false,
      isFolder: false,
    },
  ],
  edges: [
    {
      id: "1",
      source: "projects/a.md",
      target: "areas/b.md",
      label: "b",
      count: 1,
      kind: "semantic",
    },
    {
      id: "2",
      source: "areas/b.md",
      target: "archives/c.md",
      label: "c",
      count: 1,
      kind: "semantic",
    },
    {
      id: "3",
      source: "areas/_index.md",
      target: "projects/a.md",
      label: "a",
      count: 1,
      kind: "index",
    },
  ],
  stats: { nodes: 4, edges: 3, visibleNodes: 2, visibleEdges: 1 },
};

describe("graph filters", () => {
  it("defaults to active semantic nodes", () => {
    const filtered = filterGraphView(data, {
      scope: "active",
      includeIndex: false,
      includeIsolated: false,
    });
    expect(filtered.nodes.map((node) => node.id)).toEqual([
      "projects/a.md",
      "areas/b.md",
    ]);
    expect(filtered.edges.map((edge) => edge.id)).toEqual(["1"]);
  });

  it("builds one and two hop local graphs", () => {
    expect([...localGraphIds(data, "projects/a.md", 1)].sort()).toEqual([
      "areas/b.md",
      "projects/a.md",
    ]);
    expect([...localGraphIds(data, "projects/a.md", 2)].sort()).toEqual([
      "archives/c.md",
      "areas/b.md",
      "projects/a.md",
    ]);
  });

  it("hides folder nodes by default and includes them with includeFolders", () => {
    const withFolder: GraphViewData = {
      ...data,
      nodes: [
        ...data.nodes,
        {
          id: "areas",
          title: "areas",
          area: "areas" as const,
          tags: [],
          inDegree: 0,
          outDegree: 0,
          semanticDegree: 0,
          indexDegree: 0,
          folderDegree: 1,
          isArchive: false,
          isIndex: false,
          isFolder: true,
        },
      ],
      edges: [
        ...data.edges,
        {
          id: "4",
          source: "areas",
          target: "areas/b.md",
          label: "包含",
          count: 1,
          kind: "folder" as const,
        },
      ],
    };
    const off = filterGraphView(withFolder, {
      scope: "all",
      includeIndex: true,
      includeIsolated: true,
    });
    expect(off.nodes.some((node) => node.isFolder)).toBe(false);
    expect(off.edges.some((edge) => edge.kind === "folder")).toBe(false);

    const on = filterGraphView(withFolder, {
      scope: "all",
      includeIndex: true,
      includeIsolated: false,
      includeFolders: true,
    });
    // 文件夹节点靠包含关系计入度数，无需 includeIsolated 即可见
    expect(on.nodes.some((node) => node.id === "areas")).toBe(true);
    expect(on.edges.some((edge) => edge.kind === "folder")).toBe(true);

    // 局部图谱：文件夹边可选遍历
    expect([...localGraphIds(withFolder, "areas/b.md", 1)].sort()).toEqual([
      "archives/c.md",
      "areas/b.md",
      "projects/a.md",
    ]);
    expect([
      ...localGraphIds(withFolder, "areas/b.md", 1, false, true),
    ]).toContain("areas");
  });
});
