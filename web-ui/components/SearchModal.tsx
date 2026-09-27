import { useEffect, useState } from "react";
import { api } from "../api";
import { navigate } from "../App";
import { useI18n } from "../i18n";
import type { NoteSummary } from "../types";
import { Modal } from "./Modal";

export function SearchModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NoteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setResults([]);
    setError("");
    setLoading(Boolean(query.trim()));
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      api.notes(query.trim()).then(
        (notes) => {
          if (!cancelled) {
            setResults(notes);
            setLoading(false);
          }
        },
        (e: Error) => {
          if (!cancelled) {
            setError(e.message);
            setLoading(false);
          }
        },
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <Modal title={t("nav.search")} onClose={onClose}>
      <div className="field">
        <input
          type="search"
          autoFocus
          aria-label={t("nav.search")}
          placeholder={t("notes.searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div
        className="note-search-results"
        aria-live="polite"
        aria-busy={loading}
      >
        {error ? (
          <p role="alert">{t("common.loadFailed", { error })}</p>
        ) : loading ? (
          <p className="muted">{t("common.loading")}</p>
        ) : !query.trim() ? (
          <p className="muted">{t("notes.searchHint")}</p>
        ) : results.length === 0 ? (
          <p className="muted">{t("notes.noMatches")}</p>
        ) : (
          results.slice(0, 50).map((note) => (
            <button
              className="note-search-result"
              key={note.id}
              onClick={() => {
                navigate("notes", note.id);
                onClose();
              }}
            >
              <strong>{note.title}</strong>
              <small>{note.id}</small>
              <span>{note.summary}</span>
            </button>
          ))
        )}
      </div>
      <div className="actions">
        <button className="btn" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>
    </Modal>
  );
}
