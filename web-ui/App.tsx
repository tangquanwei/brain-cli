import { useCallback, useEffect, useState } from "react";
import { api, withToken, setToken } from "./api";
import { lastWhiteboard } from "./whiteboardSession";
import { Modal } from "./components/Modal";
import { ToastProvider, useToast } from "./components/Toast";
import { I18nProvider, useI18n, type TranslationKey } from "./i18n";
import { Dashboard } from "./views/Dashboard";
import { GraphView } from "./views/Graph";
import { Links } from "./views/Links";
import { Notes } from "./views/Notes";
import { Review } from "./views/Review";
import { Settings } from "./views/Settings";
import { Whiteboard } from "./views/Whiteboard";

const VIEWS = [
  { key: "dashboard", icon: "📊", label: "nav.dashboard" },
  { key: "notes", icon: "📝", label: "nav.notes" },
  { key: "review", icon: "📚", label: "nav.review" },
  { key: "links", icon: "🔗", label: "nav.links" },
  { key: "graph", icon: "🕸️", label: "nav.graph" },
  { key: "whiteboard", icon: "▦", label: "nav.whiteboard" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"] | "settings";

export interface Route {
  view: ViewKey;
  param: string | null;
}

function parseHash(): Route {
  const hash = location.hash.replace(/^#\/?/, "");
  const [view, ...rest] = hash.split("/");
  const key =
    view === "settings" || VIEWS.some((v) => v.key === view)
      ? (view as ViewKey)
      : "dashboard";
  return {
    view: key,
    param: rest.join("/")
      ? decodeURIComponent(rest.join("/"))
      : key === "whiteboard"
        ? lastWhiteboard()
        : null,
  };
}

export function navigate(view: ViewKey, param?: string): void {
  const hash = `#/${view}${param ? `/${encodeURIComponent(param)}` : ""}`;
  if (
    window.dispatchEvent(
      new CustomEvent("brain:navigate", { detail: hash, cancelable: true }),
    )
  ) {
    location.hash = hash;
  }
}

function CaptureModal({
  onClose,
  onCaptured,
}: {
  onClose: () => void;
  onCaptured: (id: string) => void;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Fleeting");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      toast(t("capture.titleRequired"));
      return;
    }
    setBusy(true);
    try {
      const result = await api.capture({
        title: title.trim(),
        type,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        content,
      });
      toast(t("capture.success"));
      onCaptured(result.id);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title={t("capture.modalTitle")} onClose={onClose}>
      <div className="field">
        <label>{t("capture.title")}</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("capture.titlePlaceholder")}
        />
      </div>
      <div className="field">
        <label>{t("capture.type")}</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="Fleeting">{t("capture.typeFleeting")}</option>
          <option value="Literature">{t("capture.typeLiterature")}</option>
          <option value="Permanent">{t("capture.typePermanent")}</option>
          <option value="Project">{t("capture.typeProject")}</option>
        </select>
      </div>
      <div className="field">
        <label>{t("capture.tags")}</label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tag1, tag2"
        />
      </div>
      <div className="field">
        <label>{t("capture.content")}</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("capture.contentPlaceholder")}
        />
      </div>
      <div className="actions">
        <button className="btn" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button className="btn primary" disabled={busy} onClick={submit}>
          {t("capture.submit")}
        </button>
      </div>
    </Modal>
  );
}

function InboxModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim()) {
      toast(t("inbox.empty"));
      return;
    }
    setBusy(true);
    try {
      await api.inbox(text.trim());
      toast(t("inbox.success"));
      setText("");
      onClose();
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title={t("inbox.title")} onClose={onClose}>
      <div className="field">
        <textarea
          autoFocus
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
          }}
          placeholder={t("inbox.placeholder")}
        />
      </div>
      <div className="actions">
        <button className="btn" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button className="btn primary" disabled={busy} onClick={submit}>
          {t("inbox.submit")}
        </button>
      </div>
    </Modal>
  );
}

