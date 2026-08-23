import { existsSync, readFileSync } from "node:fs";
import {
  createServer,
  type Server,
  type ServerResponse,
} from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import chokidar, { type FSWatcher } from "chokidar";
import { settings } from "../config.js";
import { runCapture, type NoteType } from "../commands/capture.js";
import {
  getNotesByTags,
  getNotesInRange,
  randomSample,
  type NoteMeta,
} from "../commands/review.js";
import { buildDirectoryTree } from "../graph/tree.js";
import { projectLinkGraph } from "../graph/projection.js";
import { autoCommit, isNotesRepo, notesStatusShort } from "../utils/git.js";
import { buildLinkGraph } from "../utils/linkGraph.js";
import { buildNoteIndex, normalizeAbsPath } from "../utils/noteIndex.js";
import {
  applyNoteMovePlan,
  buildNoteMovePlan,
} from "../utils/rewriteLinks.js";
import { openSafeNote, resolveSafeNote } from "../utils/safeOpenNote.js";
import { getDashboard, listNotes, readNoteContent } from "./data.js";
import { json, openBrowser, readJsonBody } from "./http.js";
import { renderWebPage } from "./page.js";

export interface WebServerOptions {
  port: number;
  open: boolean;
}

const NOTE_TYPES: NoteType[] = [
  "Fleeting",
  "Literature",
  "Permanent",
  "Project",
];

function findPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const pkg = resolve(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        const name = (JSON.parse(readFileSync(pkg, "utf8")) as { name?: string })
          .name;
        if (name === "brain-cli") return dir;
      } catch {
        // 继续向上查找
      }
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error("找不到 brain-cli 包根目录");
    dir = parent;
  }
}

function readAppBundle(): string | null {
  const bundle = resolve(findPackageRoot(), "dist", "web", "app.global.js");
  return existsSync(bundle) ? readFileSync(bundle, "utf8") : null;
}

function reviewNoteView(note: NoteMeta): unknown {
  return {
    id: normalizeAbsPath(note.path).replace(
      normalizeAbsPath(settings.notesDir) + "/",
      "",
    ),
    title: note.title,
    date: note.date.toISOString().slice(0, 10),
    tags: note.tags,
  };
}

function resolveMoveTarget(
  oldPath: string,
  arg: string,
): { newPath: string } | { error: string } {
  const trimmed = arg.trim();
  if (!trimmed) return { error: "目标路径不能为空" };
  let candidate = trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
  if (!candidate.includes("/") && !candidate.includes("\\")) {
    candidate = `${dirnameRelative(oldPath)}/${candidate}`;
  }
  const newPath = normalizeAbsPath(resolve(settings.notesDir, candidate));
  const notesRoot = normalizeAbsPath(settings.notesDir);
  if (!newPath.startsWith(notesRoot + "/")) {
    return { error: "目标必须位于 notes 目录内" };
  }
  if (newPath === normalizeAbsPath(oldPath)) return { error: "新旧路径相同" };
  if (existsSync(newPath)) return { error: "目标文件已存在" };
  return { newPath };
}

function dirnameRelative(oldPath: string): string {
  const rel = normalizeAbsPath(oldPath).replace(
    normalizeAbsPath(settings.notesDir) + "/",
    "",
  );
  const idx = rel.lastIndexOf("/");
  return idx < 0 ? "" : rel.slice(0, idx);
}

async function moveNote(
  id: unknown,
  targetArg: unknown,
): Promise<{ status: number; body: unknown }> {
  const nodes = buildNoteIndex(settings.notesDir);
  const node = resolveSafeNote(id, nodes);
  if (!node) return { status: 404, body: { error: "unknown-note" } };
  if (typeof targetArg !== "string") {
    return { status: 400, body: { error: "invalid-target" } };
  }
  const target = resolveMoveTarget(node.path, targetArg);
  if ("error" in target) return { status: 400, body: { error: target.error } };
  const plan = buildNoteMovePlan(node.path, target.newPath);
  applyNoteMovePlan(plan);
  await autoCommit(`🧠 move: ${node.relPath}`);
  return {
    status: 200,
    body: {
      ok: true,
      from: node.relPath,
      to: target.newPath.replace(
        normalizeAbsPath(settings.notesDir) + "/",
        "",
      ),
      linkRewrites: plan.linkRewrites.length,
      assetMoves: plan.assetMoves.length,
    },
  };
}

