import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CaptureUpdateAction,
  Excalidraw,
  MainMenu,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { DrawingDocument } from "../../src/web/drawingData";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { api } from "../api";
import { rememberWhiteboard } from "../whiteboardSession";
import { navigate } from "../App";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n";
import {
  drawingInitialData,
  noteElements,
  noteId,
  sceneJSON,
} from "../drawing";
import type { NoteContent, NoteSummary, WhiteboardSummary } from "../types";

interface WhiteboardProps {
  boardId?: string;
  dataVersion?: number;
}

export function Whiteboard({
  boardId = "research-map",
  dataVersion = 0,
}: WhiteboardProps) {
  return <Board key={boardId} boardId={boardId} dataVersion={dataVersion} />;
}

function Board({ boardId, dataVersion }: Required<WhiteboardProps>) {
  const { t, language } = useI18n();
  const toast = useToast();
  const [initial, setInitial] = useState<ExcalidrawInitialDataState | null>(
    null,
  );
  const [epoch, setEpoch] = useState(0);
  const [title, setTitle] = useState(boardId);
  const [boards, setBoards] = useState<WhiteboardSummary[]>([]);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<
    "saved" | "saving" | "pending" | "error"
  >("saved");
  const [panel, setPanel] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NoteSummary[]>([]);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [note, setNote] = useState<NoteContent | null>(null);
  const [noteError, setNoteError] = useState("");
  const [modal, setModal] = useState<
    "create" | "rename" | "delete" | "reload" | null
  >(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const lastSelection = useRef<string | null>(null);
  const excalidraw = useRef<ExcalidrawImperativeAPI | null>(null);
  const session = useRef({
    revision: null as string | null,
    title: boardId,
    saved: "",
    current: "",
    pending: false,
    conflict: false,
    saving: null as Promise<void> | null,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    alive: true,
  });
  const state = session.current;

  const flush = useCallback((): Promise<void> => {
    clearTimeout(state.timer);
    if (state.saving) return state.saving;
    if (!state.pending || state.conflict) return Promise.resolve();
    state.saving = (async () => {
      while (state.pending && !state.conflict) {
        const content = state.current;
        const savedTitle = state.title;
        state.pending = false;
        if (state.alive) setSaveState("saving");
        try {
          const saved = await api.saveWhiteboard(
            boardId,
            JSON.parse(content),
            savedTitle,
            state.revision,
          );
          state.revision = saved.revision;
          state.saved = content;
          if (state.alive) {
            setSaveState(state.pending ? "pending" : "saved");
            setError("");
          }
        } catch (e) {
          state.pending = true;
          state.conflict = (e as Error).message === "whiteboard-conflict";
          if (state.alive) {
            setSaveState("error");
            setError((e as Error).message);
          }
          break;
        }
      }
    })().finally(() => {
      state.saving = null;
    });
    return state.saving;
  }, [boardId, state]);

  const accept = useCallback(
    (board: DrawingDocument) => {
      const data = drawingInitialData(board);
      rememberWhiteboard(board.id);
      state.revision = board.revision;
      state.title = board.title;
      state.saved = "";
      state.current = "";
      state.pending = false;
      state.conflict = false;
      setTitle(board.title);
      setInitial(data);
      setEpoch((value) => value + 1);
      setError("");
      setSaveState("saved");
    },
    [state],
  );

  useEffect(() => {
    state.alive = true;
    api
      .whiteboard(boardId)
      .then((board) => {
        if (state.alive) accept(board);
      })
      .catch((e) => {
        if (state.alive) setError((e as Error).message);
      });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (state.pending || state.saving) {
        void flush();
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const beforeNavigate = (event: Event) => {
      if (!state.pending && !state.saving) return;
      event.preventDefault();
      void flush().then(() => {
        if (state.pending || state.conflict) toast(t("drawing.unsaved"));
        else location.hash = (event as CustomEvent<string>).detail;
      });
    };
    window.addEventListener("brain:navigate", beforeNavigate);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      state.alive = false;
      clearTimeout(state.timer);
      void flush();
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("brain:navigate", beforeNavigate);
    };
  }, [boardId, accept, flush, state]);

  useEffect(() => {
    let cancelled = false;
    api.whiteboards().then(
      (value) => {
        if (!cancelled) setBoards(value);
      },
      (e) => toast((e as Error).message),
    );
    if (initial && !state.saving) {
      api
        .whiteboard(boardId)
        .then((board) => {
          if (cancelled || state.saving || board.revision === state.revision)
            return;
          if (state.pending) {
            state.conflict = true;
            setError("whiteboard-conflict");
            setSaveState("error");
          } else accept(board);
        })
        .catch((e) => {
          if (!cancelled) setError((e as Error).message);
        });
    }
    return () => {
      cancelled = true;
    };
    // File events refresh idle scenes; pending edits are never replaced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);

  useEffect(() => {
    if (!panel) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api.notes(query).then(
        (value) => {
          if (!cancelled) setResults(value.slice(0, 50));
        },
        (e) => toast((e as Error).message),
      );
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, panel, dataVersion, toast]);

  useEffect(() => {
    setNote(null);
    setNoteError("");
    if (!selectedNote) return;
    let cancelled = false;
    api.note(selectedNote).then(
      (value) => {
        if (!cancelled) setNote(value);
      },
      (e) => {
        if (!cancelled) setNoteError((e as Error).message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedNote, dataVersion]);

  const preview = useMemo(
    () =>
      note ? DOMPurify.sanitize(marked.parse(note.content) as string) : "",
    [note],
  );

  const addNote = (item: NoteSummary) => {
    const canvas = excalidraw.current;
    if (!canvas) return;
    const elements = canvas.getSceneElements();
    const existing = elements.find((element) => noteId(element) === item.id);
    if (existing) {
      canvas.scrollToContent(existing);
      canvas.updateScene({
        appState: { selectedElementIds: { [existing.id]: true } },
      });
    } else {
      const app = canvas.getAppState();
      const added = noteElements(
        item,
        -app.scrollX + app.width / app.zoom.value / 2 - 140,
        -app.scrollY + app.height / app.zoom.value / 2 - 60,
      );
      canvas.updateScene({
        elements: [...elements, ...added],
        appState: {
          selectedElementIds: Object.fromEntries(
            added.map((element) => [element.id, true]),
          ),
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    }
    setSelectedNote(item.id);
  };

  const download = () => {
    if (!state.current) return;
    const url = URL.createObjectURL(
      new Blob([state.current], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${boardId}.excalidraw`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const act = async () => {
    setBusy(true);
    try {
      if (modal === "reload") {
        clearTimeout(state.timer);
        if (state.saving) await state.saving;
        accept(await api.whiteboard(boardId));
      } else {
        await flush();
        if (state.pending || state.conflict)
          throw new Error(error || "whiteboard-conflict");
        if (modal === "rename") {
          const saved = await api.saveWhiteboard(
            boardId,
            JSON.parse(state.current),
            name,
            state.revision,
          );
          state.revision = saved.revision;
          state.title = saved.title;
          setTitle(saved.title);
        } else if (modal === "delete") {
          await api.whiteboardAction({
            action: "delete",
            id: boardId,
            revision: state.revision,
          });
          navigate("whiteboard", `board-${Date.now()}`);
        } else {
          const saved = (await api.whiteboardAction({
            action: "create",
            title: name,
          })) as DrawingDocument;
          navigate("whiteboard", saved.id);
        }
      }
      setModal(null);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const switchBoard = async (id: string) => {
    await flush();
    if (state.pending || state.conflict) {
      toast(t("drawing.unsaved"));
      return;
    }
    navigate("whiteboard", id);
  };

  return (
    <div className="drawing-page">
      <header className="drawing-toolbar">
        <select
          aria-label={t("whiteboard.mainBoard")}
          value={boardId}
          onChange={(event) => void switchBoard(event.target.value)}
        >
          {!boards.some((board) => board.id === boardId) && (
            <option value={boardId}>{title}</option>
          )}
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.id === boardId ? title : board.title}
            </option>
          ))}
        </select>
        <button
          className="btn"
          onClick={() => {
            setName("");
            setModal("create");
          }}
        >
          {t("whiteboard.createBoard")}
        </button>
        <button
          className="btn"
          disabled={!initial}
          onClick={() => {
            setName(title);
            setModal("rename");
          }}
        >
          {t("whiteboard.renameBoard")}
        </button>
        <button className="btn" disabled={!initial} onClick={download}>
          {t("drawing.export")}
        </button>
        <button
          className="btn"
          disabled={!initial}
          onClick={() => setModal("delete")}
        >
          {t("whiteboard.deleteBoard")}
        </button>
        <span className="drawing-save" role="status">
          {t(`drawing.${saveState}`)}
        </span>
        <button
          className="btn primary"
          aria-expanded={panel}
          onClick={() => setPanel((value) => !value)}
        >
          {t("drawing.notes")}
        </button>
      </header>
      {error && (
        <div className="drawing-error" role="alert">
          <span>
            {error === "whiteboard-conflict" ? t("drawing.conflict") : error}
          </span>
          {initial && (
            <button className="btn" onClick={download}>
              {t("drawing.export")}
            </button>
          )}
          {!state.conflict && initial && (
            <button className="btn" onClick={() => void flush()}>
              {t("drawing.retry")}
            </button>
          )}
          <button className="btn" onClick={() => setModal("reload")}>
            {t("drawing.reload")}
          </button>
        </div>
      )}
      <div className="drawing-content">
        <div className="drawing-canvas">
          {initial ? (
            <Excalidraw
              key={epoch}
              initialData={initial}
              excalidrawAPI={(value) => {
                excalidraw.current = value;
              }}
              langCode={language === "zh" ? "zh-CN" : "en"}
              name={title}
              aiEnabled={false}
              validateEmbeddable={false}
              onChange={(elements, appState, files) => {
                const selected = elements.find(
                  (element) =>
                    appState.selectedElementIds[element.id] && noteId(element),
                );
                const reference = selected ? noteId(selected) : null;
                if (reference && reference !== lastSelection.current) {
                  setSelectedNote(reference);
                  setPanel(true);
                }
                lastSelection.current = reference;
                const content = sceneJSON(elements, appState, files);
                if (content === state.current) return;
                state.current = content;
                state.pending = !!state.saving || content !== state.saved;
                if (state.pending && !state.conflict) {
                  setSaveState("pending");
                  clearTimeout(state.timer);
                  state.timer = setTimeout(() => void flush(), 400);
                }
              }}
              onLinkOpen={(element, event) => {
                const id = noteId(element);
                if (id) {
                  event.preventDefault();
                  setSelectedNote(id);
                  setPanel(true);
                }
              }}
            >
              <MainMenu>
                <MainMenu.DefaultItems.LoadScene />
                <MainMenu.Item onSelect={download}>
                  {t("drawing.export")}
                </MainMenu.Item>
                <MainMenu.DefaultItems.SaveAsImage />
                <MainMenu.DefaultItems.ClearCanvas />
                <MainMenu.Separator />
                <MainMenu.DefaultItems.ToggleTheme />
                <MainMenu.DefaultItems.ChangeCanvasBackground />
                <MainMenu.DefaultItems.Help />
              </MainMenu>
            </Excalidraw>
          ) : (
            <div className="reader-empty">
              {error ? t("drawing.reload") : t("common.loading")}
            </div>
          )}
        </div>
        {panel && (
          <aside className="drawing-notes" aria-label={t("drawing.notes")}>
            <div className="drawing-notes-head">
              <strong>{t("drawing.notes")}</strong>
              <button
                className="btn"
                aria-label={t("drawing.close")}
                onClick={() => setPanel(false)}
              >
                ×
              </button>
            </div>
            <input
              type="search"
              aria-label={t("drawing.search")}
              placeholder={t("drawing.search")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="drawing-note-list">
              {results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addNote(item)}
                  title={item.id}
                >
                  <strong>＋ {item.title}</strong>
                  <small>{item.id}</small>
                </button>
              ))}
              {!results.length && <p>{t("drawing.noResults")}</p>}
            </div>
            <section className="drawing-preview">
              {selectedNote ? (
                <>
                  <div className="drawing-note-path">{selectedNote}</div>
                  {noteError ? (
                    <p role="alert">{t("drawing.missing")}</p>
                  ) : note ? (
                    <>
                      <div className="drawing-note-actions">
                        <button
                          className="btn primary"
                          onClick={() =>
                            api.open(note.id).then(
                              () => toast(t("common.openedInVSCode")),
                              (e) => toast((e as Error).message),
                            )
                          }
                        >
                          {t("drawing.vscode")}
                        </button>
                        <button
                          className="btn"
                          onClick={() => navigate("notes", note.id)}
                        >
                          {t("drawing.openNote")}
                        </button>
                      </div>
                      <h2>{note.title}</h2>
                      <div
                        className="md"
                        dangerouslySetInnerHTML={{ __html: preview }}
                      />
                    </>
                  ) : (
                    <p>{t("common.loading")}</p>
                  )}
                </>
              ) : (
                <p>{t("drawing.hint")}</p>
              )}
            </section>
          </aside>
        )}
      </div>
      {modal && (
        <Modal
          title={
            modal === "create"
              ? t("whiteboard.newBoard")
              : modal === "rename"
                ? t("whiteboard.renameBoard")
                : modal === "delete"
                  ? t("whiteboard.deleteBoard")
                  : t("drawing.reload")
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          {modal === "create" || modal === "rename" ? (
            <div className="field">
              <label>{t("whiteboard.newBoard")}</label>
              <input
                autoFocus
                value={name}
                maxLength={200}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && name.trim() && !busy) void act();
                }}
              />
            </div>
          ) : (
            <p>
              {modal === "delete"
                ? t("whiteboard.confirmDeleteBoard")
                : t("drawing.confirmReload")}
            </p>
          )}
          <div className="actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              {t("common.cancel")}
            </button>
            <button
              className="btn primary"
              disabled={
                busy ||
                ((modal === "create" || modal === "rename") && !name.trim())
              }
              onClick={() => void act()}
            >
              {t("drawing.confirm")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
