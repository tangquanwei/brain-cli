import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

export type WhiteboardColor = "blue" | "yellow" | "green" | "pink";

export interface WhiteboardCard {
  id: string;
  title: string;
  body: string;
  color: WhiteboardColor;
  x: number;
  y: number;
  sourceId?: string;
}

export interface WhiteboardEdge {
  id: string;
  from: string;
  to: string;
}

export interface WhiteboardDocument {
  version: 1;
  id: string;
  title: string;
  cards: WhiteboardCard[];
  edges: WhiteboardEdge[];
  viewport: { x: number; y: number; zoom: number };
  updatedAt: string;
}

export const DEFAULT_WHITEBOARD_ID = "research-map";

const WHITEBOARD_DIR = ".brain/whiteboards";
const COLORS = new Set<WhiteboardColor>(["blue", "yellow", "green", "pink"]);

function boardPath(notesDir: string, id: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) {
    throw new Error("invalid-whiteboard-id");
  }
  return resolve(notesDir, WHITEBOARD_DIR, `${id}.json`);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeCard(value: unknown, index: number): WhiteboardCard {
  if (!value || typeof value !== "object")
    throw new Error("invalid-whiteboard-card");
  const card = value as Partial<WhiteboardCard>;
  if (typeof card.id !== "string" || !card.id.trim())
    throw new Error("invalid-whiteboard-card");
  if (!COLORS.has(card.color as WhiteboardColor))
    throw new Error("invalid-whiteboard-color");
  return {
    id: card.id.slice(0, 120),
    title:
      typeof card.title === "string"
        ? card.title.slice(0, 500)
        : `Card ${index + 1}`,
    body: typeof card.body === "string" ? card.body.slice(0, 20000) : "",
    color: card.color as WhiteboardColor,
    x: Math.max(-1_000_000, Math.min(1_000_000, finiteNumber(card.x, 0))),
    y: Math.max(-1_000_000, Math.min(1_000_000, finiteNumber(card.y, 0))),
    ...(typeof card.sourceId === "string" && card.sourceId.length <= 1000
      ? { sourceId: card.sourceId }
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
  if (!Array.isArray(input.cards) || input.cards.length > 1000) {
    throw new Error("invalid-whiteboard-cards");
  }
  const viewport = input.viewport;
  const cards = input.cards.map(normalizeCard);
  const cardIds = new Set(cards.map((card) => card.id));
  return {
    version: 1,
    id,
    title: typeof input.title === "string" ? input.title.slice(0, 200) : id,
    cards,
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
