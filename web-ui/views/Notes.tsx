import { marked } from "marked";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { navigate, replaceNoteRoute } from "../App";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "../components/MarkdownEditor";
import { splitMarkdownDocument } from "../markdownDocument";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { TreeView } from "../components/TreeView";
import { useI18n } from "../i18n";
import type {
  BacklinkEdge,
  MoveResult,
  NoteContent,
  NoteSummary,
  TreeFolderNode,
} from "../types";

function RenameModal({
  id,
  onClose,
  onDone,
}: {
  id: string;
  onClose: () => void;
  onDone: (r: MoveResult) => void;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const base = id.split("/").pop()!.replace(/\.md$/i, "");
  const [name, setName] = useState(base);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) return toast(t("notes.nameRequired"));
    setBusy(true);
    try {
      const r = await api.rename(id, name.trim());
      toast(t("notes.renameSuccess", { count: r.linkRewrites }));
      onDone(r);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal title={t("notes.renameTitle")} onClose={onClose}>
      <div className="field">
        <label>{id}</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        {t("notes.renameHint")}
      </p>
      <div className="actions">
        <button className="btn" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button className="btn primary" disabled={busy} onClick={submit}>
          {t("notes.rename")}
        </button>
      </div>
    </Modal>
  );
}

function MoveModal({
  id,
  onClose,
  onDone,
}: {
  id: string;
  onClose: () => void;
  onDone: (r: MoveResult) => void;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const [path, setPath] = useState(id);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!path.trim()) return toast(t("notes.pathRequired"));
    setBusy(true);
    try {
      const r = await api.move(id, path.trim());
      toast(t("notes.moveSuccess", { count: r.linkRewrites }));
      onDone(r);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal title={t("notes.moveTitle")} onClose={onClose}>
      <div className="field">
        <label>{t("notes.currentPath")}</label>
        <input value={id} disabled />
      </div>
      <div className="field">
        <label>{t("notes.newPath")}</label>
        <input
          autoFocus
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        {t("notes.moveHint")}
      </p>
      <div className="actions">
        <button className="btn" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button className="btn primary" disabled={busy} onClick={submit}>
          {t("notes.move")}
        </button>
      </div>
    </Modal>
  );
}

