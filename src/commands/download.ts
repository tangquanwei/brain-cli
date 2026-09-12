import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
} from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { settings } from "../config.js";
import { autoCommit } from "../utils/git.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { c, log, panel } from "../utils/ui.js";

const NOTION_VERSION = "2022-06-28";

interface RichText {
  type?: string;
  plain_text?: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
  text?: { content?: string; link?: { url?: string } | null };
}

interface Block {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}

interface Page {
  id: string;
  url?: string;
  properties?: Record<
    string,
    { type?: string; title?: RichText[]; rich_text?: RichText[] }
  >;
}

interface MediaFile {
  sourceUrl: string;
  name: string;
}

export interface DownloadOptions {
  url: string;
  token?: string;
  output?: string;
}

export interface DownloadResult {
  filepath: string;
  title: string;
  pageId: string;
  media: number;
  updated: boolean;
}

export function parseNotionPageId(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Notion 页面 URL 无效");
  }
  if (
    !/^(app\.notion\.com|www\.notion\.so|notion\.so)$/i.test(parsed.hostname)
  ) {
    throw new Error("只支持 notion.so 或 app.notion.com 页面 URL");
  }
  const matches = value.match(/[0-9a-f]{32}/gi);
  const id = matches?.at(-1);
  if (!id) throw new Error("Notion URL 中未找到页面 ID");
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`.toLowerCase();
}

function cleanName(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .trim()
    .replace(/\.+$/, "");
  return (cleaned || fallback).slice(0, 180);
}

function plainText(rich: RichText[] | undefined): string {
  return (rich ?? [])
    .map((item) => item.plain_text ?? item.text?.content ?? "")
    .join("");
}

function markdownText(rich: RichText[] | undefined): string {
  return (rich ?? [])
    .map((item) => {
      let text = item.plain_text ?? item.text?.content ?? "";
      text = text.replace(/([\\`*_{}\[\]()#+.!|>~-])/g, "\\$1");
      const a = item.annotations ?? {};
      if (a.code) text = `\`${text}\``;
      else {
        if (a.bold) text = `**${text}**`;
        if (a.italic) text = `*${text}*`;
        if (a.strikethrough) text = `~~${text}~~`;
      }
      const href = item.href ?? item.text?.link?.url;
      return href ? `[${text}](${href})` : text;
    })
    .join("");
}

function blockRich(block: Block): RichText[] {
  const data = block[block.type] as { rich_text?: RichText[] } | undefined;
  return data?.rich_text ?? [];
}

function mediaInfo(block: Block): MediaFile | null {
  const data = block[block.type] as
    | {
        type?: string;
        file?: { url?: string };
        external?: { url?: string };
        name?: string;
      }
    | undefined;
  const url = data?.file?.url ?? data?.external?.url;
  if (!url) return null;
  const sourceName =
    data?.name || basename(new URL(url).pathname) || `${block.id}.bin`;
  return { sourceUrl: url, name: cleanName(sourceName, `${block.id}.bin`) };
}

function blockLine(block: Block, depth: number, media: MediaFile[]): string {
  const data = block[block.type] as Record<string, unknown> | undefined;
  const text = markdownText(blockRich(block));
  const indent = "  ".repeat(depth);
  switch (block.type) {
    case "heading_1":
      return `${"#"} ${text}`;
    case "heading_2":
      return `## ${text}`;
    case "heading_3":
      return `### ${text}`;
    case "bulleted_list_item":
      return `${indent}- ${text}`;
    case "numbered_list_item":
      return `${indent}1. ${text}`;
    case "to_do":
      return `${indent}- [${data?.checked ? "x" : " "}] ${text}`;
    case "quote":
      return text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "code": {
      const language =
        typeof data?.language === "string" && data.language !== "plain text"
          ? data.language
          : "";
      return `\`\`\`${language}\n${plainText(blockRich(block))}\n\`\`\``;
    }
    case "divider":
      return "---";
    case "image":
    case "file": {
      const info = mediaInfo(block);
      if (!info) return "";
      media.push(info);
      return `![${info.name}](./__ASSETS__/${info.name})`;
    }
    case "bookmark":
    case "link_preview": {
      const url = typeof data?.url === "string" ? data.url : "";
      return url ? `[${url}](${url})` : "";
    }
    case "paragraph":
      return text;
    default:
      return text
        ? `<!-- Notion block: ${block.type} -->\n${text}`
        : `<!-- Notion block: ${block.type} -->`;
  }
}

async function notionFetch<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
    },
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) detail += `: ${body.message}`;
    } catch {
      /* keep status */
    }
    throw new Error(`Notion API 请求失败 (${detail})`);
  }
  return (await response.json()) as T;
}

async function fetchBlocks(blockId: string, token: string): Promise<Block[]> {
  const all: Block[] = [];
  let cursor: string | undefined;
  do {
    const query = cursor
      ? `?page_size=100&start_cursor=${encodeURIComponent(cursor)}`
      : "?page_size=100";
    const result = await notionFetch<{
      results: Block[];
      has_more: boolean;
      next_cursor?: string;
    }>(`/blocks/${blockId}/children${query}`, token);
    for (const block of result.results) {
      if (
        block.has_children &&
        !["child_page", "child_database"].includes(block.type)
      ) {
        block.children = await fetchBlocks(block.id, token);
      }
      all.push(block);
    }
    cursor = result.has_more ? result.next_cursor : undefined;
  } while (cursor);
  return all;
}