function handleReview(url: URL, res: Parameters<typeof json>[0]): void {
  const mode = url.searchParams.get("mode") ?? "week";
  const today = new Date();
  let notes: NoteMeta[];
  if (mode === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    notes = getNotesInRange(start, today);
  } else if (mode === "random") {
    const n = Math.min(
      Math.max(parseInt(url.searchParams.get("n") ?? "5", 10) || 5, 1),
      50,
    );
    notes = randomSample(n);
  } else if (mode === "tags") {
    const tags = (url.searchParams.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    notes = getNotesByTags(tags);
  } else {
    const day = today.getDay() || 7;
    const start = new Date(today);
    start.setDate(today.getDate() - (day - 1));
    start.setHours(0, 0, 0, 0);
    notes = getNotesInRange(start, today);
  }
  json(res, 200, { mode, notes: notes.map(reviewNoteView) });
}

export function createWebServer(opts: WebServerOptions): Server {
  const page = renderWebPage();
  const base = `http://127.0.0.1:${opts.port}`;

  // 监听 notes 目录变化，通过 SSE 推送给前端实时刷新
  const sseClients = new Set<ServerResponse>();
  let watcher: FSWatcher | null = null;
  let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
  const broadcastChange = (): void => {
    if (broadcastTimer) return; // 防抖：已有一次待推送
    broadcastTimer = setTimeout(() => {
      broadcastTimer = null;
      for (const res of sseClients) res.write(`data: {"type":"change"}\n\n`);
    }, 300);
  };
  if (existsSync(settings.notesDir)) {
    watcher = chokidar.watch(settings.notesDir, {
      ignored: /(^|[\\/])\../, // dotfiles
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });
    const onFsEvent = (path: string): void => {
      if (/\.(md|markdown|txt)$/i.test(path)) broadcastChange();
    };
    watcher.on("add", onFsEvent);
    watcher.on("change", onFsEvent);
    watcher.on("unlink", onFsEvent);
  }
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", base);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    const path = url.pathname;

    try {
      if (req.method === "GET" && path === "/") {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(page);
        return;
      }
      if (req.method === "GET" && path === "/app.js") {
        const bundle = readAppBundle();
        if (bundle === null) {
          json(res, 503, { error: "前端未构建，请先运行 npm run build" });
          return;
        }
        res.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
          "Cache-Control": "no-cache",
        });
        res.end(bundle);
        return;
      }

      if (req.method === "GET" && path === "/api/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(": connected\n\n");
        sseClients.add(res);
        const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);
        req.on("close", () => {
          clearInterval(heartbeat);
          sseClients.delete(res);
        });
        return;
      }

      if (req.method === "GET" && path === "/api/dashboard") {
        const dashboard = getDashboard(settings.notesDir);
        const notesRepo = await isNotesRepo();
        const pending = notesRepo ? await notesStatusShort() : "";
        json(res, 200, {
          ...dashboard,
          git: {
            notesRepo,
            pendingFiles: pending ? pending.split("\n").filter(Boolean).length : 0,
          },
        });
        return;
      }
      if (req.method === "GET" && path === "/api/tree") {
        json(res, 200, buildDirectoryTree(buildLinkGraph().nodes));
        return;
      }
      if (req.method === "GET" && path === "/api/notes") {
        json(
          res,
          200,
          listNotes(settings.notesDir, {
            q: url.searchParams.get("q") ?? undefined,
            area: url.searchParams.get("area") ?? undefined,
            tag: url.searchParams.get("tag") ?? undefined,
          }),
        );
        return;
      }
      if (req.method === "GET" && path === "/api/note") {
        const note = readNoteContent(
          settings.notesDir,
          url.searchParams.get("id"),
        );
        if (!note) {
          json(res, 404, { error: "unknown-note" });
          return;
        }
        json(res, 200, note);
        return;
      }
      if (req.method === "GET" && path === "/api/backlinks") {
        const id = url.searchParams.get("id");
        const nodes = buildNoteIndex(settings.notesDir);
        if (!resolveSafeNote(id, nodes)) {
          json(res, 404, { error: "unknown-note" });
          return;
        }
        const graph = buildLinkGraph();
        json(res, 200, graph.backlinks[id!] ?? []);
        return;
      }
      if (req.method === "GET" && path === "/api/review") {
        handleReview(url, res);
        return;
      }
      if (req.method === "GET" && path === "/api/links") {
        const graph = buildLinkGraph();
        json(res, 200, {
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          brokenLinks: graph.brokenLinks,
          missingHeadingLinks: graph.missingHeadingLinks,
          nonStandardLinks: graph.nonStandardLinks,
          orphanNotes: graph.orphanNotes.map((n) => n.relPath),
          orphanStats: graph.orphanStats,
        });
        return;
      }
      if (req.method === "GET" && path === "/api/graph") {
        json(res, 200, projectLinkGraph(buildLinkGraph()));
        return;
      }

      if (req.method === "POST" && path === "/api/open") {
        const body = (await readJsonBody(req)) as { id?: unknown };
        if (!openSafeNote(body?.id, buildLinkGraph().nodes)) {
          json(res, 404, { error: "unknown-note" });
          return;
        }
        json(res, 200, { ok: true });
        return;
      }
      if (req.method === "POST" && path === "/api/capture") {
        const body = (await readJsonBody(req)) as {
          title?: unknown;
          content?: unknown;
          tags?: unknown;
          type?: unknown;
        };
        if (typeof body?.title !== "string" || !body.title.trim()) {
          json(res, 400, { error: "标题不能为空" });
          return;
        }
        const type = NOTE_TYPES.includes(body.type as NoteType)
          ? (body.type as NoteType)
          : "Fleeting";
        const tags = Array.isArray(body.tags)
          ? body.tags.map((t) => String(t).trim()).filter(Boolean)
          : [];
        const filepath = await runCapture({
          title: body.title.trim(),
          content: typeof body.content === "string" ? body.content : "",
          tags,
          type,
        });
        json(res, 200, {
          ok: true,
          id: normalizeAbsPath(filepath).replace(
            normalizeAbsPath(settings.notesDir) + "/",
            "",
          ),
        });
        return;
      }
      if (req.method === "POST" && path === "/api/rename") {
        const body = (await readJsonBody(req)) as {
          id?: unknown;
          newName?: unknown;
        };
        if (typeof body?.newName !== "string") {
          json(res, 400, { error: "invalid-name" });
          return;
        }
        if (body.newName.includes("/") || body.newName.includes("\\")) {
          json(res, 400, { error: "重命名不能包含路径分隔符" });
          return;
        }
        const result = await moveNote(body?.id, body.newName);
        json(res, result.status, result.body);
        return;
      }
      if (req.method === "POST" && path === "/api/move") {
        const body = (await readJsonBody(req)) as {
          id?: unknown;
          newPath?: unknown;
        };
        const result = await moveNote(body?.id, body?.newPath);
        json(res, result.status, result.body);
        return;
      }

      json(res, 404, { error: "not-found" });
    } catch (error) {
      const message = (error as Error).message;
      const status =
        message === "request-too-large"
          ? 413
          : message === "invalid-json"
            ? 400
            : 500;
      json(res, status, { error: message });
    }
  });

  server.on("close", () => {
    if (broadcastTimer) clearTimeout(broadcastTimer);
    void watcher?.close();
  });

  server.listen(opts.port, "127.0.0.1", () => {
    if (opts.open) openBrowser(base);
  });
  return server;
}
