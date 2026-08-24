import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { buildLinkGraph } from "../src/utils/linkGraph.js";

function parseSize(value: string | undefined): number {
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1 || size > 100_000) {
    throw new Error("用法: tsx script/benchmark-link-scan.ts <1..100000>");
  }
  return size;
}

function noteContent(index: number, size: number): string {
  const next = (index + 1) % size;
  const link =
    index % 4 === 0
      ? `[[bench/Note ${String(next).padStart(5, "0")}#Details]]`
      : `[Next](<Note ${String(next).padStart(5, "0")}.md#details>)`;
  return [
    `# Note ${String(index).padStart(5, "0")}`,
    "",
    "## Details",
    "",
    `Synthetic benchmark content for note ${index}. ^block-${index}`,
    "",
    link,
    "",
  ].join("\n");
}

const size = parseSize(process.argv[2]);
const root = mkdtempSync(join(tmpdir(), `brain-cli-benchmark-${size}-`));
const notesDir = join(root, "notes");
const benchDir = join(notesDir, "bench");

try {
  mkdirSync(benchDir, { recursive: true });
  for (let index = 0; index < size; index++) {
    writeFileSync(
      join(benchDir, `Note ${String(index).padStart(5, "0")}.md`),
      noteContent(index, size),
      "utf8",
    );
  }

  const rssBefore = process.memoryUsage().rss;
  const started = performance.now();
  const graph = buildLinkGraph(notesDir);
  const elapsedMs = performance.now() - started;
  const rssAfter = process.memoryUsage().rss;
  const peakRssMb = process.resourceUsage().maxRSS / 1024;
  const rssDeltaMb = Math.max(0, rssAfter - rssBefore) / 1024 / 1024;

  if (
    graph.nodes.length !== size ||
    graph.edges.length !== size ||
    graph.brokenLinks.length !== 0 ||
    graph.missingHeadingLinks.length !== 0
  ) {
    throw new Error(
      `基准库校验失败: notes=${graph.nodes.length} links=${graph.edges.length} broken=${graph.brokenLinks.length}`,
    );
  }

  process.stdout.write(
    JSON.stringify({
      notes: graph.nodes.length,
      links: graph.edges.length,
      elapsedMs: Number(elapsedMs.toFixed(1)),
      peakRssMb: Number(peakRssMb.toFixed(1)),
      rssDeltaMb: Number(rssDeltaMb.toFixed(1)),
    }) + "\n",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
