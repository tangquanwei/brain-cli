import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { settings } from "../config.js";
import { decodeLocalHref, extractMarkdownLinks, formatMarkdownDestination } from "./markdownLinks.js";
import { buildNoteIndex, normalizeAbsPath, notesRelative, toPosixPath } from "./noteIndex.js";

export interface AssetMove {
  old: string;
  new: string;
}

export interface LinkRewrite {
  file: string;
  oldRaw: string;
  newRaw: string;
}

export interface NoteMovePlan {
  oldPath: string;
  newPath: string;
  assetMoves: AssetMove[];
  linkRewrites: LinkRewrite[];
}

export function resolveNewNotePath(oldPath: string, newArg: string): string {
  let resolvedNew = newArg;
  if (!resolvedNew.includes("/") && !resolvedNew.includes("\\")) {
    if (!resolvedNew.endsWith(".md")) resolvedNew += ".md";
    return normalizeAbsPath(join(dirname(oldPath), resolvedNew));
  }
  resolvedNew = resolve(process.cwd(), resolvedNew);
  if (!resolvedNew.endsWith(".md")) resolvedNew += ".md";
  return normalizeAbsPath(resolvedNew);
}

export function findAssetMoves(oldPath: string, newPath: string): AssetMove[] {
  const oldDir = dirname(oldPath);
  const oldStem = basename(oldPath, ".md");
  const newStem = basename(newPath, ".md");
  const candidates: AssetMove[] = [
    { old: join(oldDir, oldStem), new: join(dirname(newPath), newStem) },
    { old: join(oldDir, `${oldStem}.assets`), new: join(dirname(newPath), `${newStem}.assets`) },
  ];
  return candidates.filter(({ old }) => existsSync(old) && statSync(old).isDirectory());
}

function rewriteContentLinks(
  content: string,
  sourceFile: string,
  oldTarget: string,
  newTarget: string,
): { content: string; rewrites: LinkRewrite[] } {
  const links = extractMarkdownLinks(content);
  const replacements: { start: number; end: number; value: string; rewrite: LinkRewrite }[] = [];

  for (const link of links) {
    if (link.kind !== "note") continue;
    const resolved = normalizeAbsPath(resolve(dirname(sourceFile), decodeLocalHref(link.href)));
    if (resolved !== oldTarget) continue;

    const newHref = toPosixPath(relative(dirname(sourceFile), newTarget));
    const destination = formatMarkdownDestination(newHref, link.suffix, link.title, link.angleWrapped);
    const prefix = link.image ? "!" : "";
    const newRaw = `${prefix}[${link.text}](${destination})`;
    replacements.push({
      start: link.start,
      end: link.end,
      value: newRaw,
      rewrite: { file: sourceFile, oldRaw: link.raw, newRaw },
    });
  }

  let rewritten = content;
  for (const replacement of replacements.reverse()) {
    rewritten =
      rewritten.slice(0, replacement.start) + replacement.value + rewritten.slice(replacement.end);
  }
  return { content: rewritten, rewrites: replacements.map((r) => r.rewrite).reverse() };
}

function rewriteMovedNoteAssetLinks(
  content: string,
  oldPath: string,
  newPath: string,
  assetMoves: AssetMove[],
): { content: string; rewrites: LinkRewrite[] } {
  const links = extractMarkdownLinks(content);
  const replacements: { start: number; end: number; value: string; rewrite: LinkRewrite }[] = [];

  for (const link of links) {
    if (link.kind === "external" || link.kind === "anchor" || link.kind === "unknown") continue;

    const oldResolved = normalizeAbsPath(resolve(dirname(oldPath), decodeLocalHref(link.href)));
    let newResolved = oldResolved;
    for (const assetMove of assetMoves) {
      if (oldResolved === assetMove.old || oldResolved.startsWith(`${assetMove.old}/`)) {
        newResolved = normalizeAbsPath(`${assetMove.new}${oldResolved.slice(assetMove.old.length)}`);
        break;
      }
    }

    const newHref = toPosixPath(relative(dirname(newPath), newResolved));
    if (newHref === link.href) continue;

    const destination = formatMarkdownDestination(newHref, link.suffix, link.title, link.angleWrapped);
    const prefix = link.image ? "!" : "";
    const newRaw = `${prefix}[${link.text}](${destination})`;
    replacements.push({
      start: link.start,
      end: link.end,
      value: newRaw,
      rewrite: { file: "", oldRaw: link.raw, newRaw },
    });
  }

  let rewritten = content;
  for (const replacement of replacements.reverse()) {
    rewritten =
      rewritten.slice(0, replacement.start) + replacement.value + rewritten.slice(replacement.end);
  }
  return { content: rewritten, rewrites: replacements.map((r) => r.rewrite).reverse() };
}

export function buildNoteMovePlan(oldPath: string, newPath: string): NoteMovePlan {
  const normalizedOld = normalizeAbsPath(oldPath);
  const normalizedNew = normalizeAbsPath(newPath);
  const assetMoves = findAssetMoves(normalizedOld, normalizedNew);
  const linkRewrites: LinkRewrite[] = [];

  for (const node of buildNoteIndex(settings.notesDir)) {
    const raw = readFileSync(node.path, "utf8");
    const result = rewriteContentLinks(raw, node.path, normalizedOld, normalizedNew);
    linkRewrites.push(...result.rewrites);
  }

  const movedRaw = readFileSync(normalizedOld, "utf8");
  const incomingResult = rewriteContentLinks(movedRaw, normalizedOld, normalizedOld, normalizedNew);
  const assetResult = rewriteMovedNoteAssetLinks(
    incomingResult.content,
    normalizedOld,
    normalizedNew,
    assetMoves,
  );
  linkRewrites.push(
    ...assetResult.rewrites.map((rewrite) => ({ ...rewrite, file: normalizedOld })),
  );

  return { oldPath: normalizedOld, newPath: normalizedNew, assetMoves, linkRewrites };
}

export function applyNoteMovePlan(plan: NoteMovePlan): void {
  const updates = new Map<string, string>();

  for (const node of buildNoteIndex(settings.notesDir)) {
    const raw = readFileSync(node.path, "utf8");
    const result = rewriteContentLinks(raw, node.path, plan.oldPath, plan.newPath);
    if (result.rewrites.length > 0) updates.set(node.path, result.content);
  }

  const movedRaw = updates.get(plan.oldPath) ?? readFileSync(plan.oldPath, "utf8");
  const assetResult = rewriteMovedNoteAssetLinks(
    movedRaw,
    plan.oldPath,
    plan.newPath,
    plan.assetMoves,
  );
  updates.set(plan.oldPath, assetResult.content);

  for (const [file, content] of updates) {
    writeFileSync(file, content, "utf8");
  }

  mkdirSync(dirname(plan.newPath), { recursive: true });
  for (const { old, new: next } of plan.assetMoves) {
    mkdirSync(dirname(next), { recursive: true });
    renameSync(old, next);
  }
  renameSync(plan.oldPath, plan.newPath);
}

export function formatPlanPath(path: string): string {
  return notesRelative(path);
}
