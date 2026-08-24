import { useState } from "react";
import { api } from "../api";
import { navigate } from "../App";
import { useI18n, type TranslationKey } from "../i18n";
import type { ReviewNote } from "../types";

const MODES = [
  { key: "week", label: "review.week" },
  { key: "month", label: "review.month" },
  { key: "random", label: "review.random" },
  { key: "tags", label: "review.tags" },
] as const;

export function Review() {
  const { t } = useI18n();
  const [active, setActive] = useState<string | null>(null);
  const [notes, setNotes] = useState<ReviewNote[] | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (mode: string) => {
    let extra = "";
    if (mode === "tags") {
      const tags = prompt(t("review.tagsPrompt"));
      if (!tags) return;
      extra = `&tags=${encodeURIComponent(tags)}`;
    }
    setActive(mode);
    setLoading(true);
    try {
      const d = await api.review(mode, extra);
      setNotes(d.notes);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="page-title">{t("nav.review")}</h1>
      <div className="panel">
        <div className="btn-row">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`btn${active === m.key ? " primary" : ""}`}
              onClick={() => run(m.key)}
            >
              {t(m.label as TranslationKey)}
            </button>
          ))}
        </div>
      </div>
      {loading && <p className="muted">{t("common.loading")}</p>}
      {!loading && notes && (
        <>
          <p className="muted">{t("review.total", { count: notes.length })}</p>
          {notes.length === 0 ? (
            <p className="muted">{t("review.empty")}</p>
          ) : (
            <div className="note-cards">
              {notes.map((n) => (
                <div
                  className="note-card"
                  key={n.id}
                  onClick={() => navigate("notes", n.id)}
                >
                  <div className="t">{n.title}</div>
                  <div className="d">
                    {n.date} · {n.id}
                  </div>
                  {n.tags.length > 0 && (
                    <div className="tags" style={{ marginTop: 6 }}>
                      {n.tags.map((t) => (
                        <span className="tag" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
