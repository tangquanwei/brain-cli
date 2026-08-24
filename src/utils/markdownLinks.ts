import { extname } from "node:path";

export type MarkdownLinkKind =
  | "note"
  | "asset"
  | "external"
  | "anchor"
  | "unknown";

export interface MarkdownLink {
  raw: string;
  text: string;
  destination: string;
  href: string;
  suffix: string;
  title?: string;
  start: number;
  end: number;
  image: boolean;
  angleWrapped: boolean;
  kind: MarkdownLinkKind;
}

export interface WikiLink {
  raw: string;
  target: string;
  path: string;
  suffix: string;
  alias?: string;
  start: number;
  end: number;
  embed: boolean;
  kind: "note" | "asset";
}

const EXTERNAL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const OBSIDIAN_ASSET_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".canvas",
  ".csv",
  ".gif",
  ".jpeg",
  ".jpg",
  ".m4a",
  ".mov",
  ".mp3",
  ".mp4",
  ".pdf",
  ".png",
  ".svg",
  ".txt",
  ".wav",
  ".webm",
  ".webp",
]);

function maskCode(content: string): string {
  let fence: { char: "`" | "~"; length: number } | undefined;
  return (content.match(/[^\n]*(?:\n|$)/g) ?? [])
    .map((line) => {
      const body = line.endsWith("\n") ? line.slice(0, -1) : line;
      const marker = body.match(/^\s*(`{3,}|~{3,})/u)?.[1];
      const wasInFence = fence !== undefined;
      if (!fence && marker) {
        fence = { char: marker[0] as "`" | "~", length: marker.length };
      } else if (
        fence &&
        new RegExp(`^\\s*${fence.char}{${fence.length},}\\s*$`, "u").test(body)
      ) {
        fence = undefined;
      }

      if (wasInFence || marker) return line.replace(/[^\r\n]/g, " ");
      return line.replace(/`[^`\n]*`/g, (match) => " ".repeat(match.length));
    })
    .join("");
}

function isNumericLiteral(target: string): boolean {
  return /^-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)*$/.test(target.trim());
}

function splitDestination(raw: string): {
  href: string;
  suffix: string;
  title?: string;
  angleWrapped: boolean;
} {
  const trimmed = raw.trim();
  const angle = trimmed.match(/^<([^>]+)>(.*)$/);
  const target = angle ? (angle[1] ?? "") : trimmed;
  const rest = angle ? (angle[2] ?? "").trim() : "";

  if (angle) {
    const hashIndex = target.indexOf("#");
    const queryIndex = target.indexOf("?");
    const suffixStart = [hashIndex, queryIndex]
      .filter((n) => n >= 0)
      .sort((a, b) => a - b)[0];
    return {
      href: suffixStart === undefined ? target : target.slice(0, suffixStart),
      suffix: suffixStart === undefined ? "" : target.slice(suffixStart),
      title: rest || undefined,
      angleWrapped: true,
    };
  }

  const quotedTitle = target.match(
    /^(\S+)\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/,
  );
  const hrefWithSuffix = quotedTitle ? (quotedTitle[1] ?? "") : target;
  const title = quotedTitle
    ? (quotedTitle[2] ?? quotedTitle[3] ?? quotedTitle[4])
    : undefined;

  const hashIndex = hrefWithSuffix.indexOf("#");
  const queryIndex = hrefWithSuffix.indexOf("?");
  const suffixStart = [hashIndex, queryIndex]
    .filter((n) => n >= 0)
    .sort((a, b) => a - b)[0];
  const href =
    suffixStart === undefined
      ? hrefWithSuffix
      : hrefWithSuffix.slice(0, suffixStart);
  const suffix =
    suffixStart === undefined ? "" : hrefWithSuffix.slice(suffixStart);

  return { href, suffix, title, angleWrapped: false };
}

export function classifyMarkdownLink(link: MarkdownLink): MarkdownLinkKind {
  const href = link.href.trim();
  if (!href && link.suffix.startsWith("#")) return "anchor";
  if (!href) return "unknown";
  if (href.startsWith("#")) return "anchor";
  if (EXTERNAL_RE.test(href)) return "external";
  if (extname(href).toLowerCase() === ".md") return "note";
  return "asset";
}

export function formatMarkdownDestination(
  href: string,
  suffix = "",
  title?: string,
  forceAngle = false,
): string {
  const target = `${href}${suffix}`;
  const needsAngle = forceAngle || /[\s()]/.test(target);
  const dest = needsAngle ? `<${target}>` : target;
  return title ? `${dest} "${title}"` : dest;
}

export function decodeLocalHref(href: string): string {
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
}

export function extractMarkdownLinks(content: string): MarkdownLink[] {
  const masked = maskCode(content);
  const links: MarkdownLink[] = [];

  for (let i = 0; i < masked.length; i++) {
    const image = masked[i] === "!" && masked[i + 1] === "[";
    const labelStart = image ? i + 1 : i;
    if (masked[labelStart] !== "[") continue;

    let labelEnd = -1;
    for (let j = labelStart + 1; j < masked.length; j++) {
      if (masked[j] === "\\" && j + 1 < masked.length) {
        j++;
        continue;
      }
      if (masked[j] === "]") {
        labelEnd = j;
        break;
      }
    }
    if (labelEnd < 0 || masked[labelEnd + 1] !== "(") continue;

    let depth = 0;
    let destEnd = -1;
    for (let j = labelEnd + 2; j < masked.length; j++) {
      if (masked[j] === "\\" && j + 1 < masked.length) {
        j++;
        continue;
      }
      if (masked[j] === "(") depth++;
      if (masked[j] === ")") {
        if (depth === 0) {
          destEnd = j;
          break;
        }
        depth--;
      }
    }
    if (destEnd < 0) continue;

    const start = image ? i : labelStart;
    const end = destEnd + 1;
    const raw = content.slice(start, end);
    const text = content.slice(labelStart + 1, labelEnd);
    const destination = content.slice(labelEnd + 2, destEnd);
    const parsed = splitDestination(destination);
    const link: MarkdownLink = {
      raw,
      text,
      destination,
      href: parsed.href,
      suffix: parsed.suffix,
      title: parsed.title,
      start,
      end,
      image,
      angleWrapped: parsed.angleWrapped,
      kind: "unknown",
    };
    link.kind = classifyMarkdownLink(link);
    links.push(link);
    i = destEnd;
  }

  return links;
}

export function extractWikiLinks(content: string): WikiLink[] {
  const masked = maskCode(content);
  const links: WikiLink[] = [];
  const re = /!?\[\[([^\]\n]+)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(masked)) !== null) {
    const raw = content.slice(match.index, match.index + match[0].length);
    const inner = (match[1] ?? "").trim();
    if (isNumericLiteral(inner)) continue;
    const pipeIndex = inner.indexOf("|");
    const target = (pipeIndex < 0 ? inner : inner.slice(0, pipeIndex)).trim();
    const alias =
      pipeIndex < 0
        ? undefined
        : inner.slice(pipeIndex + 1).trim() || undefined;
    const hashIndex = target.indexOf("#");
    const path = (hashIndex < 0 ? target : target.slice(0, hashIndex)).trim();
    const suffix = hashIndex < 0 ? "" : target.slice(hashIndex);
    const extension = extname(path).toLowerCase();
    links.push({
      raw,
      target,
      path,
      suffix,
      alias,
      start: match.index,
      end: match.index + match[0].length,
      embed: raw.startsWith("!"),
      kind:
        extension &&
        extension !== ".md" &&
        OBSIDIAN_ASSET_EXTENSIONS.has(extension)
          ? "asset"
          : "note",
    });
  }
  return links;
}

export function formatWikiLink(
  path: string,
  suffix = "",
  alias?: string,
  embed = false,
): string {
  const target = `${path}${suffix}`;
  return `${embed ? "!" : ""}[[${target}${alias ? `|${alias}` : ""}]]`;
}
