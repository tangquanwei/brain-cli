import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { settings } from "../config.js";
import {
  decodeLocalHref,
  extractMarkdownLinks,
  extractWikiLinks,
} from "./markdownLinks.js";
import {
  buildNoteIndex,
  markdownHeadingSlug,
  normalizeAbsPath,
  notesRelative,
  type NoteNode,
} from "./noteIndex.js";

export interface LinkEdge {
  from: string;
  fromRel: string;
  to: string | null;
  toRel: string | null;
  text: string;
  href: string;
  suffix: string;
  raw: string;
  status: "resolved" | "broken" | "missing-heading";
}

export interface NonStandardLink {
  file: string;
  raw: string;
  target: string;
}

export interface LinkGraph {
  generatedAt: string;
  nodes: NoteNode[];
  edges: LinkEdge[];
  backlinks: Record<string, LinkEdge[]>;
  brokenLinks: LinkEdge[];
  missingHeadingLinks: LinkEdge[];
  orphanNotes: NoteNode[];
  orphanStats: OrphanStats;
  nonStandardLinks: NonStandardLink[];
}

export interface OrphanAreaStats {
  notes: number;
  orphans: number;
  orphanRate: number;
}

export interface OrphanStats {
  all: OrphanAreaStats;
  active: OrphanAreaStats;
  byArea: Record<string, OrphanAreaStats>;
}

const ACTIVE_AREAS = new Set(["projects", "areas", "resources", "questions"]);

function topLevelArea(relPath: string): string {
  const slash = relPath.indexOf("/");
  return slash < 0 ? "root" : relPath.slice(0, slash);
}

function areaStats(
  nodes: NoteNode[],
  orphanPaths: Set<string>,
): OrphanAreaStats {
  const orphans = nodes.filter((node) => orphanPaths.has(node.relPath)).length;
  return {
    notes: nodes.length,
    orphans,
    orphanRate:
      nodes.length === 0 ? 0 : Number((orphans / nodes.length).toFixed(4)),
  };
}

export function buildOrphanStats(
  nodes: NoteNode[],
  orphanNotes: NoteNode[],
): OrphanStats {
  const orphanPaths = new Set(orphanNotes.map((node) => node.relPath));
  const areas = [
    ...new Set(nodes.map((node) => topLevelArea(node.relPath))),
  ].sort();
  const byArea = Object.fromEntries(
    areas.map((area) => [
      area,
      areaStats(
        nodes.filter((node) => topLevelArea(node.relPath) === area),
        orphanPaths,
      ),
    ]),
  );
  const activeNodes = nodes.filter((node) =>
    ACTIVE_AREAS.has(topLevelArea(node.relPath)),
  );
  return {
    all: areaStats(nodes, orphanPaths),
    active: areaStats(activeNodes, orphanPaths),
    byArea,
  };
}

function suffixHeading(suffix: string): string | undefined {
  const hash = suffix.match(/#([^?]+)/);
  return hash?.[1] ? decodeURIComponent(hash[1]) : undefined;
}

function hasHeading(node: NoteNode, suffix: string): boolean {
  const heading = suffixHeading(suffix);
  if (!heading) return true;
  return node.headings.some(
    (h) => markdownHeadingSlug(h) === heading || h === heading,
  );
}

export function buildLinkGraph(notesDir = settings.notesDir): LinkGraph {
  const nodes = buildNoteIndex(notesDir);
  const byPath = new Map(
    nodes.map((node) => [normalizeAbsPath(node.path), node]),
  );
  const edges: LinkEdge[] = [];
  const nonStandardLinks: NonStandardLink[] = [];

  for (const node of nodes) {
    const raw = readFileSync(node.path, "utf8");
    for (const link of extractMarkdownLinks(raw)) {
      if (link.kind !== "note") continue;
      const targetPath = normalizeAbsPath(
        resolve(dirname(node.path), decodeLocalHref(link.href)),
      );
      const target = byPath.get(targetPath);
      const exists = existsSync(targetPath);
      const status: LinkEdge["status"] =
        target && hasHeading(target, link.suffix)
          ? "resolved"
          : target && !hasHeading(target, link.suffix)
            ? "missing-heading"
            : exists
              ? "resolved"
              : "broken";
      edges.push({
        from: node.path,
        fromRel: notesRelative(node.path),
        to: targetPath,
        toRel: target
          ? notesRelative(target.path)
          : exists
            ? notesRelative(targetPath)
            : null,
        text: link.text,
        href: link.href,
        suffix: link.suffix,
        raw: link.raw,
        status,
      });
    }

    for (const wiki of extractWikiLinks(raw)) {
      nonStandardLinks.push({
        file: notesRelative(node.path),
        raw: wiki.raw,
        target: wiki.target,
      });
    }
  }

  const backlinks: Record<string, LinkEdge[]> = {};
  for (const edge of edges) {
    if (!edge.toRel || edge.status === "broken") continue;
    backlinks[edge.toRel] ??= [];
    backlinks[edge.toRel]!.push(edge);
  }

  const connected = new Set<string>();
  for (const edge of edges) {
    connected.add(edge.fromRel);
    if (edge.toRel) connected.add(edge.toRel);
  }

  const orphanNotes = nodes.filter((node) => !connected.has(node.relPath));
  return {
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    backlinks,
    brokenLinks: edges.filter((edge) => edge.status === "broken"),
    missingHeadingLinks: edges.filter(
      (edge) => edge.status === "missing-heading",
    ),
    orphanNotes,
    orphanStats: buildOrphanStats(nodes, orphanNotes),
    nonStandardLinks,
  };
}