function Shell() {
  const { t } = useI18n();
  const [route, setRoute] = useState<Route>(parseHash);
  const [capturing, setCapturing] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [needsToken, setNeedsToken] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("brain-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const mutated = useCallback(() => setDataVersion((v) => v + 1), []);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem("brain-sidebar-collapsed", next ? "1" : "0");
      } catch {
        // Keep the in-memory choice when browser storage is unavailable.
      }
      return next;
    });
  };

  // 订阅服务端文件变化推送（SSE），实时刷新当前视图
  useEffect(() => {
    if (needsToken) return;
    const es = new EventSource(withToken("/api/events"));
    es.onmessage = () => setDataVersion((v) => v + 1);
    return () => es.close();
  }, [needsToken]);

  // 服务端开启 WEB_TOKEN 后，未授权请求（401）触发令牌输入弹窗
  useEffect(() => {
    const onUnauthorized = () => setNeedsToken(true);
    window.addEventListener("brain:unauthorized", onUnauthorized);
    return () => window.removeEventListener("brain:unauthorized", onUnauthorized);
  }, []);

  // 全局快捷键 Cmd/Ctrl+J 唤起瞬时记录
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setInboxOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`app${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <nav className="sidebar">
        <div className="brand-row">
          <div className="brand">
            <span className="brand-full">
              2nd<span>Brain</span>
            </span>
            <span className="brand-short">
              <span className="brand-two">2</span>
              <span>B</span>
            </span>
          </div>
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={
              sidebarCollapsed ? t("sidebar.expand") : t("sidebar.collapse")
            }
            aria-pressed={sidebarCollapsed}
            title={
              sidebarCollapsed ? t("sidebar.expand") : t("sidebar.collapse")
            }
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>
        {VIEWS.map((v) => (
          <button
            key={v.key}
            className={`nav-item${route.view === v.key ? " active" : ""}`}
            onClick={() => navigate(v.key)}
          >
            <span className="icon">{v.icon}</span>
            <span className="txt">{t(v.label as TranslationKey)}</span>
          </button>
        ))}
        <div className="spacer" />
        <button className="capture-btn" onClick={() => setInboxOpen(true)}>
          💡 <span>{t("inbox.open")}</span>
        </button>
        <button className="capture-btn" onClick={() => setCapturing(true)}>
          ＋ <span>{t("nav.capture")}</span>
        </button>
        <button
          className={`settings-btn${route.view === "settings" ? " active" : ""}`}
          onClick={() =>
            navigate(route.view === "settings" ? "dashboard" : "settings")
          }
          aria-expanded={route.view === "settings"}
          aria-label={t("settings.open")}
          title={t("settings.open")}
        >
          ⚙ <span>{t("settings.title")}</span>
        </button>
      </nav>
      <main className="main">
        {route.view === "dashboard" && <Dashboard dataVersion={dataVersion} />}
        {route.view === "notes" && (
          <Notes
            noteId={route.param}
            dataVersion={dataVersion}
            onMutated={mutated}
          />
        )}
        {route.view === "review" && <Review />}
        {route.view === "links" && <Links dataVersion={dataVersion} />}
        {route.view === "graph" && (
          <GraphView noteId={route.param} dataVersion={dataVersion} />
        )}
        {route.view === "whiteboard" && (
          <Whiteboard
            boardId={route.param ?? "research-map"}
            dataVersion={dataVersion}
          />
        )}
        {route.view === "settings" && <Settings dataVersion={dataVersion} />}
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
      {needsToken && <TokenGate />}
      {inboxOpen && <InboxModal onClose={() => setInboxOpen(false)} />}
    </div>
  );
}

function TokenGate() {
  const { language } = useI18n();
  const [value, setValue] = useState("");
  const zh = language === "zh";
  const submit = () => {
    if (!value.trim()) return;
    setToken(value.trim());
    location.reload();
  };
  return (
    <Modal
      title={zh ? "🔐 输入访问令牌" : "🔐 Access Token Required"}
      onClose={() => {
        // 令牌未输入前不允许关闭
      }}
    >
      <div className="field">
        <label>
          {zh
            ? "服务端已开启 WEB_TOKEN 鉴权"
            : "This server requires WEB_TOKEN"}
        </label>
        <input
          autoFocus
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="WEB_TOKEN"
        />
      </div>
      <div className="actions">
        <button className="btn primary" onClick={submit}>
          {zh ? "进入" : "Continue"}
        </button>
      </div>
    </Modal>
  );
}

export function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </I18nProvider>
  );
}
