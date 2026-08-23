import matter from "gray-matter";

export interface ParsedNote {
  data: Record<string, unknown>;
  content: string;
}

/** Parse a Markdown file with YAML frontmatter using gray-matter. */
export function parseFrontmatter(raw: string): ParsedNote {
  const parsed = matter(raw);
  return { data: parsed.data ?? {}, content: parsed.content ?? "" };
}

/** Normalize a `tags` frontmatter value into a string array.
 * Handles: array, "a, b", "[a, b]", undefined.
 */
export function normalizeTags(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  let s = String(value).trim();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Extract the first `maxLines` non-empty, non-heading lines after frontmatter. */
export function extractSummary(content: string, maxLines = 3): string {
  const lines = content.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    result.push(s);
    if (result.length >= maxLines) break;
  }
  return result.join("\n") || "(无内容摘要)";
}
