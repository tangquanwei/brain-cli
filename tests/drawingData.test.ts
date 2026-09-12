import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  deleteDrawing,
  emptyScene,
  listDrawings,
  readDrawing,
  writeDrawing,
} from "../src/web/drawingData.js";
import { writeWhiteboard } from "../src/web/whiteboardData.js";
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "brain-drawing-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});
it("saves references, bound arrows, viewport and images, rejects stale writes and deduplicates migration backups", () => {
  writeWhiteboard(dir, "old", {
    cards: [{ id: "a", color: "blue", title: "Original", body: "Keep me" }],
  });
  const legacyPath = join(dir, ".brain/whiteboards/old.json");
  const backup = readFileSync(legacyPath, "utf8");
  const legacy = readDrawing(dir, "old");
  expect(legacy.legacy?.cards[0]?.body).toBe("Keep me");
  const scene = emptyScene();
  scene.elements = [
    {
      id: "a",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      customData: { brain: { noteId: "资源/笔记.md" } },
    },
    {
      id: "arrow",
      type: "arrow",
      x: 210,
      y: 50,
      width: 100,
      height: 10,
      startBinding: { elementId: "a" },
    },
  ];
  scene.appState = { scrollX: 42, zoom: { value: 1.5 } };
  scene.files = {
    image: {
      id: "image",
      dataURL: "data:image/png;base64,AAAA",
      mimeType: "image/png",
    },
  };
  const saved = writeDrawing(dir, "old", scene, "迁移白板", legacy.revision);
  expect(saved.scene).toEqual(scene);
  expect(readFileSync(legacyPath, "utf8")).toBe(backup);
  expect(listDrawings(dir)).toHaveLength(1);
  expect(readDrawing(dir, "old").revision).toBe(saved.revision);
  expect(() =>
    writeDrawing(dir, "old", emptyScene(), "Stale", legacy.revision),
  ).toThrow("whiteboard-conflict");
  expect(() => deleteDrawing(dir, "old", legacy.revision)).toThrow(
    "whiteboard-conflict",
  );
  deleteDrawing(dir, "old", saved.revision);
  expect(listDrawings(dir)).toEqual([]);
});
it("rejects traversal, malformed geometry and remote image payloads without writing files", () => {
  expect(() =>
    writeDrawing(dir, "../escape", emptyScene(), "Bad", null),
  ).toThrow("invalid-whiteboard-id");
  expect(() =>
    writeDrawing(
      dir,
      "bad",
      {
        ...emptyScene(),
        elements: [{ id: "x", type: "rectangle", x: Infinity }],
      },
      "Bad",
      null,
    ),
  ).toThrow("invalid-excalidraw-element");
  expect(() =>
    writeDrawing(
      dir,
      "bad",
      {
        ...emptyScene(),
        files: { x: { id: "x", dataURL: "https://example.com/image.png" } },
      },
      "Bad",
      null,
    ),
  ).toThrow("invalid-excalidraw-file");
  expect(listDrawings(dir)).toEqual([]);
});
