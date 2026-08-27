import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { api } from "../api";
import { navigate } from "../App";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n";
import type {
  NoteSummary,
  WhiteboardCard,
  WhiteboardDocument,
  WhiteboardEdge,
} from "../types";

interface WhiteboardProps {
  boardId?: string;
  dataVersion?: number;
}

type CardColor = WhiteboardCard["color"];

type Point = { x: number; y: number };
const LEGACY_STORAGE_KEY = "brain-whiteboard-v1";
const COLORS: CardColor[] = ["blue", "yellow", "green", "pink"];
const CARD_WIDTH = 208;
const CARD_HEIGHT = 152;

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] ?? char,
  );

function renderFormula(source: string): string {
  let formula = escapeHtml(source.trim());
  const greek: Record<string, string> = {
    alpha: "α",
    beta: "β",
    gamma: "γ",
    delta: "δ",
    theta: "θ",
    lambda: "λ",
    mu: "μ",
    pi: "π",
    sigma: "σ",
    phi: "φ",
    omega: "ω",
    Delta: "Δ",
    Sigma: "Σ",
    Omega: "Ω",
  };
  formula = formula.replace(
    /\\frac\{([^{}]+)\}\{([^{}]+)\}/g,
    '<span class="math-frac"><span>$1</span><span>$2</span></span>',
  );
  formula = formula.replace(
    /\\([A-Za-z]+)/g,
    (_, name: string) =>
      greek[name] ??
      { sum: "∑", prod: "∏", infty: "∞", bar: "¯" }[name] ??
      name,
  );
  formula = formula
    .replace(/\^\{([^{}]+)\}/g, "<sup>$1</sup>")
    .replace(/\^([A-Za-z0-9]+)/g, "<sup>$1</sup>");
  formula = formula
    .replace(/_\{([^{}]+)\}/g, "<sub>$1</sub>")
    .replace(/_([A-Za-z0-9]+)/g, "<sub>$1</sub>");
  return formula;
}

function renderCardMarkdown(source: string): string {
  const formulas: string[] = [];
  const withPlaceholders = source.replace(
    /\$\$([\s\S]+?)\$\$|\$([^$\n]+)\$/g,
    (_match, block: string | undefined, inline: string | undefined) => {
      const index =
        formulas.push(
          block
            ? `<div class="math-block">${renderFormula(block)}</div>`
            : `<span class="math-inline">${renderFormula(inline ?? "")}</span>`,
        ) - 1;
      return `@@MATH_${index}@@`;
    },
  );
  let html = marked.parse(withPlaceholders) as string;
  return html.replace(
    /@@MATH_(\d+)@@/g,
    (_match, index: string) => formulas[Number(index)] ?? "",
  );
}

const seedCards = (notes: NoteSummary[], limit = 7): WhiteboardCard[] =>
  notes.slice(0, limit).map((note, index) => ({
    id: `note-${note.id}`,
    title: note.title,
    body: note.summary || note.id,
    color: COLORS[index % COLORS.length]!,
    x: 80 + (index % 3) * 250,
    y: 80 + Math.floor(index / 3) * 205,
    sourceId: note.id,
  }));

function readLegacyCards(): WhiteboardCard[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WhiteboardCard[]) : null;
  } catch {
    return null;
  }
}

function edgePath(from: WhiteboardCard, to: WhiteboardCard): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  if (horizontal) {
    const forward = dx >= 0;
    const sx = from.x + (forward ? CARD_WIDTH : 0);
    const tx = to.x + (forward ? 0 : CARD_WIDTH);
    const sy = from.y + CARD_HEIGHT / 2;
    const ty = to.y + CARD_HEIGHT / 2;
    const bend = Math.max(48, Math.abs(tx - sx) * 0.42);
    return `M ${sx} ${sy} C ${sx + (forward ? bend : -bend)} ${sy}, ${tx - (forward ? bend : -bend)} ${ty}, ${tx} ${ty}`;
  }
  const forward = dy >= 0;
  const sx = from.x + CARD_WIDTH / 2;
  const tx = to.x + CARD_WIDTH / 2;
  const sy = from.y + (forward ? CARD_HEIGHT : 0);
  const ty = to.y + (forward ? 0 : CARD_HEIGHT);
  const bend = Math.max(48, Math.abs(ty - sy) * 0.42);
  return `M ${sx} ${sy} C ${sx} ${sy + (forward ? bend : -bend)}, ${tx} ${ty - (forward ? bend : -bend)}, ${tx} ${ty}`;
}

