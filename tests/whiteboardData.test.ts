import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  normalizeWhiteboard,
  readWhiteboard,
  writeWhiteboard,
} from "../src/web/whiteboardData.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "brain-whiteboard-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("whiteboard persistence", () => {
  it("writes an atomic JSON document and reads it back", () => {
    const saved = writeWhiteboard(dir, "research-map", {
      title: "Research map",
      cards: [
        {
          id: "card-1",
          title: "Idea",
          body: "Details",
          color: "blue",
          x: 20,
          y: 30,
          sourceId: "resources/idea.md",
        },
      ],
      viewport: { x: 4, y: 8, zoom: 1.2 },
    });

    expect(readWhiteboard(dir, "research-map")).toMatchObject({
      ...saved,
      updatedAt: expect.any(String),
    });
    expect(
      readFileSync(join(dir, ".brain/whiteboards/research-map.json"), "utf8"),
    ).toContain('"version": 1');
  });

  it("rejects unsafe board ids and invalid cards", () => {
    expect(() => writeWhiteboard(dir, "../escape", { cards: [] })).toThrow(
      "invalid-whiteboard-id",
    );
    expect(() =>
      writeWhiteboard(dir, "research-map", {
        cards: [{ id: "x", color: "red" }],
      }),
    ).toThrow("invalid-whiteboard-color");
  });

  it("keeps unique edges that point to existing cards", () => {
    const board = normalizeWhiteboard(
      {
        cards: [
          { id: "a", color: "blue" },
          { id: "b", color: "green" },
        ],
        edges: [
          { id: "one", from: "a", to: "b" },
          { id: "duplicate", from: "a", to: "b" },
          { id: "missing", from: "a", to: "ghost" },
        ],
      },
      "research-map",
    );
    expect(board.edges).toEqual([{ id: "one", from: "a", to: "b" }]);
  });

  it("persists a card collapsed state while ignoring invalid values", () => {
    const board = normalizeWhiteboard(
      {
        version: 2,
        cards: [
          { id: "collapsed", color: "blue", collapsed: true },
          { id: "expanded", color: "green", collapsed: false },
          { id: "legacy", color: "pink", collapsed: "yes" },
        ],
      },
      "research-map",
    );

    expect(board.cards[0]?.collapsed).toBe(true);
    expect(board.cards[1]).not.toHaveProperty("collapsed");
    expect(board.cards[2]).not.toHaveProperty("collapsed");
  });
});
