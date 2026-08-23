import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { settings, ensureNotesDir } from "../config.js";
import { autoCommit } from "../utils/git.js";
import { c, log } from "../utils/ui.js";

export type NoteType = "Fleeting" | "Literature" | "Permanent" | "Project";

const SUBDIR: Record<NoteType, string> = {
  Project: "projects",
  Fleeting: "resources",
  Literature: "resources",
  Permanent: "areas",
};

function sanitizeFilename(name: string): string {
  const s = name.replace(/[<>:"/\\|?*]/g, "_").trim();
  return s.length > 200 ? s.slice(0, 200) : s;
}

function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

export interface CaptureOptions {
  title: string;
  content?: string;
  tags?: string[];
  type?: NoteType;
}

export async function runCapture(opts: CaptureOptions): Promise<string> {
  const { title, content = "", tags = [], type = "Fleeting" } = opts;

  ensureNotesDir();
  const subdir = SUBDIR[type] ?? "resources";
  const targetDir = resolve(settings.notesDir, subdir);
  mkdirSync(targetDir, { recursive: true });

  const now = new Date();
  const tagStr = tags.join(", ");
  const frontmatter =
    `---\n` +
    `title: "${title}"\n` +
    `date: "${formatLocalDateTime(now)}"\n` +
    `tags: [${tagStr}]\n` +
    `type: ${type}\n` +
    `---\n\n`;

  let body = `# ${title}\n\n`;
  if (content) body += `${content}\n\n`;
  body += `> 📌 从 VS Code 捕获于 ${formatLocalDateTime(now)}\n`;

  const filename = sanitizeFilename(title) + ".md";
  const filepath = resolve(targetDir, filename);
  writeFileSync(filepath, frontmatter + body, "utf-8");

  log(`  ${c.success("✅ 本地:")} ${filepath}`);

  await autoCommit(`🧠 capture: ${title}`);
  return filepath;
}
