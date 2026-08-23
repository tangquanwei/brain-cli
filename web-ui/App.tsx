import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Modal } from "./components/Modal";
import { ToastProvider, useToast } from "./components/Toast";
import { Dashboard } from "./views/Dashboard";
import { GraphView } from "./views/Graph";
import { Links } from "./views/Links";
import { Notes } from "./views/Notes";
import { Review } from "./views/Review";

const VIEWS = [
  { key: "dashboard", icon: "📊", label: "仪表盘" },
  { key: "notes", icon: "📝", label: "笔记" },
  { key: "review", icon: "📚", label: "回顾" },
  { key: "links", icon: "🔗", label: "链接健康" },
  { key: "graph", icon: "🕸️", label: "知识图谱" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

export interface Route {
  view: ViewKey;
  param: string | null;
}

function parseHash(): Route {
  const hash = location.hash.replace(/^#\/?/, "");
  const [view, ...rest] = hash.split("/");
  const key = VIEWS.some((v) => v.key === view) ? (view as ViewKey) : "dashboard";
  return {
    view: key,
    param: rest.length ? decodeURIComponent(rest.join("/")) : null,
  };
}

export function navigate(view: ViewKey, param?: string): void {
  location.hash = `#/${view}${param ? `/${encodeURIComponent(param)}` : ""}`;
}

function CaptureModal({
  onClose,
  onCaptured,
}: {
  onClose: () => void;
  onCaptured: (id: string) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Fleeting");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      toast("标题不能为空");
      return;
    }
    setBusy(true);
    try {
      const result = await api.capture({
        title: title.trim(),
        type,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        content,
      });
      toast("✅ 已捕获");
      onCaptured(result.id);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title="💡 捕获想法" onClose={onClose}>
      <div className="field">
        <label>标题</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="笔记标题"
        />
      </div>
      <div className="field">
        <label>类型</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option>Fleeting</option>
          <option>Literature</option>
          <option>Permanent</option>
          <option>Project</option>
        </select>
      </div>
      <div className="field">
        <label>标签（逗号分隔）</label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tag1, tag2"
        />
      </div>
      <div className="field">
        <label>正文</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="想法内容…"
        />
      </div>
      <div className="actions">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button className="btn primary" disabled={busy} onClick={submit}>
          捕获
        </button>
      </div>
    </Modal>
  );
}

function Shell() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [capturing, setCapturing] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const mutated = useCallback(() => setDataVersion((v) => v + 1), []);

  // 订阅服务端文件变化推送（SSE），实时刷新当前视图
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = () => setDataVersion((v) => v + 1);
    return () => es.close();
  }, []);

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          2nd<span>Brain</span>
        </div>
        {VIEWS.map((v) => (
          <button
            key={v.key}
            className={`nav-item${route.view === v.key ? " active" : ""}`}
            onClick={() => navigate(v.key)}
          >
            <span className="icon">{v.icon}</span>
            <span className="txt">{v.label}</span>
          </button>
        ))}
        <div className="spacer" />
        <button className="capture-btn" onClick={() => setCapturing(true)}>
          ＋ <span>捕获想法</span>
        </button>
      </nav>
      <main className="main">
        {route.view === "dashboard" && <Dashboard dataVersion={dataVersion} />}
        {route.view === "notes" && (
          <Notes noteId={route.param} dataVersion={dataVersion} onMutated={mutated} />
        )}
        {route.view === "review" && <Review />}
        {route.view === "links" && <Links dataVersion={dataVersion} />}
        {route.view === "graph" && (
          <GraphView noteId={route.param} dataVersion={dataVersion} />
        )}
      </main>
      {capturing && (
        <CaptureModal
          onClose={() => setCapturing(false)}
          onCaptured={(id) => {
            setCapturing(false);
            mutated();
            navigate("notes", id);
          }}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