function Reader({
  id,
  dataVersion,
  onMutated,
  autoEdit,
  onEditStarted,
}: {
  id: string;
  dataVersion: number;
  onMutated: () => void;
  autoEdit: boolean;
  onEditStarted: () => void;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const [note, setNote] = useState<NoteContent | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState("");
  const [backlinks, setBacklinks] = useState<BacklinkEdge[]>([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"rename" | "move" | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const editingRef = useRef(false);
  const loadedId = useRef(id);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const prefix = useRef("");
  const savedBody = useRef("");
  const savingRef = useRef(false);
  const [savedTitle, setSavedTitle] = useState("");
  const dirty =
    editing &&
    (draft !== savedBody.current || draftTitle.trim() !== savedTitle);

  useEffect(() => {
    if (!editing) return;
    const hasChanges = () =>
      (editorRef.current?.getValue() ?? draft) !== savedBody.current ||
      draftTitle.trim() !== savedTitle;
    const beforeNavigate = (event: Event) => {
      if (
        savingRef.current ||
        (hasChanges() && !window.confirm(t("notes.discardChanges")))
      )
        event.preventDefault();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (savingRef.current || hasChanges()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("brain:navigate", beforeNavigate);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("brain:navigate", beforeNavigate);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [editing, draft, draftTitle, savedTitle, t]);

  useEffect(() => {
    if (loadedId.current !== id) {
      loadedId.current = id;
      editingRef.current = false;
      setEditing(false);
      setNote(null);
    }
    // 编辑中跳过 SSE 触发的自动刷新，避免覆盖未保存内容
    if (editingRef.current) return;
    setError("");
    let cancelled = false;
    api.note(id).then(
      (loaded) => {
        if (cancelled) return;
        setNote(loaded);
        if (autoEdit) {
          editingRef.current = true;
          const parts = splitMarkdownDocument(loaded.raw);
          prefix.current = parts.prefix;
          savedBody.current = parts.body;
          setDraft(parts.body);
          setDraftTitle(loaded.title);
          setSavedTitle(loaded.title);
          setEditing(true);
          onEditStarted();
        }
      },
      (e) => {
        if (!cancelled) setError((e as Error).message);
      },
    );
    api.backlinks(id).then(setBacklinks, () => setBacklinks([]));
    return () => {
      cancelled = true;
    };
  }, [id, dataVersion, autoEdit, onEditStarted, editing]);

  const startEdit = () => {
    if (!note) return;
    editingRef.current = true;
    const parts = splitMarkdownDocument(note.raw);
    prefix.current = parts.prefix;
    savedBody.current = parts.body;
    setDraft(parts.body);
    setDraftTitle(note.title);
    setSavedTitle(note.title);
    setEditing(true);
  };

  const cancelEdit = () => {
    editingRef.current = false;
    setEditing(false);
  };

  const saveEdit = async () => {
    if (savingRef.current) return;
    if (!draftTitle.trim()) {
      toast(t("capture.titleRequired"));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const body = editorRef.current?.getValue() ?? draft;
    const title = draftTitle.trim();
    const previousId = loadedId.current;
    try {
      const result = await api.saveNote(
        previousId,
        prefix.current + body,
        title !== note?.title ? title : undefined,
      );
      if (loadedId.current !== previousId) return;
      const saved = result.note;
      loadedId.current = result.id;
      prefix.current = splitMarkdownDocument(saved.raw).prefix;
      savedBody.current = body;
      setSavedTitle(title);
      setNote(saved);
      toast(t("notes.saved"));
      onMutated();
      if (result.id !== previousId) replaceNoteRoute(previousId, result.id);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!event.isComposing) void saveEdit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const publish = async () => {
    if (publishing) return;
    setPublishing(true);
    setPublishResult("");
    try {
      const result = await api.publish(id);
      setPublishResult(
        t("notes.publishSuccess", { path: result.path, count: result.assets }) +
          (result.noteLinks
            ? " " + t("notes.publishLinks", { count: result.noteLinks })
            : ""),
      );
    } catch (error) {
      setPublishResult((error as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const html = useMemo(
    () => (note ? (marked.parse(note.content) as string) : ""),
    [note],
  );

  if (error)
    return (
      <div className="reader">
        <div className="reader-empty">{t("common.loadFailed", { error })}</div>
      </div>
    );
  if (!note)
    return (
      <div className="reader">
        <div className="reader-empty">{t("common.loading")}</div>
      </div>
    );

  return (
    <div className="reader">
      <div className="reader-head">
        <div className="reader-title-block">
          {editing ? (
            <input
              className="note-title-editor"
              aria-label={t("capture.title")}
              value={draftTitle}
              placeholder={t("capture.titlePlaceholder")}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
          ) : (
            <h2>{note.title}</h2>
          )}
          <div className="meta">
            {note.id}
            {note.date ? ` · ${note.date}` : ""}
          </div>
          {note.tags.length > 0 && (
            <div className="tags" style={{ marginTop: 6 }}>
              {note.tags.map((t) => (
                <span className="tag" key={t}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="btn-row">
          {editing ? (
            <>
              <button
                className="btn primary"
                disabled={saving}
                onClick={saveEdit}
              >
                {saving ? t("notes.saving") : t("notes.save")}
              </button>
              <button className="btn" disabled={saving} onClick={cancelEdit}>
                {t(dirty ? "common.cancel" : "notes.done")}
              </button>
              <span className="note-save-status" role="status">
                {t(
                  saving
                    ? "notes.saving"
                    : dirty
                      ? "notes.unsaved"
                      : "notes.saved",
                )}
              </span>
            </>
          ) : (
            <button className="btn" onClick={startEdit}>
              {t("notes.edit")}
            </button>
          )}
          {!editing && (
            <>
              <button
                className="btn primary"
                disabled={publishing}
                onClick={publish}
                title={t("notes.publishHint")}
              >
                {publishing ? t("notes.publishing") : t("notes.publish")}
              </button>
              <button
                className="btn"
                onClick={() =>
                  api
                    .open(id)
                    .then(() => toast(t("common.openedInVSCode")))
                    .catch((e) => toast((e as Error).message))
                }
              >
                VS Code
              </button>
              <button
                className="btn"
                disabled={editing}
                onClick={() => setModal("rename")}
              >
                {t("notes.rename")}
              </button>
              <button
                className="btn"
                disabled={editing}
                onClick={() => setModal("move")}
              >
                {t("notes.move")}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="reader-body">
        {publishResult && (
          <p role="status" style={{ overflowWrap: "anywhere" }}>
            {publishResult}
          </p>
        )}
        {editing ? (
          <MarkdownEditor
            ref={editorRef}
            noteId={id}
            initialValue={draft}
            onChange={setDraft}
            onSave={() => void saveEdit()}
          />
        ) : (
          <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
        )}
        {!editing && backlinks.length > 0 && (
          <>
            <h3 style={{ marginTop: 28, fontSize: 15 }}>
              {t("notes.backlinks", { count: backlinks.length })}
            </h3>
            <table className="link-table">
              <tbody>
                {backlinks.map((b, i) => (
                  <tr key={i}>
                    <td
                      className="clickable"
                      onClick={() => navigate("notes", b.fromRel)}
                    >
                      {b.fromRel}
                    </td>
                    <td className="muted">{b.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
      {modal === "rename" && (
        <RenameModal
          id={id}
          onClose={() => setModal(null)}
          onDone={(r) => {
            setModal(null);
            onMutated();
            navigate("notes", r.to);
          }}
        />
      )}
      {modal === "move" && (
        <MoveModal
          id={id}
          onClose={() => setModal(null)}
          onDone={(r) => {
            setModal(null);
            onMutated();
            navigate("notes", r.to);
          }}
        />
      )}
    </div>
  );
}

export function Notes({
  noteId,
  dataVersion,
  onMutated,
  autoEditId,
  onEditStarted,
}: {
  noteId: string | null;
  dataVersion: number;
  onMutated: () => void;
  autoEditId: string | null;
  onEditStarted: () => void;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const [tree, setTree] = useState<TreeFolderNode | null>(null);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<NoteSummary[] | null>(null);

  useEffect(() => {
    api.tree().then(setTree, (e) => toast((e as Error).message));
  }, [dataVersion, toast]);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setHits(null);
      return;
    }
    const timer = setTimeout(() => {
      api.notes(q).then(setHits, () => setHits([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <>
      <div className="notes-heading">
        {noteId && (
          <button
            className="mobile-notes-back btn"
            onClick={() => navigate("notes")}
          >
            <span aria-hidden="true">‹ </span>
            {t("notes.backToList")}
          </button>
        )}
        <h1 className="page-title">{t("nav.notes")}</h1>
      </div>
      <div className={`notes-grid${noteId ? " has-note" : ""}`}>
        <div className="tree-pane">
          <input
            className="search"
            placeholder={t("notes.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {hits ? (
            hits.length ? (
              hits.slice(0, 50).map((n) => (
                <div
                  className="search-hit"
                  key={n.id}
                  onClick={() => navigate("notes", n.id)}
                >
                  <div className="t">{n.title}</div>
                  <div className="p">{n.id}</div>
                  <div className="s">{n.summary}</div>
                </div>
              ))
            ) : (
              <span className="muted">{t("notes.noMatches")}</span>
            )
          ) : tree ? (
            <ul className="tree-list">
              <TreeView
                node={tree}
                depth={0}
                selectedId={noteId}
                onSelect={(id) => navigate("notes", id)}
                onOpen={(id) =>
                  api
                    .open(id)
                    .then(() => toast(t("common.openedInVSCode")))
                    .catch((e) => toast((e as Error).message))
                }
              />
            </ul>
          ) : (
            <span className="muted">{t("common.loading")}</span>
          )}
        </div>
        {noteId ? (
          <Reader
            id={noteId}
            autoEdit={autoEditId === noteId}
            onEditStarted={onEditStarted}
            dataVersion={dataVersion}
            onMutated={onMutated}
          />
        ) : (
          <div className="reader notes-placeholder">
            <div className="reader-empty">
              {t("notes.selectPrompt")}
              <br />
              <br />
              <span style={{ fontSize: 12 }}>{t("notes.openHint")}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
