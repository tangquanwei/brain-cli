import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { PARA_DIRS } from "../config.js";
import {
  extractSummary,
  normalizeTags,
  parseFrontmatter,
} from "../utils/frontmatter.js";
import { buildLinkGraph } from "../utils/linkGraph.js";
import { buildNoteIndex } from "../utils/noteIndex.js";
import { resolveSafeNote } from "../utils/safeOpenNote.js";

export function countMdRecursive(dir: string): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      n += countMdRecursive(full);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      n += 1;
    }
  }
  return n;
}

export interface AreaCount {
  area: string;
  count: number;
  children: { name: string; count: number }[];
}

export interface NoteSummaryItem {
  id: string;
  title: string;
  date: string;
  tags: string[];
  summary: string;
}

export interface DashboardData {
  total: number;
  areas: AreaCount[];
  links: {
    edges: number;
    broken: number;
    missingHeading: number;
    nonStandard: number;
    orphans: number;
    activeOrphans: number;
    activeNotes: number;
  };
  recent: NoteSummaryItem[];
}

function parseNoteDate(raw: string, fallbackName: string): string {
  try {
    const { data } = parseFrontmatter(raw);
    const value = data.date;
    const text =
      value instanceof Date
        ? value.toISOString()
        : typeof value === "string"
          ? value
          : "";
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(text);
    if (m) return m[1]!;
  } catch {
    // fall through to filename heuristic
  }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(fallbackName);
  return m ? m[1]! : "";
}

function summarizeNote(
  notesDir: string,
  relPath: string,
): NoteSummaryItem | null {
  const full = resolve(notesDir, relPath);
  let raw: string;
  try {
    raw = readFileSync(full, "utf8");
  } catch {
    return null;
  }
  let data: Record<string, unknown> = {};
  let content = raw;
  try {
    const parsed = parseFrontmatter(raw);
    data = parsed.data;
    content = parsed.content;
  } catch {
    // keep raw content when frontmatter is malformed
  }
  const title =
    (typeof data.title === "string" && data.title.trim()) ||
    basename(relPath, ".md");
  return {
    id: relPath,
    title,
    date: parseNoteDate(raw, basename(relPath)),
    tags: normalizeTags(data.tags),
    summary: extractSummary(content, 2).slice(0, 160),
  };
}

export function getDashboard(notesDir: string): DashboardData {
  const areas: AreaCount[] = [];
  let total = 0;
  for (const sub of PARA_DIRS) {
    const base = resolve(notesDir, sub);
    const count = countMdRecursive(base);
    total += count;
    const children: { name: string; count: number }[] = [];
    if (existsSync(base)) {
      for (const entry of readdirSync(base, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const childCount = countMdRecursive(resolve(base, entry.name));
        if (childCount > 0) {
          children.push({ name: entry.name, count: childCount });
        }
      }
    }
    children.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
    areas.push({ area: sub, count, children });
  }
  // notes 根目录下的散文件也计入总数
  let rootCount = 0;
  if (existsSync(notesDir)) {
    for (const entry of readdirSync(notesDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) rootCount += 1;
    }
  }
  total += rootCount;

  const graph = buildLinkGraph(notesDir);
  const recent = graph.nodes
    .map((node) => summarizeNote(notesDir, node.relPath))
    .filter((item): item is NoteSummaryItem => item !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 10);

  return {
    total,
    areas,
    links: {
      edges: graph.edges.length,
      broken: graph.brokenLinks.length,
      missingHeading: graph.missingHeadingLinks.length,
      nonStandard: graph.nonStandardLinks.length,
      orphans: graph.orphanNotes.length,
      activeOrphans: graph.orphanStats.active.orphans,
      activeNotes: graph.orphanStats.active.notes,
    },
    recent,
  };
}

export interface ListNotesFilter {
  q?: string;
  area?: string;
  tag?: string;
}

export function listNotes(
  notesDir: string,
  filter: ListNotesFilter = {},
): NoteSummaryItem[] {
  const q = (filter.q ?? "").trim().toLowerCase();
  const area = (filter.area ?? "").trim();
  const tag = (filter.tag ?? "").trim().toLowerCase();
  const items: NoteSummaryItem[] = [];
  for (const node of buildNoteIndex(notesDir)) {
    if (area && area !== "all") {
      const top = node.relPath.includes("/")
        ? node.relPath.slice(0, node.relPath.indexOf("/"))
        : "root";
      if (top !== area) continue;
    }
    const item = summarizeNote(notesDir, node.relPath);
    if (!item) continue;
    if (tag && !item.tags.some((t) => t.toLowerCase().includes(tag))) continue;
    if (
      q &&
      !`${item.title} ${item.id} ${item.tags.join(" ")} ${item.summary}`
        .toLowerCase()
        .includes(q)
    )
      continue;
    items.push(item);
  }
  return items.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface NoteContent {
  id: string;
  title: string;
  date: string;
  tags: string[];
  content: string;
  raw: string;
}

export function readNoteContent(
  notesDir: string,
  id: unknown,
): NoteContent | null {
  const nodes = buildNoteIndex(notesDir);
  const node = resolveSafeNote(id, nodes);
  if (!node) return null;
  const raw = readFileSync(node.path, "utf8");
  let data: Record<string, unknown> = {};
  let content = raw;
  try {
    const parsed = parseFrontmatter(raw);
    data = parsed.data;
    content = parsed.content;
  } catch {
    // keep raw content when frontmatter is malformed
  }
  return {
    id: node.relPath,
    title: node.title,
    date: parseNoteDate(raw, basename(node.relPath)),
    tags: node.tags,
    content,
    raw,
  };
}
