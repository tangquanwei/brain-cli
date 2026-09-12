import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { readWhiteboard, type WhiteboardDocument } from "./whiteboardData.js";

export interface DrawingScene {
  type: "excalidraw";
  version: number;
  source: string;
  elements: Record<string, unknown>[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

export interface DrawingDocument {
  id: string;
  title: string;
  scene: DrawingScene | null;
  legacy?: WhiteboardDocument;
  revision: string | null;
  updatedAt: string;
}

function drawingPath(
  notesDir: string,
  id: string,
  extension = "excalidraw",
): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id))
    throw new Error("invalid-whiteboard-id");
  return resolve(notesDir, ".brain/whiteboards", `${id}.${extension}`);
}

export function emptyScene(): DrawingScene {
  return {
    type: "excalidraw",
    version: 2,
    source: "brain-cli",
    elements: [],
    appState: {},
    files: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function validateScene(value: unknown): DrawingScene {
  if (
    !isRecord(value) ||
    value.type !== "excalidraw" ||
    value.version !== 2 ||
    !Array.isArray(value.elements) ||
    value.elements.length > 20000 ||
    !isRecord(value.appState) ||
    !isRecord(value.files)
  )
    throw new Error("invalid-excalidraw-scene");
  const ids = new Set<string>();
  const types = new Set([
    "rectangle",
    "diamond",
    "ellipse",
    "line",
    "arrow",
    "freedraw",
    "text",
    "image",
    "frame",
    "magicframe",
    "embeddable",
    "iframe",
  ]);
  for (const element of value.elements) {
    if (
      !isRecord(element) ||
      typeof element.id !== "string" ||
      !element.id ||
      ids.has(element.id) ||
      !types.has(String(element.type)) ||
      ![element.x, element.y, element.width, element.height].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      )
    ) {
      throw new Error("invalid-excalidraw-element");
    }
    ids.add(element.id);
  }
  for (const file of Object.values(value.files)) {
    if (
      !isRecord(file) ||
      typeof file.id !== "string" ||
      typeof file.dataURL !== "string" ||
      !/^data:image\/(png|jpeg|gif|webp|svg\+xml|avif);base64,/i.test(
        file.dataURL,
      )
    ) {
      throw new Error("invalid-excalidraw-file");
    }
  }
  return {
    type: "excalidraw",
    version: 2,
    source: "brain-cli",
    elements: value.elements,
    appState: value.appState,
    files: value.files,
  };
}

export function readDrawing(notesDir: string, id: string): DrawingDocument {
  const scenePath = drawingPath(notesDir, id);
  const legacyPath = drawingPath(notesDir, id, "json");
  const path = existsSync(scenePath)
    ? scenePath
    : existsSync(legacyPath)
      ? legacyPath
      : null;
  if (!path)
    return {
      id,
      title: id,
      scene: emptyScene(),
      revision: null,
      updatedAt: "",
    };
  const raw = readFileSync(path, "utf8");
  const revision = createHash("sha256").update(raw).digest("hex");
  const updatedAt = statSync(path).mtime.toISOString();
  if (path === legacyPath) {
    const legacy = readWhiteboard(notesDir, id)!;
    return {
      id,
      title: legacy.title,
      scene: null,
      legacy,
      revision,
      updatedAt,
    };
  }
  const input = JSON.parse(raw);
  return {
    id,
    title: typeof input.brain?.title === "string" ? input.brain.title : id,
    scene: validateScene(input),
    revision,
    updatedAt,
  };
}

export function writeDrawing(
  notesDir: string,
  id: string,
  scene: unknown,
  title: unknown,
  revision: unknown,
): DrawingDocument {
  const path = drawingPath(notesDir, id);
  const normalized = validateScene(scene);
  // Compare the exact disk content; an SSE debounce window cannot detect competing edits.
  if (readDrawing(notesDir, id).revision !== revision)
    throw new Error("whiteboard-conflict");
  if (typeof title !== "string" || !title.trim() || title.length > 200)
    throw new Error("invalid-whiteboard-title");
  mkdirSync(resolve(notesDir, ".brain/whiteboards"), { recursive: true });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(
      temp,
      `${JSON.stringify({ ...normalized, brain: { title: title.trim() } }, null, 2)}\n`,
      "utf8",
    );
    renameSync(temp, path);
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
  // The legacy JSON is deliberately retained as a migration backup.
  return readDrawing(notesDir, id);
}

export function listDrawings(
  notesDir: string,
): Pick<DrawingDocument, "id" | "title" | "updatedAt">[] {
  const dir = resolve(notesDir, ".brain/whiteboards");
  if (!existsSync(dir)) return [];
  const ids = new Set(
    readdirSync(dir)
      .filter((name) => /\.(json|excalidraw)$/.test(name))
      .map((name) => name.replace(/\.(json|excalidraw)$/, "")),
  );
  return [...ids]
    .flatMap((id) => {
      try {
        const { title, updatedAt } = readDrawing(notesDir, id);
        return [{ id, title, updatedAt }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteDrawing(
  notesDir: string,
  id: string,
  revision: unknown,
): void {
  if (readDrawing(notesDir, id).revision !== revision)
    throw new Error("whiteboard-conflict");
  for (const extension of ["excalidraw", "json"]) {
    const path = drawingPath(notesDir, id, extension);
    if (existsSync(path)) unlinkSync(path);
  }
}
