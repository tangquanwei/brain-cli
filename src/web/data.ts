import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PARA_DIRS } from "../config.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { buildLinkGraph } from "../utils/linkGraph.js";
import { buildNoteIndex, type NoteNode } from "../utils/noteIndex.js";
import { readFileCached } from "../utils/noteCache.js";
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
  /** 按日期聚合的笔记/日记数量，用于仪表盘热力图 */
  activity: { date: string; count: number }[];
  links: {
    edges: number;
    broken: number;
    missingHeading: number;
    missingAssets: number;
    nonStandard: number;
    orphans: number;
    activeOrphans: number;
    activeNotes: number;
  };
  recent: NoteSummaryItem[];
}

/** 由已解析的笔记索引节点构造摘要，避免重复读取与解析同一文件。 */
function noteSummary(node: NoteNode): NoteSummaryItem {
  return {
    id: node.relPath,
    title: node.title,
    date: node.date ?? "",
    tags: node.tags,
    summary: node.summary ?? "",
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

  const graph = buildLinkGraph(notesDir, buildNoteIndex(notesDir));
  const summaries = graph.nodes.map(noteSummary);
  const recent = [...summaries]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 10);

  // 按日期聚合笔记数量，用于仪表盘热力图
  const counts = new Map<string, number>();
  for (const item of summaries) {
    if (!item.date) continue;
    counts.set(item.date, (counts.get(item.date) ?? 0) + 1);
  }
  const activity = [...counts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    total,
    areas,
    activity,
    links: {
      edges: graph.edges.length,
      broken: graph.brokenLinks.length,
      missingHeading: graph.missingHeadingLinks.length,
      missingAssets: graph.missingAssets.length,
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
    const item = noteSummary(node);
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
  const raw = readFileCached(node.path);
  let content = raw;
  try {
    const parsed = parseFrontmatter(raw);
    content = parsed.content;
  } catch {
    // keep raw content when frontmatter is malformed
  }
  return {
    id: node.relPath,
    title: node.title,
    date: node.date ?? "",
    tags: node.tags,
    content,
    raw,
  };
}
