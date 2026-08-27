import {
  existsSync,
  readdirSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

export type WhiteboardColor = "blue" | "yellow" | "green" | "pink";
export type WhiteboardCardKind = "note" | "text" | "block" | "attachment";

export interface WhiteboardCard {
  id: string;
  kind?: WhiteboardCardKind;
  title: string;
  body: string;
  color: WhiteboardColor;
  x: number;
  y: number;
  sourceId?: string;
  source?: { noteId?: string; blockId?: string; path?: string };
  tags?: string[];
  zIndex?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WhiteboardFrame {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: WhiteboardColor;
  zIndex?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WhiteboardEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind?: "semantic" | "supports" | "contradicts" | "causes" | "references";
}

export interface WhiteboardDocument {
  version: 1 | 2;
  id: string;
  title: string;
  cards: WhiteboardCard[];
  frames?: WhiteboardFrame[];
  edges: WhiteboardEdge[];
  viewport: { x: number; y: number; zoom: number };
  updatedAt: string;
}

export const DEFAULT_WHITEBOARD_ID = "research-map";

const WHITEBOARD_DIR = ".brain/whiteboards";
const COLORS = new Set<WhiteboardColor>(["blue", "yellow", "green", "pink"]);
const EDGE_KINDS = new Set<NonNullable<WhiteboardEdge["kind"]>>([
  "semantic",
  "supports",
  "contradicts",
  "causes",
  "references",
]);

export interface WhiteboardSummary {
  id: string;
  title: string;
  updatedAt: string;
}

function boardPath(notesDir: string, id: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) {
    throw new Error("invalid-whiteboard-id");
  }
  return resolve(notesDir, WHITEBOARD_DIR, `${id}.json`);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeCard(
  value: unknown,
  index: number,
  version: 1 | 2,
): WhiteboardCard {
  if (!value || typeof value !== "object")
    throw new Error("invalid-whiteboard-card");
  const card = value as Partial<WhiteboardCard>;
  if (typeof card.id !== "string" || !card.id.trim())
    throw new Error("invalid-whiteboard-card");
  if (!COLORS.has(card.color as WhiteboardColor))
    throw new Error("invalid-whiteboard-color");
  const now = new Date().toISOString();
  const sourceId =
    typeof card.sourceId === "string" && card.sourceId.length <= 1000
      ? card.sourceId
      : undefined;
  const source =
    card.source && typeof card.source === "object"
      ? Object.fromEntries(
          Object.entries(card.source).filter(
            ([key, value]) =>
              ["noteId", "blockId", "path"].includes(key) &&
              typeof value === "string" &&
              value.length <= 1000,
          ),
        )
      : undefined;
  return {
    id: card.id.slice(0, 120),
    ...(version >= 2
      ? {
          kind:
            card.kind === "note" ||
            card.kind === "block" ||
            card.kind === "attachment"
              ? card.kind
              : sourceId
                ? "note"
                : "text",
        }
      : {}),
    title:
      typeof card.title === "string"
        ? card.title.slice(0, 500)
        : `Card ${index + 1}`,
    body: typeof card.body === "string" ? card.body.slice(0, 20000) : "",
    color: card.color as WhiteboardColor,
    x: Math.max(-1_000_000, Math.min(1_000_000, finiteNumber(card.x, 0))),
    y: Math.max(-1_000_000, Math.min(1_000_000, finiteNumber(card.y, 0))),
    ...(sourceId
      ? { sourceId, source: source ?? { noteId: sourceId } }
      : source
        ? { source }
        : {}),
    ...(Array.isArray(card.tags)
      ? {
          tags: card.tags
            .map(String)
            .map((tag) => tag.slice(0, 80))
            .slice(0, 50),
        }
      : {}),
    ...(version >= 2
      ? {
          zIndex: finiteNumber(card.zIndex, index),
          createdAt: typeof card.createdAt === "string" ? card.createdAt : now,
          updatedAt: typeof card.updatedAt === "string" ? card.updatedAt : now,
        }
      : {}),
  };
}

function normalizeEdges(
  value: unknown,
  cardIds: Set<string>,
): WhiteboardEdge[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 2000) {
    throw new Error("invalid-whiteboard-edges");
  }
  const seen = new Set<string>();
  const edges: WhiteboardEdge[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object")
      throw new Error("invalid-whiteboard-edge");
    const edge = item as Partial<WhiteboardEdge>;
    if (
      typeof edge.from !== "string" ||
      typeof edge.to !== "string" ||
      edge.from === edge.to
    ) {
      throw new Error("invalid-whiteboard-edge");
    }
    if (!cardIds.has(edge.from) || !cardIds.has(edge.to)) continue;
    const key = `${edge.from}->${edge.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({
      id: typeof edge.id === "string" && edge.id ? edge.id.slice(0, 120) : key,
      from: edge.from,
      to: edge.to,
      ...(typeof edge.label === "string"
        ? { label: edge.label.slice(0, 300) }
        : {}),
      ...(EDGE_KINDS.has(edge.kind as NonNullable<WhiteboardEdge["kind"]>)
        ? { kind: edge.kind as WhiteboardEdge["kind"] }
        : {}),
    });
  }
  return edges;
}

export function normalizeWhiteboard(
  value: unknown,
  id: string,
): WhiteboardDocument {
  if (!value || typeof value !== "object")
    throw new Error("invalid-whiteboard");
  const input = value as Partial<WhiteboardDocument>;
  const version = input.version === 2 ? 2 : 1;
  if (!Array.isArray(input.cards) || input.cards.length > 1000) {
    throw new Error("invalid-whiteboard-cards");
  }
  const viewport = input.viewport;
  const cards = input.cards.map((card, index) =>
    normalizeCard(card, index, version),
  );
  const cardIds = new Set(cards.map((card) => card.id));
  return {
    version,
    id,
    title: typeof input.title === "string" ? input.title.slice(0, 200) : id,
    cards,
    ...(version >= 2 && Array.isArray(input.frames)
      ? {
          frames: input.frames
            .slice(0, 200)
            .filter((frame) => frame && typeof frame === "object")
            .map((frame, index) => ({
              id:
                typeof frame.id === "string" && frame.id
                  ? frame.id.slice(0, 120)
                  : `frame-${index + 1}`,
              title:
                typeof frame.title === "string"
                  ? frame.title.slice(0, 200)
                  : "Frame",
              x: Math.max(
                -1_000_000,
                Math.min(1_000_000, finiteNumber(frame.x, 0)),
              ),
              y: Math.max(
                -1_000_000,
                Math.min(1_000_000, finiteNumber(frame.y, 0)),
              ),
              width: Math.max(
                40,
                Math.min(1_000_000, finiteNumber(frame.width, 400)),
              ),
              height: Math.max(
                40,
                Math.min(1_000_000, finiteNumber(frame.height, 300)),
              ),
              ...(COLORS.has(frame.color as WhiteboardColor)
                ? { color: frame.color as WhiteboardColor }
                : {}),
              zIndex: finiteNumber(frame.zIndex, -1),
              createdAt:
                typeof frame.createdAt === "string"
                  ? frame.createdAt
                  : new Date().toISOString(),
              updatedAt:
                typeof frame.updatedAt === "string"
                  ? frame.updatedAt
                  : new Date().toISOString(),
            })),
        }
      : {}),
    edges: normalizeEdges(input.edges, cardIds),
    viewport: {
      x: finiteNumber(viewport?.x, 24),
      y: finiteNumber(viewport?.y, 24),
      zoom: Math.max(0.6, Math.min(1.6, finiteNumber(viewport?.zoom, 1))),
    },
    updatedAt: new Date().toISOString(),
  };
}

export function emptyWhiteboard(
  id = DEFAULT_WHITEBOARD_ID,
): WhiteboardDocument {
  return normalizeWhiteboard(
    {
      id,
      title: id,
      cards: [],
      edges: [],
      viewport: { x: 24, y: 24, zoom: 1 },
    },
    id,
  );
}

export function readWhiteboard(
  notesDir: string,
  id = DEFAULT_WHITEBOARD_ID,
): WhiteboardDocument | null {
  const filepath = boardPath(notesDir, id);
  if (!existsSync(filepath)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filepath, "utf8"));
  } catch {
    throw new Error("invalid-whiteboard-json");
  }
  return normalizeWhiteboard(parsed, id);
}

export function writeWhiteboard(
  notesDir: string,
  id: string,
  value: unknown,
): WhiteboardDocument {
  const filepath = boardPath(notesDir, id);
  const document = normalizeWhiteboard(value, id);
  const dir = resolve(notesDir, WHITEBOARD_DIR);
  mkdirSync(dir, { recursive: true });
  const temp = resolve(dir, `.${id}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temp, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  renameSync(temp, filepath);
  return document;
}

export function listWhiteboards(notesDir: string): WhiteboardSummary[] {
  const dir = resolve(notesDir, WHITEBOARD_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.slice(0, -5))
    .filter((id) => /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id))
    .map((id) => {
      try {
        const board = readWhiteboard(notesDir, id);
        return board
          ? { id, title: board.title, updatedAt: board.updatedAt }
          : null;
      } catch {
        return null;
      }
    })
    .filter((item): item is WhiteboardSummary => item !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteWhiteboard(notesDir: string, id: string): void {
  const filepath = boardPath(notesDir, id);
  if (existsSync(filepath)) unlinkSync(filepath);
}
