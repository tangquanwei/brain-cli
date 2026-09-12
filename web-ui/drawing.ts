import {
  convertToExcalidrawElements,
  restore,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { DrawingDocument, DrawingScene } from "../src/web/drawingData";
import type { NoteSummary } from "./types";

export function noteId(element: ExcalidrawElement): string | null {
  const id = element.customData?.brain?.noteId;
  return typeof id === "string" ? id : null;
}

export function noteElements(note: NoteSummary, x: number, y: number) {
  return convertToExcalidrawElements([
    {
      type: "rectangle",
      x,
      y,
      width: 280,
      height: 120,
      backgroundColor: "#dbe4ff",
      fillStyle: "solid",
      roughness: 0,
      roundness: { type: 3 },
      link: `#/notes/${encodeURIComponent(note.id)}`,
      customData: { brain: { noteId: note.id } },
      label: {
        text: `↗ ${note.title}\n${note.id}`,
        fontSize: 16,
        fontFamily: 2,
      },
    },
  ]);
}

export function drawingInitialData(
  board: DrawingDocument,
): ExcalidrawInitialDataState {
  if (board.scene)
    return restore(
      board.scene as unknown as ExcalidrawInitialDataState,
      null,
      null,
      { repairBindings: true },
    );
  const legacy = board.legacy!;
  const colors = {
    blue: "#dbe4ff",
    yellow: "#fff3bf",
    green: "#d3f9d8",
    pink: "#ffdeeb",
  };
  const skeletons: ExcalidrawElementSkeleton[] = legacy.cards.map((card) => {
    const text = [card.title, card.body].filter(Boolean).join("\n\n") || " ";
    const reference = card.source?.noteId || card.sourceId || card.source?.path;
    const common = {
      id: card.id,
      x: card.x,
      y: card.y,
      customData: {
        brain: {
          ...(reference ? { noteId: reference } : {}),
          legacyCard: card,
        },
      },
      ...(reference
        ? { link: `#/notes/${encodeURIComponent(reference)}` }
        : {}),
    };
    return card.kind === "text"
      ? { ...common, type: "text", text, fontSize: 20, fontFamily: 2 }
      : {
          ...common,
          type: "rectangle",
          width: 240,
          height: 152,
          roughness: 0,
          backgroundColor: colors[card.color],
          fillStyle: "solid",
          label: { text, fontSize: 16, fontFamily: 2 },
        };
  });
  for (const edge of legacy.edges) {
    const from = legacy.cards.find((card) => card.id === edge.from);
    const to = legacy.cards.find((card) => card.id === edge.to);
    if (!from || !to) continue;
    skeletons.push({
      type: "arrow",
      id: edge.id,
      x: from.x + 240,
      y: from.y + 76,
      width: to.x - from.x - 240,
      height: to.y - from.y,
      start: { id: from.id },
      end: { id: to.id },
      ...(edge.label ? { label: { text: edge.label, fontFamily: 2 } } : {}),
      customData: { brain: { legacyEdge: edge } },
    });
  }
  for (const frame of legacy.frames ?? []) {
    skeletons.push({
      type: "frame",
      id: frame.id,
      name: frame.title,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      children: [],
    });
  }
  return {
    elements: convertToExcalidrawElements(skeletons, { regenerateIds: false }),
    appState: {
      scrollX: legacy.viewport.x / legacy.viewport.zoom,
      scrollY: legacy.viewport.y / legacy.viewport.zoom,
      zoom: { value: legacy.viewport.zoom as AppState["zoom"]["value"] },
    },
    files: {},
  };
}

export function sceneJSON(
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
): string {
  const scene: DrawingScene = JSON.parse(
    serializeAsJSON(elements, appState, files, "local"),
  );
  // Excalidraw's export omits viewport state; keep it for local sessions.
  scene.appState = {
    ...scene.appState,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom,
  };
  return JSON.stringify(scene);
}
