import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { settings } from "../config.js";
import { normalizeTags, parseFrontmatter } from "./frontmatter.js";

const IGNORE_DIRS = new Set([
  ".brain",
  ".git",
  ".obsidian",
  ".trash",
  "node_modules",
]);

export interface NoteNode {
  title: string;
  path: string;
  relPath: string;
  tags: string[];
  headings: string[];
  blocks?: string[];
}

export function toPosixPath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function normalizeAbsPath(path: string): string {
  return toPosixPath(resolve(path));
}

export function notesRelative(
  path: string,
  notesDir = settings.notesDir,
): string {
  return toPosixPath(relative(notesDir, path));
}

function scanMarkdownFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    if (entry.name.startsWith(".") && IGNORE_DIRS.has(entry.name)) continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) scanMarkdownFiles(full, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push(normalizeAbsPath(full));
    }
  }
  return out;
}

export function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (match?.[2]) headings.push(match[2].trim());
  }
  return headings;
}

export function extractBlockIds(content: string): string[] {
  const blocks: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/(?:^|\s)\^([A-Za-z0-9-]+)\s*$/);
    if (match?.[1]) blocks.push(match[1]);
  }
  return blocks;
}

export function markdownHeadingSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, "")
    .replace(/\s+/g, "-");
}

export function buildNoteIndex(notesDir = settings.notesDir): NoteNode[] {
  return scanMarkdownFiles(notesDir).map((path) => {
    const raw = readFileSync(path, "utf8");
    let parsed: ReturnType<typeof parseFrontmatter>;
    try {
      parsed = parseFrontmatter(raw);
    } catch {
      parsed = { data: {}, content: raw };
    }
    const frontmatterTitle =
      typeof parsed.data.title === "string" ? parsed.data.title.trim() : "";
    return {
      title: frontmatterTitle || basename(path, ".md"),
      path,
      relPath: toPosixPath(relative(notesDir, path)),
      tags: normalizeTags(parsed.data.tags),
      headings: extractHeadings(parsed.content),
      blocks: extractBlockIds(parsed.content),
    };
  });
}

export interface WikiNoteResolution {
  node?: NoteNode;
  ambiguous: boolean;
}

function withoutMarkdownExtension(path: string): string {
  return path.toLowerCase().endsWith(".md") ? path.slice(0, -3) : path;
}

export function resolveWikiNoteTarget(
  targetPath: string,
  source: NoteNode,
  nodes: NoteNode[],
): WikiNoteResolution {
  let decoded = targetPath;
  try {
    decoded = decodeURI(targetPath);
  } catch {
    // Keep the original text when the target contains malformed escapes.
  }
  const normalized = withoutMarkdownExtension(
    toPosixPath(decoded.trim()).replace(/^\.\//, "").replace(/^\//, ""),
  ).toLowerCase();
  if (!normalized) return { node: source, ambiguous: false };

  const exact = nodes.filter(
    (node) =>
      withoutMarkdownExtension(node.relPath).toLowerCase() === normalized,
  );
  if (exact.length === 1) return { node: exact[0], ambiguous: false };

  const suffixMatches = nodes.filter((node) => {
    const rel = withoutMarkdownExtension(node.relPath).toLowerCase();
    return rel === normalized || rel.endsWith(`/${normalized}`);
  });
  if (suffixMatches.length === 1) {
    return { node: suffixMatches[0], ambiguous: false };
  }
  if (suffixMatches.length > 1) return { ambiguous: true };

  const byName = nodes.filter((node) => {
    const basenameWithoutExtension = basename(node.path, ".md").toLowerCase();
    return (
      basenameWithoutExtension === normalized ||
      node.title.trim().toLowerCase() === normalized
    );
  });
  return {
    node: byName.length === 1 ? byName[0] : undefined,
    ambiguous: byName.length > 1,
  };
}

export function resolveNoteArg(
  arg: string,
  nodes: NoteNode[],
): NoteNode | undefined {
  const direct = normalizeAbsPath(resolve(process.cwd(), arg));
  const fromNotes = normalizeAbsPath(resolve(settings.notesDir, arg));
  return nodes.find((node) => {
    const rel = notesRelative(node.path);
    return (
      node.path === direct ||
      node.path === fromNotes ||
      rel === toPosixPath(arg) ||
      node.title === arg ||
      basename(node.path) === arg ||
      basename(node.path, ".md") === arg
    );
  });
}

export function noteDir(node: NoteNode): string {
  return dirname(node.path);
}
