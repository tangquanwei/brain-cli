import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { navigate } from "../App";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n";
import type {
  NoteSummary,
  WhiteboardCard,
  WhiteboardDocument,
  WhiteboardEdge,
} from "../types";

type CardColor = WhiteboardCard["color"];

type Point = { x: number; y: number };
const LEGACY_STORAGE_KEY = "brain-whiteboard-v1";
const COLORS: CardColor[] = ["blue", "yellow", "green", "pink"];
const CARD_WIDTH = 208;
const CARD_HEIGHT = 152;

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

export function Whiteboard() {
  const { t } = useI18n();
  const toast = useToast();
  const [cards, setCards] = useState<WhiteboardCard[]>([]);
  const [edges, setEdges] = useState<WhiteboardEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 24, y: 24 });
  const [loading, setLoading] = useState(true);
  const [drag, setDrag] = useState<{
    kind: "card" | "canvas";
    id?: string;
    start: Point;
    origin: Point;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const canPersist = useRef(false);
  const migratingLegacy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api.whiteboard().then(
      async (board) => {
        if (cancelled) return;
        setCards(board.cards);
        setEdges(board.edges ?? []);
        setPan({ x: board.viewport.x, y: board.viewport.y });
        setZoom(board.viewport.zoom);
        if (board.persisted === false) {
          const legacyCards = readLegacyCards();
          if (legacyCards?.length) {
            migratingLegacy.current = true;
            setCards(legacyCards);
          } else {
            try {
              const notes = await api.notes("");
              if (!cancelled) setCards(seedCards(notes));
            } catch (error) {
              if (!cancelled) toast((error as Error).message);
            }
          }
        }
        if (!cancelled) {
          canPersist.current = true;
          loaded.current = true;
          setLoading(false);
        }
      },
      (error) => {
        if (cancelled) return;
        loaded.current = true;
        setLoading(false);
        toast((error as Error).message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (!loaded.current || !canPersist.current) return;
    const timer = window.setTimeout(() => {
      const board: WhiteboardDocument = {
        version: 1,
        id: "research-map",
        title: t("whiteboard.mainBoard"),
        cards,
        edges,
        viewport: { x: pan.x, y: pan.y, zoom },
        updatedAt: new Date().toISOString(),
      };
      api.saveWhiteboard("research-map", board).then(
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
  }, [cards, edges, pan.x, pan.y, toast, t, zoom]);

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
    if (card && connectingFrom) {
      if (card.id !== connectingFrom) {
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
    setDrag({
      kind: card ? "card" : "canvas",
      id: card?.id,
      start: p,
      origin: card ? { x: card.x, y: card.y } : { x: pan.x, y: pan.y },
    });
    if (card) setSelectedId(card.id);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    const dx = event.clientX - drag.start.x;
    const dy = event.clientY - drag.start.y;
    if (drag.kind === "card" && drag.id) {
      setCards((current) =>
        current.map((card) =>
          card.id === drag.id
            ? {
                ...card,
                x: drag.origin.x + dx / zoom,
                y: drag.origin.y + dy / zoom,
              }
            : card,
        ),
      );
    } else {
      setPan({ x: drag.origin.x + dx, y: drag.origin.y + dy });
    }
  };

  const endDrag = () => setDrag(null);

  const addCard = useCallback(() => {
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
  }, [pan.x, pan.y, t, zoom]);

  const importNotes = async () => {
    setLoading(true);
    try {
      const notes = await api.notes("");
      setCards((current) => {
        const existing = new Set(current.map((card) => card.sourceId));
        const additions = seedCards(notes, 100).filter(
          (card) => !existing.has(card.sourceId),
        );
        return [
          ...current,
          ...additions.map((card, index) => ({
            ...card,
            x: 100 + (index % 4) * 235,
            y: 90 + Math.floor(index / 4) * 205,
          })),
        ];
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSelected = (patch: Partial<WhiteboardCard>) => {
    if (!selectedId) return;
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
    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
  };

  const visibleIds = new Set(visibleCards.map((card) => card.id));

  const deleteSelected = () => {
    if (!selectedId) return;
    setCards((current) => current.filter((card) => card.id !== selectedId));
    setEdges((current) =>
      current.filter(
        (edge) => edge.from !== selectedId && edge.to !== selectedId,
      ),
    );
    setSelectedId(null);
    setConnectingFrom(null);
  };

  const resetBoard = () => {
    setSelectedId(null);
    setCards([]);
    setEdges([]);
    setConnectingFrom(null);
  };

  return (
    <div className="whiteboard-page">
      <header className="whiteboard-head">
        <div>
          <div className="whiteboard-kicker">{t("whiteboard.kicker")}</div>
          <h1 className="page-title">{t("nav.whiteboard")}</h1>
        </div>
        <div className="whiteboard-head-actions">
          <button className="btn" onClick={importNotes}>
            ↓ {t("whiteboard.import")}
          </button>
          <button className="btn primary" onClick={addCard}>
            ＋ {t("whiteboard.addCard")}
          </button>
        </div>
      </header>

      <div className="whiteboard-layout">
        <aside className="whiteboard-rail">
          <div className="rail-label">{t("whiteboard.boards")}</div>
          <button className="board-item active">
            <span className="board-dot" />
            {t("whiteboard.mainBoard")}
            <span className="board-count">{cards.length}</span>
          </button>
          <div className="rail-divider" />
          <div className="rail-label">{t("whiteboard.tools")}</div>
          <button className="rail-tool" onClick={addCard}>
            ＋ <span>{t("whiteboard.newCard")}</span>
          </button>
          <button
            className="rail-tool"
            onClick={() => setPan({ x: 24, y: 24 })}
          >
            ⌖ <span>{t("whiteboard.center")}</span>
          </button>
          <button className="rail-tool" onClick={resetBoard}>
            ↺ <span>{t("whiteboard.reset")}</span>
          </button>
          <div className="rail-tip">{t("whiteboard.tip")}</div>
        </aside>

        <section className="whiteboard-stage">
          <div className="whiteboard-toolbar">
            <div className="board-title">
              <span className="board-title-dot" />
              {t("whiteboard.mainBoard")}
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
          </div>
          <div
            className="whiteboard-canvas"
            ref={canvasRef}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) onPointerDown(event);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div
              className="canvas-grid"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
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
                  className={`board-card ${card.color}${selectedId === card.id ? " selected" : ""}`}
                  key={card.id}
                  style={{ left: card.x, top: card.y }}
                  onPointerDown={(event) => onPointerDown(event, card)}
                >
                  <div className="card-pin" />
                  <h3>{card.title || t("whiteboard.untitled")}</h3>
                  <p>{card.body || t("whiteboard.emptyCard")}</p>
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
            <div className="canvas-hint">{t("whiteboard.canvasHint")}</div>
          </div>
        </section>

        <aside className={`whiteboard-inspector${selected ? " open" : ""}`}>
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
              <label className="inspector-label">{t("whiteboard.title")}</label>
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
              <label className="inspector-label">{t("whiteboard.color")}</label>
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
                    const other = cardById.get(outgoing ? edge.to : edge.from);
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
        </aside>
      </div>
    </div>
  );
}
