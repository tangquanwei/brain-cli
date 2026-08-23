import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { settings } from "../config.js";
import { buildLinkGraph } from "../utils/linkGraph.js";
import { c, log, panel } from "../utils/ui.js";

export interface LinksOptions {
  check: boolean;
  json: boolean;
  orphans: boolean;
  stats: boolean;
  scope: "active" | "all";
  write: boolean;
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function printStats(graph: ReturnType<typeof buildLinkGraph>): void {
  log(c.info("\nOrphan statistics:"));
  for (const [area, stats] of Object.entries(graph.orphanStats.byArea)) {
    log(
      `- ${area}: ${stats.orphans}/${stats.notes} (${formatRate(stats.orphanRate)})`,
    );
  }
  const active = graph.orphanStats.active;
  log(
    c.bold(
      `Active total: ${active.orphans}/${active.notes} (${formatRate(active.orphanRate)})`,
    ),
  );
}

function printProblems(graph: ReturnType<typeof buildLinkGraph>): void {
  if (graph.brokenLinks.length > 0) {
    log(c.error("\nBroken links:"));
    for (const edge of graph.brokenLinks) {
      log(`- ${edge.fromRel} -> ${edge.href}${edge.suffix}`);
    }
  }

  if (graph.missingHeadingLinks.length > 0) {
    log(c.warn("\nMissing headings:"));
    for (const edge of graph.missingHeadingLinks) {
      log(`- ${edge.fromRel} -> ${edge.href}${edge.suffix}`);
    }
  }

  if (graph.nonStandardLinks.length > 0) {
    log(c.warn("\nNon-standard wikilinks:"));
    for (const link of graph.nonStandardLinks) {
      log(`- ${link.file} -> ${link.raw}`);
    }
  }
}

export async function runLinks(opts: LinksOptions): Promise<void> {
  const graph = buildLinkGraph();

  if (opts.json) {
    log(JSON.stringify(graph, null, 2));
    return;
  }

  if (opts.write) {
    const out = resolve(settings.notesDir, ".brain", "links.json");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(graph, null, 2), "utf8");
    log(`${c.success("✓")} 已写入 ${out}`);
  }

  panel(
    [
      c.bold("Markdown 链接检查"),
      `笔记数: ${graph.nodes.length}`,
      `内部链接: ${graph.edges.length}`,
      `断链: ${graph.brokenLinks.length}`,
      `缺失标题: ${graph.missingHeadingLinks.length}`,
      `非标准链接: ${graph.nonStandardLinks.length}`,
      `孤岛笔记: ${graph.orphanNotes.length}`,
      `活跃孤岛: ${graph.orphanStats.active.orphans}/${graph.orphanStats.active.notes}`,
    ].join("\n"),
    { borderColor: graph.brokenLinks.length > 0 ? "red" : "cyan" },
  );

  printProblems(graph);

  if (opts.stats) printStats(graph);

  if (opts.orphans) {
    const orphanNotes =
      opts.scope === "active"
        ? graph.orphanNotes.filter((node) =>
            /^(projects|areas|resources|questions)\//.test(node.relPath),
          )
        : graph.orphanNotes;
    log(c.info(`\nOrphan notes (${opts.scope}):`));
    for (const node of orphanNotes) log(`- ${node.relPath}`);
  }

  if (
    opts.check &&
    (graph.brokenLinks.length > 0 || graph.missingHeadingLinks.length > 0)
  ) {
    process.exitCode = 1;
  }
}
