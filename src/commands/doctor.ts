import { accessSync, constants, existsSync, statSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { settings } from "../config.js";
import { buildLinkGraph } from "../utils/linkGraph.js";
import { c, log, panel, table } from "../utils/ui.js";

export interface DoctorOptions {
  json: boolean;
}

export interface DoctorResult {
  vault: string;
  readable: boolean;
  notes: number;
  links: number;
  markdownLinks: number;
  wikiLinks: number;
  brokenLinks: number;
  missingReferences: number;
  missingAssets: number;
  ambiguousWikiLinks: number;
  orphanNotes: number;
  obsidianVault: boolean;
  scanMs: number;
}

function assertReadableDirectory(vault: string): void {
  if (!existsSync(vault)) {
    throw new Error(`知识库目录不存在: ${vault}`);
  }
  if (!statSync(vault).isDirectory()) {
    throw new Error(`知识库路径不是目录: ${vault}`);
  }
  try {
    accessSync(vault, constants.R_OK);
  } catch {
    throw new Error(`知识库目录不可读: ${vault}`);
  }
}

export function inspectVault(vault = settings.notesDir): DoctorResult {
  assertReadableDirectory(vault);
  const started = performance.now();
  const graph = buildLinkGraph(vault);
  const scanMs = performance.now() - started;
  const wikiLinks = graph.edges.filter(
    (edge) => edge.syntax === "wikilink",
  ).length;

  return {
    vault,
    readable: true,
    notes: graph.nodes.length,
    links: graph.edges.length,
    markdownLinks: graph.edges.length - wikiLinks,
    wikiLinks,
    brokenLinks: graph.brokenLinks.length,
    missingReferences: graph.missingHeadingLinks.length,
    missingAssets: graph.missingAssets.length,
    ambiguousWikiLinks: graph.nonStandardLinks.length,
    orphanNotes: graph.orphanNotes.length,
    obsidianVault: existsSync(resolve(vault, ".obsidian")),
    scanMs: Number(scanMs.toFixed(1)),
  };
}

export async function runDoctor(opts: DoctorOptions): Promise<void> {
  const result = inspectVault();

  if (opts.json) {
    log(JSON.stringify(result, null, 2));
  } else {
    panel(
      [
        c.bold("知识库体检（只读）"),
        result.vault,
        `扫描耗时: ${result.scanMs.toFixed(1)} ms`,
      ].join("\n"),
      {
        borderColor:
          result.brokenLinks || result.missingReferences || result.missingAssets
            ? "yellow"
            : "green",
      },
    );
    table({
      rows: [
        ["目录可读", result.readable ? "✅" : "❌"],
        ["Obsidian Vault", result.obsidianVault ? "✅" : "—"],
        ["Markdown 笔记", result.notes],
        ["标准 Markdown 链接", result.markdownLinks],
        ["WikiLink / 嵌入笔记", result.wikiLinks],
        ["断链", result.brokenLinks],
        ["缺失标题或块引用", result.missingReferences],
        ["缺失图片或附件", result.missingAssets],
        ["歧义 WikiLink", result.ambiguousWikiLinks],
        ["孤岛笔记", result.orphanNotes],
      ],
    });
    log(c.dim("\n只读完成：未创建目录、未迁移文件、未写入缓存。"));
  }

  if (
    result.brokenLinks > 0 ||
    result.missingReferences > 0 ||
    result.missingAssets > 0 ||
    result.ambiguousWikiLinks > 0
  ) {
    process.exitCode = 1;
  }
}
