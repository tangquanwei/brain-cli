import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { resolve, relative, basename } from "node:path";
import { settings } from "../config.js";
import {
  extractSummary,
  normalizeTags,
  parseFrontmatter,
} from "../utils/frontmatter.js";
import { c, log, panel, table } from "../utils/ui.js";

export interface NoteMeta {
  path: string;
  title: string;
  date: Date;
  tags: string[];
  rawTags: string;
  content: string;
}

const REVIEW_EXCLUDED_FILENAMES = new Set([
  "readme.md",
  "index.md",
  "_index.md",
]);

export function isReviewableNoteName(name: string): boolean {
  const normalized = name.toLowerCase();
  return (
    normalized.endsWith(".md") && !REVIEW_EXCLUDED_FILENAMES.has(normalized)
  );
}

function* walkMd(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      yield* walkMd(full);
    } else if (isReviewableNoteName(name)) {
      yield full;
    }
  }
}

function parseDate(value: unknown, fallbackName: string): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
    if (m) {
      const d = new Date(m[1] + "T00:00:00");
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(fallbackName);
  if (m) {
    const d = new Date(m[1] + "T00:00:00");
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function loadNote(filepath: string): NoteMeta | null {
  try {
    const raw = readFileSync(filepath, "utf-8");
    const { data, content } = parseFrontmatter(raw);
    const tags = normalizeTags(data.tags);
    return {
      path: filepath,
      title: (data.title as string) || basename(filepath, ".md"),
      date: parseDate(data.date, basename(filepath)),
      tags,
      rawTags: tags.join(", "),
      content,
    };
  } catch {
    return null;
  }
}

export function getAllNotes(): NoteMeta[] {
  const notes: NoteMeta[] = [];
  for (const f of walkMd(settings.notesDir)) {
    const n = loadNote(f);
    if (n) notes.push(n);
  }
  return notes;
}

export function getNotesInRange(start: Date, end: Date): NoteMeta[] {
  return getAllNotes()
    .filter((n) => n.date >= start && n.date <= end)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function getNotesByTags(tags: string[]): NoteMeta[] {
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  return getAllNotes()
    .filter((n) => n.tags.some((t) => tagSet.has(t.toLowerCase())))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function randomSample(n: number): NoteMeta[] {
  const all = getAllNotes();
  const k = Math.min(n, all.length);
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, k);
}

export function tagStats(notes: NoteMeta[], top = 5): [string, number][] {
  const counts = new Map<string, number>();
  for (const n of notes) {
    for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
}

function printNote(n: NoteMeta, index?: number): void {
  const prefix = index !== undefined ? `${index}. ` : "📄 ";
  const dateStr = n.date.toISOString().slice(0, 10);
  const rel = relative(settings.notesDir, n.path);
  const summary = extractSummary(n.content);
  log(`\n${c.bold(`${prefix}【${n.title}】`)}`);
  log(`   📅 ${dateStr}   🏷️  ${n.rawTags || "无标签"}`);
  log(`   📁 ${rel}`);
  if (summary) log(`   ${c.dim(summary.slice(0, 120))}`);
}

function printTagStats(notes: NoteMeta[]): void {
  const stats = tagStats(notes);
  if (!stats.length) return;
  log("\n📊 Top 标签：");
  table({ rows: stats.map(([t, n]) => [`🏷️  ${t}`, n]) });
}

// ── Commands ──
export function runReviewWeek(): void {
  const today = new Date();
  const day = today.getDay() || 7; // Monday = 1
  const start = new Date(today);
  start.setDate(today.getDate() - (day - 1));
  start.setHours(0, 0, 0, 0);

  panel(
    `${c.bold("📅 本周回顾")}\n${start.toISOString().slice(0, 10)} ~ ${today
      .toISOString()
      .slice(0, 10)}`,
    { borderColor: "blue" },
  );

  const notes = getNotesInRange(start, today);
  if (!notes.length) {
    log(c.warn("本周还没有笔记 📝"));
    return;
  }
  log(`共 ${c.bold(String(notes.length))} 篇\n`);
  notes.forEach((n, i) => printNote(n, i + 1));
  printTagStats(notes);
  log(`\n${c.dim("💡 有哪些知识点值得整理成专题笔记？")}`);
}

export function runReviewMonth(): void {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);

  panel(`${c.bold("📅 本月回顾")}\n${start.toISOString().slice(0, 7)}`, {
    borderColor: "blue",
  });

  const notes = getNotesInRange(start, today);
  if (!notes.length) {
    log(c.warn("本月还没有笔记 📝"));
    return;
  }
  notes.forEach((n, i) => printNote(n, i + 1));
  printTagStats(notes);
}

export function runReviewTags(tagsArg: string): void {
  const tags = tagsArg
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  panel(`${c.bold("🏷️  标签回顾")}\n${tags.join(", ")}`, {
    borderColor: "cyan",
  });

  const notes = getNotesByTags(tags);
  if (!notes.length) {
    log(c.warn("没有找到包含这些标签的笔记"));
    return;
  }
  log(`共 ${c.bold(String(notes.length))} 篇\n`);
  notes.slice(0, 20).forEach((n, i) => printNote(n, i + 1));
  if (notes.length > 20) log(`\n${c.dim(`... 还有 ${notes.length - 20} 篇`)}`);
}

export function runReviewRandom(n: number): void {
  const notes = randomSample(n);
  panel(`${c.bold("🎲 随机回顾")}\n抽取 ${notes.length} 篇`, {
    borderColor: "magenta",
  });
  notes.forEach((n, i) => printNote(n, i + 1));
}