export function Whiteboard({
  boardId = "research-map",
  dataVersion = 0,
}: WhiteboardProps) {
  const { t } = useI18n();
  const toast = useToast();
  const [cards, setCards] = useState<WhiteboardCard[]>([]);
  const [edges, setEdges] = useState<WhiteboardEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 24, y: 24 });
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState<
    { id: string; title: string; updatedAt: string }[]
  >([]);
  const [boardTitle, setBoardTitle] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importQuery, setImportQuery] = useState("");
  const [importResults, setImportResults] = useState<NoteSummary[]>([]);
  const [importSearching, setImportSearching] = useState(false);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [renameBoardOpen, setRenameBoardOpen] = useState(false);
  const [renameBoardName, setRenameBoardName] = useState("");
  const [deleteBoardOpen, setDeleteBoardOpen] = useState(false);
  const [drag, setDrag] = useState<{
    kind: "card" | "canvas";
    id?: string;
    start: Point;
    origin: Point;
    origins?: Record<string, Point>;
    mode?: "pan" | "marquee";
    additive?: boolean;
  } | null>(null);
  const [marquee, setMarquee] = useState<{
    start: Point;
    current: Point;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const canPersist = useRef(false);
  const migratingLegacy = useRef(false);
  const history = useRef<
    {
      cards: WhiteboardCard[];
      edges: WhiteboardEdge[];
      pan: Point;
      zoom: number;
    }[]
  >([]);
  const future = useRef<typeof history.current>([]);
  const copiedCards = useRef<WhiteboardCard[]>([]);
  const lastExternalVersion = useRef(dataVersion);
  const localSaveAt = useRef(0);
  const skipNextSave = useRef(false);
  const viewportRef = useRef({ pan: { x: 24, y: 24 }, zoom: 1 });
  const wheelFrame = useRef<number | null>(null);
  const wheelPending = useRef({
    dx: 0,
    dy: 0,
    zoomDelta: 0,
    x: 0,
    y: 0,
    zooming: false,
  });

  useEffect(() => {
    viewportRef.current = { pan, zoom };
  }, [pan, zoom]);

  const snapshot = useCallback(
    () => ({ cards, edges, pan, zoom }),
    [cards, edges, pan, zoom],
  );
  const pushHistory = useCallback(() => {
    history.current = [...history.current.slice(-49), snapshot()];
    future.current = [];
  }, [snapshot]);

  const loadBoard = useCallback(
    async (external = false) => {
      const board = await api.whiteboard(boardId);
      if (external) skipNextSave.current = true;
      setCards(board.cards);
      setBoardTitle(board.title || boardId);
      setEdges(board.edges ?? []);
      setPan({ x: board.viewport.x, y: board.viewport.y });
      setZoom(board.viewport.zoom);
      setSelectedId(null);
      setSelectedIds(new Set());
      setEditingId(null);
      if (board.persisted === false && boardId === "research-map") {
        const legacyCards = readLegacyCards();
        if (legacyCards?.length) {
          migratingLegacy.current = true;
          setCards(legacyCards);
        } else {
          try {
            const notes = await api.notes("");
            setCards(seedCards(notes));
          } catch (error) {
            toast((error as Error).message);
          }
        }
      }
      canPersist.current = true;
      loaded.current = true;
      setLoading(false);
      if (external) toast(t("whiteboard.externalUpdate"));
    },
    [boardId, t, toast],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    canPersist.current = false;
    loaded.current = false;
    loadBoard().catch((error) => {
      if (!cancelled) {
        loaded.current = true;
        setLoading(false);
        toast((error as Error).message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [boardId, loadBoard, toast]);

  useEffect(() => {
    if (dataVersion === lastExternalVersion.current) return;
    lastExternalVersion.current = dataVersion;
    // The file watcher also observes this tab's own atomic save. Do not reload
    // during that short window, otherwise controlled inspector inputs lose focus.
    if (Date.now() - localSaveAt.current < 1500) return;
    if (loaded.current)
      void loadBoard(true).catch((error) => toast((error as Error).message));
  }, [dataVersion, loadBoard, toast]);

  useEffect(() => {
    api
      .whiteboards()
      .then(setBoards)
      .catch(() => undefined);
  }, [dataVersion]);

  useEffect(() => {
    if (!loaded.current || !canPersist.current) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const board: WhiteboardDocument = {
        version: 2,
        id: boardId,
        title: boardTitle || t("whiteboard.mainBoard"),
        cards,
        edges,
        viewport: { x: pan.x, y: pan.y, zoom },
        updatedAt: new Date().toISOString(),
      };
      localSaveAt.current = Date.now();
      api.saveWhiteboard(boardId, board).then(
        () => {
          if (migratingLegacy.current) {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            migratingLegacy.current = false;
          }
        },
        (error) => toast((error as Error).message),
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [boardId, boardTitle, cards, edges, pan.x, pan.y, toast, t, zoom]);

  const selected = cards.find((card) => card.id === selectedId) ?? null;
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const visibleCards = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? cards.filter((card) =>
          `${card.title} ${card.body}`.toLowerCase().includes(term),
        )
      : cards;
  }, [cards, query]);

  const point = (event: React.PointerEvent): Point => ({
    x: event.clientX,
    y: event.clientY,
  });

  const onPointerDown = (event: React.PointerEvent, card?: WhiteboardCard) => {
    if (card) event.stopPropagation();
    if (card && event.altKey && !connectingFrom) {
      pushHistory();
      const clone = {
        ...card,
        id: `${card.id}-copy-${Date.now()}`,
        x: card.x + 32,
        y: card.y + 32,
      };
      setCards((current) => [...current, clone]);
      setSelectedId(clone.id);
      setSelectedIds(new Set([clone.id]));
      return;
    }
    if (card && connectingFrom) {
      if (card.id !== connectingFrom) {
        pushHistory();
        setEdges((current) =>
          current.some(
            (edge) => edge.from === connectingFrom && edge.to === card.id,
          )
            ? current
            : [
                ...current,
                {
                  id: `${connectingFrom}->${card.id}`,
                  from: connectingFrom,
                  to: card.id,
                },
              ],
        );
        setSelectedId(card.id);
      }
      setConnectingFrom(null);
      return;
    }
    const p = point(event);
    if (!card && event.shiftKey === false) setMarquee(null);
    if (card && event.shiftKey) {
      setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(card.id)) next.delete(card.id);
        else next.add(card.id);
        setSelectedId(next.size ? [...next][next.size - 1]! : null);
        return next;
      });
      return;
    }
    if (card) {
      if (!selectedIds.has(card.id)) setSelectedIds(new Set([card.id]));
      pushHistory();
    }
    setDrag({
      kind: card ? "card" : "canvas",
      id: card?.id,
      start: p,
      origin: card ? { x: card.x, y: card.y } : { x: pan.x, y: pan.y },
      origins: card
        ? Object.fromEntries(
            [...selectedIds].map((id) => {
              const item = cards.find((candidate) => candidate.id === id);
              return item
                ? [id, { x: item.x, y: item.y }]
                : [id, { x: card.x, y: card.y }];
            }),
          )
        : undefined,
      mode: card ? undefined : event.shiftKey ? "marquee" : "pan",
      additive: event.shiftKey,
    });
    if (card) {
      setSelectedId(card.id);
      setEditingId(card.id);
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onWheel = (event: React.WheelEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pending = wheelPending.current;
    if (!(event.ctrlKey || event.metaKey)) {
      pending.dx += event.deltaX;
      pending.dy += event.deltaY;
      pending.zooming = false;
    } else {
      event.preventDefault();
      pending.zoomDelta += event.deltaY;
      pending.x = event.clientX - rect.left;
      pending.y = event.clientY - rect.top;
      pending.zooming = true;
    }
    if (wheelFrame.current !== null) return;
    wheelFrame.current = window.requestAnimationFrame(() => {
      wheelFrame.current = null;
      const nextPending = wheelPending.current;
      wheelPending.current = {
        dx: 0,
        dy: 0,
        zoomDelta: 0,
        x: nextPending.x,
        y: nextPending.y,
        zooming: false,
      };
      const viewport = viewportRef.current;
      if (nextPending.zooming) {
        const factor = Math.pow(1.0015, -nextPending.zoomDelta);
        const nextZoom = Math.max(0.6, Math.min(1.6, viewport.zoom * factor));
        const ratio = nextZoom / viewport.zoom;
        const nextPan = {
          x: nextPending.x - (nextPending.x - viewport.pan.x) * ratio,
          y: nextPending.y - (nextPending.y - viewport.pan.y) * ratio,
        };
        viewportRef.current = { pan: nextPan, zoom: nextZoom };
        setPan(nextPan);
        setZoom(nextZoom);
      } else if (nextPending.dx || nextPending.dy) {
        const nextPan = {
          x: viewport.pan.x - nextPending.dx,
          y: viewport.pan.y - nextPending.dy,
        };
        viewportRef.current.pan = nextPan;
        setPan(nextPan);
      }
    });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    const dx = event.clientX - drag.start.x;
    const dy = event.clientY - drag.start.y;
    if (drag.kind === "card" && drag.id) {
      const moving = new Set(
        selectedIds.has(drag.id) ? selectedIds : [drag.id],
      );
      setCards((current) =>
        current.map((card) => {
          if (!moving.has(card.id)) return card;
          const origin =
            drag.origins?.[card.id] ??
            (card.id === drag.id ? drag.origin : { x: card.x, y: card.y });
          return { ...card, x: origin.x + dx / zoom, y: origin.y + dy / zoom };
        }),
      );
    } else {
      if (drag.mode === "marquee" && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        setMarquee({ start: drag.start, current: point(event) });
      }
      if (drag.mode !== "marquee")
        setPan({ x: drag.origin.x + dx, y: drag.origin.y + dy });
    }
  };

  const endDrag = () => {
    if (drag?.kind === "canvas" && marquee) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x1 = Math.min(marquee.start.x, marquee.current.x);
        const x2 = Math.max(marquee.start.x, marquee.current.x);
        const y1 = Math.min(marquee.start.y, marquee.current.y);
        const y2 = Math.max(marquee.start.y, marquee.current.y);
        const hits = cards
          .filter((card) => {
            const sx = rect.left + pan.x + card.x * zoom;
            const sy = rect.top + pan.y + card.y * zoom;
            return (
              sx < x2 &&
              sx + CARD_WIDTH * zoom > x1 &&
              sy < y2 &&
              sy + CARD_HEIGHT * zoom > y1
            );
          })
          .map((card) => card.id);
        setSelectedIds((current) =>
          drag.additive ? new Set([...current, ...hits]) : new Set(hits),
        );
        setSelectedId(hits[hits.length - 1] ?? null);
      }
    }
    setMarquee(null);
    setDrag(null);
  };

  const addCard = useCallback(() => {
    pushHistory();
    const id = `card-${Date.now()}`;
    const card: WhiteboardCard = {
      id,
      title: t("whiteboard.newCard"),
      body: "",
      color: "yellow",
      x: (360 - pan.x) / zoom,
      y: (180 - pan.y) / zoom,
    };
    setCards((current) => [...current, card]);
    setSelectedId(id);
  }, [pan.x, pan.y, pushHistory, t, zoom]);

  const searchImportNotes = async (query: string) => {
    setImportQuery(query);
    if (!query.trim()) {
      setImportResults([]);
      return;
    }
    setImportSearching(true);
    try {
      setImportResults(await api.notes(query.trim()));
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setImportSearching(false);
    }
  };

  const importNote = (note: NoteSummary) => {
    if (cards.some((card) => card.sourceId === note.id)) {
      toast(t("whiteboard.noteAlreadyImported"));
      return;
    }
    pushHistory();
    const index = cards.length;
    setCards((current) => [
      ...current,
      {
        ...seedCards([note], 1)[0]!,
        x: 100 + (index % 4) * 235,
        y: 90 + Math.floor(index / 4) * 205,
      },
    ]);
    setImportOpen(false);
    setImportQuery("");
    setImportResults([]);
  };

  const updateSelected = (patch: Partial<WhiteboardCard>) => {
    if (!selectedId) return;
    pushHistory();
    setCards((current) =>
      current.map((card) =>
        card.id === selectedId ? { ...card, ...patch } : card,
      ),
    );
  };

  const selectedEdges = selectedId
    ? edges.filter((edge) => edge.from === selectedId || edge.to === selectedId)
    : [];

  const removeEdge = (edgeId: string) => {
    pushHistory();
    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
  };

  const visibleIds = new Set(visibleCards.map((card) => card.id));

  const deleteSelected = () => {
    if (!selectedIds.size && !selectedId) return;
    pushHistory();
    const ids = new Set(selectedIds.size ? selectedIds : [selectedId!]);
    setCards((current) => current.filter((card) => !ids.has(card.id)));
    setEdges((current) =>
      current.filter((edge) => !ids.has(edge.from) && !ids.has(edge.to)),
    );
    setSelectedId(null);
    setSelectedIds(new Set());
    setConnectingFrom(null);
  };

  const resetBoard = () => {
    pushHistory();
    setSelectedId(null);
    setSelectedIds(new Set());
    setCards([]);
    setEdges([]);
    setConnectingFrom(null);
  };

  const undo = useCallback(() => {
    const previous = history.current.pop();
    if (!previous) return;
    future.current.push(snapshot());
    setCards(previous.cards);
    setEdges(previous.edges);
    setPan(previous.pan);
    setZoom(previous.zoom);
    setSelectedId(null);
    setSelectedIds(new Set());
  }, [snapshot]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    history.current.push(snapshot());
    setCards(next.cards);
    setEdges(next.edges);
    setPan(next.pan);
    setZoom(next.zoom);
    setSelectedId(null);
    setSelectedIds(new Set());
  }, [snapshot]);

  const fitAll = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !cards.length) return;
    const minX = Math.min(...cards.map((card) => card.x));
    const minY = Math.min(...cards.map((card) => card.y));
    const maxX = Math.max(...cards.map((card) => card.x + CARD_WIDTH));
    const maxY = Math.max(...cards.map((card) => card.y + CARD_HEIGHT));
    const nextZoom = Math.max(
      0.6,
      Math.min(
        1.6,
        Math.min(
          (rect.width - 80) / (maxX - minX),
          (rect.height - 120) / (maxY - minY),
        ),
      ),
    );
    pushHistory();
    setZoom(+nextZoom.toFixed(2));
    setPan({
      x: (rect.width - (maxX - minX) * nextZoom) / 2 - minX * nextZoom,
      y: (rect.height - (maxY - minY) * nextZoom) / 2 - minY * nextZoom,
    });
  }, [cards, pushHistory]);

  const createBoard = async () => {
    const title = newBoardName;
    if (!title?.trim()) return;
    const id =
      title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48) || `board-${Date.now()}`;
    try {
      await api.whiteboardAction({ action: "create", id, title: title.trim() });
      setBoards(await api.whiteboards());
      setNewBoardOpen(false);
      setNewBoardName("");
      navigate("whiteboard", id);
    } catch (error) {
      toast((error as Error).message);
    }
  };

  const renameBoard = async () => {
    const title = renameBoardName;
    if (!title?.trim()) return;
    try {
      await api.whiteboardAction({
        action: "rename",
        id: boardId,
        title: title.trim(),
      });
      setBoardTitle(title.trim());
      setBoards(await api.whiteboards());
      setRenameBoardOpen(false);
      setRenameBoardName("");
    } catch (error) {
      toast((error as Error).message);
    }
  };

  const deleteBoard = async () => {
    if (boardId === "research-map") return;
    try {
      await api.whiteboardAction({ action: "delete", id: boardId });
      setDeleteBoardOpen(false);
      const next = (await api.whiteboards())[0]?.id ?? "research-map";
      navigate("whiteboard", next);
    } catch (error) {
      toast((error as Error).message);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
        return;
      }
      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelectedIds(new Set(cards.map((card) => card.id)));
        setSelectedId(cards[cards.length - 1]?.id ?? null);
        return;
      }
      if (mod && event.key.toLowerCase() === "c") {
        copiedCards.current = cards.filter((card) => selectedIds.has(card.id));
        return;
      }
      if (
        mod &&
        event.key.toLowerCase() === "v" &&
        copiedCards.current.length
      ) {
        event.preventDefault();
        pushHistory();
        const pasted = copiedCards.current.map((card, index) => ({
          ...card,
          id: `${card.id}-copy-${Date.now()}-${index}`,
          x: card.x + 32,
          y: card.y + 32,
        }));
        setCards((current) => [...current, ...pasted]);
        setSelectedIds(new Set(pasted.map((card) => card.id)));
        setSelectedId(pasted[pasted.length - 1]?.id ?? null);
        return;
      }
      if (mod && event.key === "0") {
        event.preventDefault();
        fitAll();
        return;
      }
      if (mod && event.key === "1") {
        event.preventDefault();
        setZoom(1);
        return;
      }
      if (event.key === "Escape") {
        setConnectingFrom(null);
        setMarquee(null);
        setDrag(null);
        setEditingId(null);
        setSelectedId(null);
        setSelectedIds(new Set());
        return;
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        (selectedIds.size || selectedId)
      ) {
        event.preventDefault();
        deleteSelected();
        return;
      }
      if (
        (event.key === "ArrowLeft" ||
          event.key === "ArrowRight" ||
          event.key === "ArrowUp" ||
          event.key === "ArrowDown") &&
        selectedIds.size
      ) {
        event.preventDefault();
        pushHistory();
        const step = event.shiftKey ? 10 : 1;
        const dx =
          event.key === "ArrowLeft"
            ? -step
            : event.key === "ArrowRight"
              ? step
              : 0;
        const dy =
          event.key === "ArrowUp"
            ? -step
            : event.key === "ArrowDown"
              ? step
              : 0;
        setCards((current) =>
          current.map((card) =>
            selectedIds.has(card.id)
              ? { ...card, x: card.x + dx, y: card.y + dy }
              : card,
          ),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    cards,
    deleteSelected,
    fitAll,
    pushHistory,
    redo,
    selectedId,
    selectedIds,
    undo,
  ]);

  return (
    <div className="whiteboard-page">
      <div className="whiteboard-layout">
        <section className="whiteboard-stage">
          <div className="whiteboard-toolbar">
            <div className="board-title">
              <span className="board-title-dot" />
              <select
                className="board-select"
                value={boardId}
                onChange={(event) => navigate("whiteboard", event.target.value)}
                aria-label={t("whiteboard.boards")}
              >
                {(boards.length
                  ? boards
                  : [
                      {
                        id: boardId,
                        title: t("whiteboard.mainBoard"),
                        updatedAt: "",
                      },
                    ]
                ).map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.title}
                  </option>
                ))}
              </select>
              <span className="board-edge-count">
                {edges.length} {t("whiteboard.edgeCount")}
              </span>
            </div>
            <input
              className="board-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("whiteboard.search")}
            />
            <button
              className="btn toolbar-action"
              onClick={() => setImportOpen(true)}
            >
              ↓ {t("whiteboard.import")}
            </button>
            <button className="btn primary toolbar-action" onClick={addCard}>
              ＋ {t("whiteboard.addCard")}
            </button>
            <button
              className="btn toolbar-action"
              onClick={() => setNewBoardOpen(true)}
            >
              {t("whiteboard.newBoard")}
            </button>
            <button
              className="toolbar-btn"
              onClick={() => {
                setRenameBoardName(
                  boards.find((board) => board.id === boardId)?.title ??
                    boardId,
                );
                setRenameBoardOpen(true);
              }}
              aria-label={t("whiteboard.renameBoard")}
            >
              ✎
            </button>
            <button
              className="toolbar-btn"
              onClick={() => setDeleteBoardOpen(true)}
              aria-label={t("whiteboard.deleteBoard")}
              disabled={boardId === "research-map"}
            >
              ⌫
            </button>
            <button
              className="toolbar-btn"
              onClick={undo}
              aria-label={t("whiteboard.undo")}
            >
              ↶
            </button>
            <button
              className="toolbar-btn"
              onClick={redo}
              aria-label={t("whiteboard.redo")}
            >
              ↷
            </button>
            <button
              className="toolbar-btn"
              onClick={fitAll}
              aria-label={t("whiteboard.fit")}
            >
              ⛶
            </button>
            <button
              className="toolbar-btn"
              onClick={() => setPan({ x: 24, y: 24 })}
              aria-label={t("whiteboard.center")}
            >
              ⌖
            </button>
            <button
              className="toolbar-btn"
              onClick={resetBoard}
              aria-label={t("whiteboard.reset")}
            >
              ↺
            </button>
            <div className="zoom-controls">
              <button
                className="icon-btn"
                onClick={() =>
                  setZoom((value) => Math.max(0.6, +(value - 0.1).toFixed(1)))
                }
                aria-label={t("whiteboard.zoomOut")}
              >
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                className="icon-btn"
                onClick={() =>
                  setZoom((value) => Math.min(1.6, +(value + 0.1).toFixed(1)))
                }
                aria-label={t("whiteboard.zoomIn")}
              >
                ＋
              </button>
            </div>
            <button
              className="toolbar-btn inspector-toolbar-toggle"
              onClick={() => setInspectorCollapsed((value) => !value)}
              aria-label={
                inspectorCollapsed
                  ? t("whiteboard.expand")
                  : t("whiteboard.collapse")
              }
              title={
                inspectorCollapsed
                  ? t("whiteboard.expand")
                  : t("whiteboard.collapse")
              }
            >
              {inspectorCollapsed ? "‹" : "›"}
            </button>
          </div>
          {importOpen && (
            <div
              className="whiteboard-import-panel"
              role="dialog"
              aria-label={t("whiteboard.import")}
            >
              <div className="import-panel-head">
                <strong>{t("whiteboard.import")}</strong>
                <button
                  className="icon-btn"
                  onClick={() => setImportOpen(false)}
                  aria-label={t("whiteboard.close")}
                >
                  ×
                </button>
              </div>
              <input
                autoFocus
                value={importQuery}
                onChange={(event) => void searchImportNotes(event.target.value)}
                placeholder={t("whiteboard.searchNotesToImport")}
              />
              <div className="import-results">
                {importSearching && (
                  <div className="import-empty">{t("common.loading")}</div>
                )}
                {!importSearching &&
                  importQuery.trim() &&
                  importResults.length === 0 && (
                    <div className="import-empty">
                      {t("whiteboard.noNotesFound")}
                    </div>
                  )}
                {importResults.map((note) => (
                  <button
                    className="import-result"
                    key={note.id}
                    onClick={() => importNote(note)}
                  >
                    <strong>{note.title}</strong>
                    <span>{note.id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {newBoardOpen && (
            <Modal
              title={t("whiteboard.newBoardTitle")}
              onClose={() => setNewBoardOpen(false)}
            >
              <div className="field">
                <label>{t("whiteboard.newBoard")}</label>
                <input
                  autoFocus
                  value={newBoardName}
                  onChange={(event) => setNewBoardName(event.target.value)}
                  placeholder={t("whiteboard.boardNamePlaceholder")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void createBoard();
                  }}
                />
              </div>
              <div className="actions">
                <button className="btn" onClick={() => setNewBoardOpen(false)}>
                  {t("common.cancel")}
                </button>
                <button
                  className="btn primary"
                  disabled={!newBoardName.trim()}
                  onClick={() => void createBoard()}
                >
                  {t("whiteboard.createBoard")}
                </button>
              </div>
            </Modal>
          )}
          {renameBoardOpen && (
            <Modal
              title={t("whiteboard.renameBoardTitle")}
              onClose={() => setRenameBoardOpen(false)}
            >
              <div className="field">
                <label>{t("whiteboard.renameBoard")}</label>
                <input
                  autoFocus
                  value={renameBoardName}
                  onChange={(event) => setRenameBoardName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void renameBoard();
                  }}
                />
              </div>
              <div className="actions">
                <button
                  className="btn"
                  onClick={() => setRenameBoardOpen(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  className="btn primary"
                  disabled={!renameBoardName.trim()}
                  onClick={() => void renameBoard()}
                >
                  {t("whiteboard.saveBoardName")}
                </button>
              </div>
            </Modal>
          )}
          {deleteBoardOpen && (
            <Modal
              title={t("whiteboard.deleteBoard")}
              onClose={() => setDeleteBoardOpen(false)}
            >
              <p>{t("whiteboard.confirmDeleteBoard")}</p>
              <div className="actions">
                <button
                  className="btn"
                  onClick={() => setDeleteBoardOpen(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  className="btn danger"
                  onClick={() => void deleteBoard()}
                >
                  {t("whiteboard.deleteBoard")}
                </button>
              </div>
            </Modal>
          )}
          <div
            className="whiteboard-canvas"
            ref={canvasRef}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                setEditingId(null);
                setSelectedId(null);
                setSelectedIds(new Set());
                setConnectingFrom(null);
                onPointerDown(event);
              }
            }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onWheel={onWheel}
          >
            <div
              className="canvas-grid"
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              }}
            >
              <svg
                className="board-links"
                width="3000"
                height="2000"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="board-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 Z" />
                  </marker>
                </defs>
                {edges
                  .filter(
                    (edge) =>
                      visibleIds.has(edge.from) && visibleIds.has(edge.to),
                  )
                  .map((edge) => {
                    const from = cardById.get(edge.from);
                    const to = cardById.get(edge.to);
                    if (!from || !to) return null;
                    const focused =
                      selectedId === edge.from || selectedId === edge.to;
                    return (
                      <path
                        className={`board-link${selectedId ? (focused ? " focused" : " dimmed") : ""}`}
                        key={edge.id}
                        d={edgePath(from, to)}
                        markerEnd="url(#board-arrow)"
                      />
                    );
                  })}
              </svg>
              {visibleCards.map((card) => (
                <article
                  className={`board-card ${card.color}${selectedIds.has(card.id) ? " selected" : ""}${editingId === card.id ? " editing" : ""}`}
                  key={card.id}
                  style={{ left: card.x, top: card.y }}
                  onPointerDown={(event) => onPointerDown(event, card)}
                  onWheel={(event) => event.stopPropagation()}
                >
                  <div className="card-pin" />
                  {editingId === card.id ? (
                    <>
                      <input
                        className="board-card-title-input"
                        value={card.title}
                        placeholder={t("whiteboard.untitled")}
                        autoFocus
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateSelected({ title: event.target.value })
                        }
                      />
                      <textarea
                        className="board-card-body-input"
                        value={card.body}
                        placeholder={t("whiteboard.emptyCard")}
                        rows={5}
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateSelected({ body: event.target.value })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <h3>{card.title || t("whiteboard.untitled")}</h3>
                      {card.body ? (
                        <div
                          className="board-card-rendered md"
                          dangerouslySetInnerHTML={{
                            __html: renderCardMarkdown(card.body),
                          }}
                        />
                      ) : (
                        <p>{t("whiteboard.emptyCard")}</p>
                      )}
                    </>
                  )}
                  {card.sourceId && (
                    <button
                      className="card-source"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate("notes", card.sourceId);
                      }}
                    >
                      ↗ {card.sourceId}
                    </button>
                  )}
                </article>
              ))}
              {!loading && visibleCards.length === 0 && (
                <div className="board-empty">{t("whiteboard.emptyBoard")}</div>
              )}
              {loading && (
                <div className="board-empty">{t("common.loading")}</div>
              )}
            </div>
            {marquee && (
              <div
                className="board-marquee"
                style={{
                  left:
                    Math.min(marquee.start.x, marquee.current.x) -
                    (canvasRef.current?.getBoundingClientRect().left ?? 0),
                  top:
                    Math.min(marquee.start.y, marquee.current.y) -
                    (canvasRef.current?.getBoundingClientRect().top ?? 0),
                  width: Math.abs(marquee.current.x - marquee.start.x),
                  height: Math.abs(marquee.current.y - marquee.start.y),
                }}
              />
            )}
            <div className="canvas-hint">{t("whiteboard.canvasHint")}</div>
          </div>
        </section>

        <aside
          className={`whiteboard-inspector${selected ? " open" : ""}${inspectorCollapsed ? " collapsed" : ""}`}
        >
          <div className="inspector-content">
            {selected ? (
              <>
                <div className="inspector-head">
                  <span>{t("whiteboard.editCard")}</span>
                  <button
                    className="icon-btn"
                    onClick={() => setSelectedId(null)}
                    aria-label={t("whiteboard.close")}
                  >
                    ×
                  </button>
                </div>
                <label className="inspector-label">
                  {t("whiteboard.title")}
                </label>
                <input
                  value={selected.title}
                  onChange={(event) =>
                    updateSelected({ title: event.target.value })
                  }
                />
                <label className="inspector-label">
                  {t("whiteboard.content")}
                </label>
                <textarea
                  value={selected.body}
                  onChange={(event) =>
                    updateSelected({ body: event.target.value })
                  }
                  rows={8}
                />
                <label className="inspector-label">
                  {t("whiteboard.color")}
                </label>
                <div className="color-picker">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      className={`color-swatch ${color}${selected.color === color ? " active" : ""}`}
                      onClick={() => updateSelected({ color })}
                      aria-label={color}
                    />
                  ))}
                </div>
                {selected.sourceId && (
                  <button
                    className="btn inspector-source"
                    onClick={() => navigate("notes", selected.sourceId)}
                  >
                    {t("whiteboard.openNote")}
                  </button>
                )}
                <button
                  className={`btn inspector-source${connectingFrom === selected.id ? " primary" : ""}`}
                  onClick={() =>
                    setConnectingFrom(
                      connectingFrom === selected.id ? null : selected.id,
                    )
                  }
                >
                  {connectingFrom === selected.id
                    ? t("whiteboard.cancelConnect")
                    : t("whiteboard.connect")}
                </button>
                {connectingFrom === selected.id && (
                  <p className="connect-hint">{t("whiteboard.connecting")}</p>
                )}
                <div className="connection-section">
                  <div className="inspector-label">
                    {t("whiteboard.connections")}
                  </div>
                  {selectedEdges.length === 0 ? (
                    <div className="connection-empty">
                      {t("whiteboard.noConnections")}
                    </div>
                  ) : (
                    selectedEdges.map((edge) => {
                      const outgoing = edge.from === selected.id;
                      const other = cardById.get(
                        outgoing ? edge.to : edge.from,
                      );
                      return (
                        <div className="connection-row" key={edge.id}>
                          <span className="connection-direction">
                            {outgoing ? "→" : "←"}
                          </span>
                          <span className="connection-name">
                            {other?.title || t("whiteboard.untitled")}
                          </span>
                          <button
                            className="connection-remove"
                            onClick={() => removeEdge(edge.id)}
                            aria-label={t("whiteboard.removeConnection")}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
                <button
                  className="btn danger inspector-delete"
                  onClick={deleteSelected}
                >
                  {t("whiteboard.delete")}
                </button>
              </>
            ) : (
              <div className="inspector-empty">
                <div className="inspector-icon">✦</div>
                <strong>{t("whiteboard.selectCard")}</strong>
                <p>{t("whiteboard.selectHint")}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