function renderBlocks(blocks: Block[], media: MediaFile[], depth = 0): string {
  const lines: string[] = [];
  for (const block of blocks) {
    const line = blockLine(block, depth, media);
    if (line) lines.push(line);
    const children = block.children as Block[] | undefined;
    if (children?.length) lines.push(renderBlocks(children, media, depth + 1));
  }
  return lines.join("\n\n");
}

function vaultTarget(pathValue: string): string {
  const target = isAbsolute(pathValue)
    ? resolve(pathValue)
    : resolve(settings.notesDir, pathValue);
  const root = resolve(settings.notesDir);
  const rel = relative(root, target);
  if (rel.startsWith("..") || isAbsolute(rel))
    throw new Error("输出路径必须位于知识库目录内");
  return target;
}

function findExistingPage(pageId: string): string | null {
  const root = resolve(settings.notesDir);
  if (!existsSync(root)) return null;
  const visit = (dir: string): string | null => {
    for (const entry of readdirSync(dir)) {
      const path = resolve(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry === ".brain" || entry === ".git") continue;
        const found = visit(path);
        if (found) return found;
      } else if (entry.toLowerCase().endsWith(".md")) {
        try {
          if (
            String(
              parseFrontmatter(readFileSync(path, "utf8")).data
                .notion_page_id ?? "",
            ).toLowerCase() === pageId
          )
            return path;
        } catch {
          /* ignore malformed notes */
        }
      }
    }
    return null;
  };
  return visit(root);
}

async function downloadMedia(
  media: MediaFile[],
  assetsDir: string,
): Promise<void> {
  mkdirSync(assetsDir, { recursive: true });
  const used = new Set<string>();
  for (const item of media) {
    let name = item.name;
    const stem = basename(name, extname(name));
    const ext = extname(name);
    let n = 2;
    while (used.has(name) || existsSync(resolve(assetsDir, name)))
      name = `${stem}-${n++}${ext}`;
    used.add(name);
    // Notion file URLs are signed; never forward the integration token to a
    // third-party external URL.
    const response = await fetch(item.sourceUrl);
    if (!response.ok)
      throw new Error(
        `媒体下载失败 (${response.status} ${response.statusText})`,
      );
    writeFileSync(
      resolve(assetsDir, name),
      Buffer.from(await response.arrayBuffer()),
    );
    item.name = name;
  }
}

export async function runDownload(
  opts: DownloadOptions,
): Promise<DownloadResult> {
  const token = opts.token?.trim() || settings.notionToken?.trim();
  if (!token)
    throw new Error("缺少 Notion Token，请设置 NOTION_TOKEN 或传入 --token");
  const pageId = parseNotionPageId(opts.url);
  const page = await notionFetch<Page>(`/pages/${pageId}`, token);
  const titleProperty = Object.values(page.properties ?? {}).find(
    (value) => value.type === "title" || value.title,
  );
  const title = plainText(titleProperty?.title) || "Untitled";
  const blocks = await fetchBlocks(page.id, token);
  const media: MediaFile[] = [];
  renderBlocks(blocks, media);
  const existing = findExistingPage(pageId);
  const target =
    existing ??
    vaultTarget(opts.output ?? `resources/${cleanName(title, "Untitled")}.md`);
  if (!existing && existsSync(target))
    throw new Error(`目标文件已存在且不是该 Notion 页面: ${target}`);
  const targetDir = dirname(target);
  const stem = basename(target, ".md");
  const assetsDir = resolve(targetDir, `${stem}.assets`);
  const staging = await mkdtemp(resolve(tmpdir(), "brain-notion-"));
  const stagedAssets = resolve(staging, `${stem}.assets`);
  try {
    await downloadMedia(media, stagedAssets);
    const date = new Date().toISOString();
    const sourceUrl = page.url || opts.url;
    const frontmatter = `---\ntitle: ${JSON.stringify(title)}\ndate: ${JSON.stringify(date)}\ntype: Literature\nnotion_url: ${JSON.stringify(sourceUrl)}\nnotion_page_id: ${pageId}\nnotion_synced_at: ${JSON.stringify(date)}\n---\n\n`;
    media.length = 0;
    const body = renderBlocks(blocks, media).trim();
    const rendered = (
      frontmatter +
      `# ${title}\n\n` +
      (body || "") +
      "\n"
    ).replaceAll("./__ASSETS__/", `./${stem}.assets/`);
    const stagedFile = resolve(staging, `${stem}.md`);
    writeFileSync(stagedFile, rendered, "utf8");
    mkdirSync(targetDir, { recursive: true });
    if (existsSync(assetsDir))
      rmSync(assetsDir, { recursive: true, force: true });
    if (media.length) renameSync(stagedAssets, assetsDir);
    renameSync(stagedFile, target);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  log(`  ${c.success(existing ? "✅ 已更新:" : "✅ 已下载:")} ${target}`);
  if (media.length) log(`  ${c.dim(`媒体附件: ${media.length} 个`)}`);
  await autoCommit(`🧠 notion: ${title}`);
  return {
    filepath: target,
    title,
    pageId,
    media: media.length,
    updated: Boolean(existing),
  };
}

export async function commandDownload(
  url: string,
  opts: { token?: string; output?: string },
): Promise<void> {
  panel(`${c.bold("⬇️ 同步 Notion 页面")}\n${url}`, { borderColor: "cyan" });
  await runDownload({ url, token: opts.token, output: opts.output });
}
