import { buildLinkGraph } from "../utils/linkGraph.js";
import { resolveNoteArg } from "../utils/noteIndex.js";
import { c, log, panel } from "../utils/ui.js";

export async function runBacklinks(noteArg: string): Promise<void> {
  const graph = buildLinkGraph();
  const note = resolveNoteArg(noteArg, graph.nodes);
  if (!note) {
    log(c.error(`❌ 找不到笔记: ${noteArg}`));
    process.exit(1);
  }

  const backlinks = graph.backlinks[note.relPath] ?? [];
  panel(`${c.bold(note.relPath)}\n被 ${backlinks.length} 篇笔记引用`, { borderColor: "cyan" });

  for (const edge of backlinks) {
    log(`- ${edge.fromRel}`);
    log(`  ${c.dim(edge.raw)}`);
  }
}
