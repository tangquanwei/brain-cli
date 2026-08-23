import { basename } from "node:path";
import type { LinkGraph } from "../utils/linkGraph.js";

export type GraphArea =
  | "projects"
  | "areas"
  | "resources"
  | "questions"
  | "archives"
  | "root";

export interface GraphViewNode {
  id: string;
  title: string;
  area: GraphArea;
  tags: string[];
  inDegree: number;
  outDegree: number;
  semanticDegree: number;
  indexDegree: number;
  folderDegree: number;
  isArchive: boolean;
  isIndex: boolean;
  isFolder: boolean;
}

export interface GraphViewEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  heading?: string;
  count: number;
  kind: "semantic" | "index" | "folder";
}

export interface GraphViewData {
  generatedAt: string;
  nodes: GraphViewNode[];
  edges: GraphViewEdge[];
  stats: {
    nodes: number;
    edges: number;
    visibleNodes: number;
    visibleEdges: number;
  };
}

export function graphArea(relPath: string): GraphArea {
  const first = relPath.split("/")[0];
  if (
    first === "projects" ||
    first === "areas" ||
    first === "resources" ||
    first === "questions" ||
    first === "archives"
  ) {
    return first;
  }
  return "root";
}

export function isGraphIndex(relPath: string): boolean {
  const name = basename(relPath).toLowerCase();
  return name === "_index.md" || name === "index.md" || name === "readme.md";
}

function headingFromSuffix(suffix: string): string | undefined {
  if (!suffix.startsWith("#")) return undefined;
  const value = suffix.slice(1).split("?")[0];
  return value ? decodeURIComponent(value) : undefined;
}

function parentDir(relPath: string): string | null {
  const idx = relPath.lastIndexOf("/");
  return idx < 0 ? null : relPath.slice(0, idx);
}

/** 收集所有笔记的祖先目录（不含根），如 areas/x/note.md → ["areas", "areas/x"] */
function collectFolderPaths(graph: LinkGraph): string[] {
  const folders = new Set<string>();
  for (const node of graph.nodes) {
    let dir = parentDir(node.relPath);
    while (dir) {
      folders.add(dir);
      dir = parentDir(dir);
    }
  }
  return [...folders].sort();
}

export function projectLinkGraph(graph: LinkGraph): GraphViewData {
  const aggregated = new Map<string, GraphViewEdge>();
  const resolvedEdges = graph.edges.filter(
    (edge) => edge.status === "resolved" && edge.toRel,
  );

  for (const edge of resolvedEdges) {
    const target = edge.toRel!;
    const key = JSON.stringify([edge.fromRel, target]);
    const existing = aggregated.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    aggregated.set(key, {
      id: "",
      source: edge.fromRel,
      target,
      label: edge.text,
      heading: headingFromSuffix(edge.suffix),
      count: 1,
      kind:
        isGraphIndex(edge.fromRel) || isGraphIndex(target)
          ? "index"
          : "semantic",
    });
  }

  const linkEdges = [...aggregated.values()].sort((a, b) =>
    JSON.stringify([a.source, a.target]).localeCompare(
      JSON.stringify([b.source, b.target]),
    ),
  );

  // 文件夹包含关系：文件夹 → 直接子笔记 / 子文件夹
  const folderPaths = collectFolderPaths(graph);
  const folderSet = new Set(folderPaths);
  const folderEdges: GraphViewEdge[] = [];
  for (const node of graph.nodes) {
    const dir = parentDir(node.relPath);
    if (dir) {
      folderEdges.push({
        id: "",
        source: dir,
        target: node.relPath,
        label: "包含",
        count: 1,
        kind: "folder",
      });
    }
  }
  for (const folder of folderPaths) {
    const parent = parentDir(folder);
    if (parent && folderSet.has(parent)) {
      folderEdges.push({
        id: "",
        source: parent,
        target: folder,
        label: "包含",
        count: 1,
        kind: "folder",
      });
    }
  }
  folderEdges.sort((a, b) =>
    JSON.stringify([a.source, a.target]).localeCompare(
      JSON.stringify([b.source, b.target]),
    ),
  );

  const edges = [...linkEdges, ...folderEdges].map((edge, index) => ({
    ...edge,
    id: `edge-${index + 1}`,
  }));

  const degree = new Map<
    string,
    {
      incoming: number;
      outgoing: number;
      semantic: number;
      index: number;
      folder: number;
    }
  >();
  const ensureDegree = (id: string) => {
    let d = degree.get(id);
    if (!d) {
      d = { incoming: 0, outgoing: 0, semantic: 0, index: 0, folder: 0 };
      degree.set(id, d);
    }
    return d;
  };
  for (const node of graph.nodes) ensureDegree(node.relPath);
  for (const folder of folderPaths) ensureDegree(folder);
  for (const edge of edges) {
    const source = degree.get(edge.source);
    const target = degree.get(edge.target);
    if (!source || !target) continue;
    if (edge.kind === "folder") {
      // 包含关系单独计数，不混入入链/出链指标
      source.folder += edge.count;
      target.folder += edge.count;
      continue;
    }
    source.outgoing += edge.count;
    target.incoming += edge.count;
    if (edge.kind === "index") {
      source.index += edge.count;
      target.index += edge.count;
    } else {
      source.semantic += edge.count;
      target.semantic += edge.count;
    }
  }

  const noteNodes: GraphViewNode[] = graph.nodes.map((node) => {
    const d = degree.get(node.relPath)!;
    const area = graphArea(node.relPath);
    return {
      id: node.relPath,
      title: node.title,
      area,
      tags: node.tags,
      inDegree: d.incoming,
      outDegree: d.outgoing,
      semanticDegree: d.semantic,
      indexDegree: d.index,
      folderDegree: d.folder,
      isArchive: area === "archives",
      isIndex: isGraphIndex(node.relPath),
      isFolder: false,
    };
  });
  const folderNodes: GraphViewNode[] = folderPaths.map((folder) => {
    const d = degree.get(folder)!;
    const area = graphArea(folder);
    return {
      id: folder,
      title: basename(folder),
      area,
      tags: [],
      inDegree: d.incoming,
      outDegree: d.outgoing,
      semanticDegree: d.semantic,
      indexDegree: d.index,
      folderDegree: d.folder,
      isArchive: area === "archives",
      isIndex: false,
      isFolder: true,
    };
  });
  const nodes = [...noteNodes, ...folderNodes];

  const visibleNodeIds = new Set(
    nodes
      .filter((node) => !node.isArchive && !node.isIndex && !node.isFolder)
      .map((node) => node.id),
  );
  const visibleEdges = edges.filter(
    (edge) =>
      edge.kind === "semantic" &&
      visibleNodeIds.has(edge.source) &&
      visibleNodeIds.has(edge.target),
  );

  return {
    generatedAt: graph.generatedAt,
    nodes,
    edges,
    stats: {
      nodes: nodes.length,
      edges: edges.length,
      visibleNodes: visibleNodeIds.size,
      visibleEdges: visibleEdges.length,
    },
  };
}
