import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  resolveWikiNoteTarget,
  toPosixPath,
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
  syntax?: "markdown" | "wikilink";
  embed?: boolean;
}

export interface NonStandardLink {
  file: string;
  raw: string;
  target: string;
  reason?: "ambiguous";
}

export interface MissingAsset {
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
  missingAssets: MissingAsset[];
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

function decodeFragment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function suffixReference(suffix: string): string | undefined {
  const hash = suffix.match(/#([^?]+)/);
  return hash?.[1] ? decodeFragment(hash[1]) : undefined;
}

function hasReference(node: NoteNode, suffix: string): boolean {
  const reference = suffixReference(suffix);
  if (!reference) return true;
  if (reference.startsWith("^")) {
    return (node.blocks ?? []).some(
      (block) => block.toLowerCase() === reference.slice(1).toLowerCase(),
    );
  }
  const normalizedReference = markdownHeadingSlug(reference);
  return node.headings.some(
    (heading) =>
      markdownHeadingSlug(heading) === normalizedReference ||
      heading.toLowerCase() === reference.toLowerCase(),
  );
}

function findWikiAsset(
  notesDir: string,
  sourcePath: string,
  target: string,
  byName: Map<string, string[]>,
): string | undefined {
  const decoded = decodeLocalHref(target).replace(/^\//, "");
  const directCandidates = [
    resolve(notesDir, decoded),
    resolve(dirname(sourcePath), decoded),
  ];
  for (const candidate of directCandidates) {
    if (existsSync(candidate)) return normalizeAbsPath(candidate);
  }

  const wanted = decoded.split("/").at(-1)?.toLowerCase();
  if (!wanted) return undefined;
  const matches = byName.get(wanted) ?? [];
  return matches.length === 1 ? matches[0] : undefined;
}

function buildAssetNameIndex(notesDir: string): Map<string, string[]> {
  const byName = new Map<string, string[]>();
  const walk = (dir: string): void => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (
        entry.name === ".brain" ||
        entry.name === ".git" ||
        entry.name === ".obsidian" ||
        entry.name === ".trash"
      ) {
        continue;
      }
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && !entry.name.toLowerCase().endsWith(".md")) {
        const key = entry.name.toLowerCase();
        const paths = byName.get(key) ?? [];
        paths.push(normalizeAbsPath(full));
        byName.set(key, paths);
      }
    }
  };
  walk(notesDir);
  return byName;
}

export function buildLinkGraph(notesDir = settings.notesDir): LinkGraph {
  const nodes = buildNoteIndex(notesDir);
  const byPath = new Map(
    nodes.map((node) => [normalizeAbsPath(node.path), node]),
  );
  const edges: LinkEdge[] = [];
  const nonStandardLinks: NonStandardLink[] = [];
  const missingAssets: MissingAsset[] = [];
  let assetNameIndex: Map<string, string[]> | undefined;

  for (const node of nodes) {
    const raw = readFileSync(node.path, "utf8");
    for (const link of extractMarkdownLinks(raw)) {
      if (link.kind === "anchor") {
        if (!hasReference(node, link.suffix)) {
          edges.push({
            from: node.path,
            fromRel: notesRelative(node.path, notesDir),
            to: node.path,
            toRel: notesRelative(node.path, notesDir),
            text: link.text,
            href: link.href,
            suffix: link.suffix,
            raw: link.raw,
            status: "missing-heading",
            syntax: "markdown",
            embed: link.image,
          });
        }
        continue;
      }
      if (link.image && link.kind === "asset") {
        const assetPath = normalizeAbsPath(
          resolve(dirname(node.path), decodeLocalHref(link.href)),
        );
        if (!existsSync(assetPath)) {
          missingAssets.push({
            file: notesRelative(node.path, notesDir),
            raw: link.raw,
            target: `${link.href}${link.suffix}`,
          });
        }
        continue;
      }
      if (link.kind !== "note") continue;
      const targetPath = normalizeAbsPath(
        resolve(dirname(node.path), decodeLocalHref(link.href)),
      );
      const target = byPath.get(targetPath);
      const exists = existsSync(targetPath);
      const status: LinkEdge["status"] =
        target && hasReference(target, link.suffix)
          ? "resolved"
          : target && !hasReference(target, link.suffix)
            ? "missing-heading"
            : exists
              ? "resolved"
              : "broken";
      edges.push({
        from: node.path,
        fromRel: notesRelative(node.path, notesDir),
        to: targetPath,
        toRel: target
          ? notesRelative(target.path, notesDir)
          : exists
            ? notesRelative(targetPath, notesDir)
            : null,
        text: link.text,
        href: link.href,
        suffix: link.suffix,
        raw: link.raw,
        status,
        syntax: "markdown",
        embed: link.image,
      });
    }

    for (const wiki of extractWikiLinks(raw)) {
      if (wiki.kind === "asset") {
        assetNameIndex ??= buildAssetNameIndex(notesDir);
        if (!findWikiAsset(notesDir, node.path, wiki.path, assetNameIndex)) {
          missingAssets.push({
            file: notesRelative(node.path, notesDir),
            raw: wiki.raw,
            target: wiki.target,
          });
        }
        continue;
      }

      const resolution = resolveWikiNoteTarget(wiki.path, node, nodes);
      const target = resolution.node;
      const status: LinkEdge["status"] =
        target && hasReference(target, wiki.suffix)
          ? "resolved"
          : target
            ? "missing-heading"
            : "broken";
      if (resolution.ambiguous) {
        nonStandardLinks.push({
          file: notesRelative(node.path, notesDir),
          raw: wiki.raw,
          target: wiki.target,
          reason: "ambiguous",
        });
      }
      edges.push({
        from: node.path,
        fromRel: notesRelative(node.path, notesDir),
        to: target?.path ?? null,
        toRel: target ? notesRelative(target.path, notesDir) : null,
        text: wiki.alias ?? wiki.path,
        href: wiki.path,
        suffix: wiki.suffix,
        raw: wiki.raw,
        status,
        syntax: "wikilink",
        embed: wiki.embed,
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
    if (
      edge.status === "broken" ||
      !edge.toRel ||
      edge.fromRel === edge.toRel
    ) {
      continue;
    }
    connected.add(edge.fromRel);
    connected.add(edge.toRel);
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
    missingAssets,
  };
}
