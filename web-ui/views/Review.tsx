import { useState } from "react";
import { api } from "../api";
import { navigate } from "../App";
import type { ReviewNote } from "../types";

const MODES = [
  { key: "week", label: "📅 本周" },
  { key: "month", label: "🗓 本月" },
  { key: "random", label: "🎲 随机 5 篇" },
  { key: "tags", label: "🏷️ 按标签" },
] as const;

export function Review() {
  const [active, setActive] = useState<string | null>(null);
  const [notes, setNotes] = useState<ReviewNote[] | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (mode: string) => {
    let extra = "";
    if (mode === "tags") {
      const tags = prompt("输入标签（逗号分隔）");
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
      <h1 className="page-title">回顾</h1>
      <div className="panel">
        <div className="btn-row">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`btn${active === m.key ? " primary" : ""}`}
              onClick={() => run(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {loading && <p className="muted">加载中…</p>}
      {!loading && notes && (
        <>
          <p className="muted">共 {notes.length} 篇</p>
          {notes.length === 0 ? (
            <p className="muted">没有符合条件的笔记 📝</p>
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
