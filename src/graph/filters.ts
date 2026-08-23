import type { GraphViewData } from "./projection.js";

export interface GraphFilterOptions {
  scope: "active" | "all";
  includeIndex: boolean;
  includeIsolated: boolean;
  includeFolders?: boolean;
}

export function filterGraphView(
  graph: GraphViewData,
  opts: GraphFilterOptions,
): GraphViewData {
  const nodes = graph.nodes.filter((node) => {
    if (opts.scope === "active" && node.isArchive) return false;
    if (!opts.includeIndex && node.isIndex) return false;
    if (!opts.includeFolders && node.isFolder) return false;
    const degree =
      node.semanticDegree +
      (opts.includeIndex ? node.indexDegree : 0) +
      (opts.includeFolders ? node.folderDegree : 0);
    return opts.includeIsolated || degree > 0;
  });
  const ids = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter(
    (edge) =>
      ids.has(edge.source) &&
      ids.has(edge.target) &&
      (opts.includeIndex || edge.kind !== "index") &&
      (opts.includeFolders || edge.kind !== "folder"),
  );
  return {
    ...graph,
    nodes,
    edges,
    stats: {
      ...graph.stats,
      visibleNodes: nodes.length,
      visibleEdges: edges.length,
    },
  };
}

export function localGraphIds(
  graph: GraphViewData,
  startId: string,
  depth: 1 | 2,
  includeIndex = false,
  includeFolders = false,
): Set<string> {
  if (!graph.nodes.some((node) => node.id === startId)) return new Set();
  const result = new Set([startId]);
  let frontier = new Set([startId]);
  for (let level = 0; level < depth; level++) {
    const next = new Set<string>();
    for (const edge of graph.edges) {
      if (!includeIndex && edge.kind === "index") continue;
      if (!includeFolders && edge.kind === "folder") continue;
      if (frontier.has(edge.source) && !result.has(edge.target))
        next.add(edge.target);
      if (frontier.has(edge.target) && !result.has(edge.source))
        next.add(edge.source);
    }
    for (const id of next) result.add(id);
    frontier = next;
  }
  return result;
}
