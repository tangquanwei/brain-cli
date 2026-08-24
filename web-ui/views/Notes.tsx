import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { navigate } from "../App";
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
}: {
  id: string;
  dataVersion: number;
  onMutated: () => void;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const [note, setNote] = useState<NoteContent | null>(null);
  const [backlinks, setBacklinks] = useState<BacklinkEdge[]>([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"rename" | "move" | null>(null);

  useEffect(() => {
    setNote(null);
    setError("");
    api.note(id).then(setNote, (e) => setError((e as Error).message));
    api.backlinks(id).then(setBacklinks, () => setBacklinks([]));
  }, [id, dataVersion]);

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
        <div>
          <h2>{note.title}</h2>
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
          <button className="btn" onClick={() => setModal("rename")}>
            {t("notes.rename")}
          </button>
          <button className="btn" onClick={() => setModal("move")}>
            {t("notes.move")}
          </button>
        </div>
      </div>
      <div className="reader-body">
        <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
        {backlinks.length > 0 && (
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
}: {
  noteId: string | null;
  dataVersion: number;
  onMutated: () => void;
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
      <h1 className="page-title">{t("nav.notes")}</h1>
      <div className="notes-grid">
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
          <Reader id={noteId} dataVersion={dataVersion} onMutated={onMutated} />
        ) : (
          <div className="reader">
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
