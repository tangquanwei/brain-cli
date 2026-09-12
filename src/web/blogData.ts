import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, relative, resolve, sep } from "node:path";
import matter from "gray-matter";
import { buildNoteIndex } from "../utils/noteIndex.js";
import { resolveSafeNote } from "../utils/safeOpenNote.js";
import { normalizeTags } from "../utils/frontmatter.js";
import {
  decodeLocalHref,
  extractMarkdownLinks,
  extractWikiLinks,
  formatMarkdownDestination,
} from "../utils/markdownLinks.js";

const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

// Check each existing component, including dangling symlinks, before creating files.
function safePath(root: string, target: string): string {
  const rel = relative(root, target);
  if (
    rel === ".." ||
    rel.startsWith(`..${sep}`) ||
    resolve(root, rel) !== target
  )
    throw new Error("Blog path escapes its directory / 路径超出目录");
  let current = root;
  for (const part of rel.split(sep).filter(Boolean)) {
    current = resolve(current, part);
    try {
      if (lstatSync(current).isSymbolicLink())
        throw new Error("Symlinks are not supported / 不支持符号链接");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return target;
}

export function publishNote(notesDir: string, blogDir: string, id: unknown) {
  const notesRoot = realpathSync(notesDir);
  const note = resolveSafeNote(id, buildNoteIndex(notesRoot));
  if (!note) throw new Error("Note not found / 笔记不存在");
  const notePath = safePath(notesRoot, note.path);
  if (
    !existsSync(resolve(blogDir, "_config.yml")) ||
    !existsSync(resolve(blogDir, "source/_posts"))
  )
    throw new Error(
      "Set BLOG_DIR to a Hexo blog with source/_posts / 请在设置中配置 Hexo Blog 目录",
    );
  const blogConfig = matter(`---
${readFileSync(resolve(blogDir, "_config.yml"), "utf8")}
---`).data;
  if (blogConfig.source_dir && blogConfig.source_dir !== "source")
    throw new Error(
      "Custom Hexo source_dir is not supported / 暂不支持自定义 source_dir",
    );
  const siteRoot =
    `/${String(blogConfig.root ?? "/").replace(/^\/+|\/+$/g, "")}/`.replace(
      /\/{2,}/g,
      "/",
    );
  const root = realpathSync(blogDir);
  if (
    root === notesRoot ||
    root.startsWith(notesRoot + sep) ||
    notesRoot.startsWith(root + sep)
  )
    throw new Error(
      "Blog and Notes directories must be separate / Blog 与 Notes 目录不能重叠",
    );
  const key = hash(`${notesRoot}\n${note.relPath}`).slice(0, 20);
  const target = safePath(
    root,
    resolve(root, "source/_posts", `brain-${key}.md`),
  );
  const previous = existsSync(target)
    ? matter(readFileSync(target, "utf8"))
    : null;
  if (previous) {
    const { brain_export_hash, ...metadata } = previous.data;
    if (
      metadata.brain_source !== key ||
      brain_export_hash !== hash(matter.stringify(previous.content, metadata))
    )
      throw new Error(
        "Blog article was edited; preserve or remove that copy before republishing / Blog 文章已被修改，请保留或移走该副本后重试",
      );
  }
  const parsed = matter(readFileSync(note.path, "utf8"));
  const assets = new Map<string, Buffer>();
  const replacements: { start: number; end: number; text: string }[] = [];
  let noteLinks = 0;
  function asset(href: string, image: boolean): string {
    const decoded = decodeLocalHref(href);
    const path = safePath(
      notesRoot,
      resolve(
        decoded.startsWith("/") ? notesRoot : dirname(notePath),
        decoded.replace(/^\/+/, ""),
      ),
    );
    if (!existsSync(path) || !statSync(path).isFile())
      throw new Error(`Missing attachment / 附件不存在: ${href}`);
    const bytes = readFileSync(path);
    const extension = extname(path).toLowerCase();
    if (!/^\.[a-z0-9]{1,10}$/.test(extension))
      throw new Error(`Unsupported attachment / 不支持的附件: ${href}`);
    const filename = `${hash(bytes)}${extension}`;
    const destination = safePath(
      root,
      resolve(root, "source/brain-assets", filename),
    );
    if (existsSync(destination) && !readFileSync(destination).equals(bytes))
      throw new Error("Blog attachment conflict / Blog 附件冲突");
    assets.set(destination, bytes);
    // Hexo marked prepends root to images, but does not rewrite attachment links.
    const prefix =
      image &&
      !blogConfig.relative_link &&
      blogConfig.marked?.prependRoot !== false
        ? "/"
        : siteRoot;
    return `${prefix}brain-assets/${filename}`;
  }
  for (const link of extractMarkdownLinks(parsed.content)) {
    if (link.kind === "note") {
      noteLinks++;
      replacements.push({ ...link, text: link.text });
    } else if (link.kind === "asset") {
      const href = asset(link.href, link.image);
      replacements.push({
        ...link,
        text: `${link.image ? "!" : ""}[${link.text}](${formatMarkdownDestination(href, link.suffix, link.title)})`,
      });
    }
  }
  for (const link of extractWikiLinks(parsed.content)) {
    if (link.kind === "note") {
      noteLinks++;
      replacements.push({ ...link, text: link.alias || link.target });
    } else {
      const href = asset(link.path, link.embed);
      const label = (link.alias || basename(link.path)).replace(
        /[\[\]\\\r\n]/g,
        "",
      );
      replacements.push({
        ...link,
        text: `${link.embed ? "!" : ""}[${label}](${href}${link.suffix})`,
      });
    }
  }
  let content = parsed.content;
  for (const replacement of replacements.sort((a, b) => b.start - a.start))
    content =
      content.slice(0, replacement.start) +
      replacement.text +
      content.slice(replacement.end);
  // Only public article metadata is exported; vault-specific fields stay in Notes.
  const metadata: Record<string, unknown> = {
    title: note.title,
    date: previous?.data.date || parsed.data.date || statSync(note.path).mtime,
    tags: normalizeTags(parsed.data.tags),
    categories: normalizeTags(parsed.data.categories),
    layout: "post",
    permalink: `brain/${key}/`,
    brain_source: key,
  };
  const unsigned = matter.stringify(content, metadata);
  const output = matter.stringify(content, {
    ...metadata,
    brain_export_hash: hash(unsigned),
  });
  // Validate and read all inputs before writing. Content-addressed assets never replace existing bytes.
  for (const [path, bytes] of assets) {
    mkdirSync(dirname(path), { recursive: true });
    if (!existsSync(path)) writeFileSync(path, bytes, { flag: "wx" });
  }
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, output, { flag: "wx" });
    renameSync(temporary, target);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
  return { path: target, updated: !!previous, assets: assets.size, noteLinks };
}
