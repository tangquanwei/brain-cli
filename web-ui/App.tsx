import { useCallback, useEffect, useRef, useState } from "react";
import { api, withToken, setToken } from "./api";
import { lastWhiteboard } from "./whiteboardSession";
import { Modal } from "./components/Modal";
import { SearchModal } from "./components/SearchModal";
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
      : "notes";
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

/** A saved rename changes the address, not the active editing session. */
export function replaceNoteRoute(from: string, to: string): void {
  const current = parseHash();
  if (current.view !== "notes" || current.param !== from) return;
  history.replaceState(null, "", `#/notes/${encodeURIComponent(to)}`);
  window.dispatchEvent(new CustomEvent("brain:note-renamed"));
}

function Shell() {
  const { t, language } = useI18n();
  const toast = useToast();
  const [route, setRoute] = useState<Route>(parseHash);
  const mainRef = useRef<HTMLElement>(null);
  const preserveScroll = useRef(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const creatingRef = useRef(false);
  const [newNoteId, setNewNoteId] = useState<string | null>(null);
  const editStarted = useCallback(() => setNewNoteId(null), []);
  const [searchOpen, setSearchOpen] = useState(false);
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
    const onHash = () => {
      setRoute(parseHash());
    };
    window.addEventListener("hashchange", onHash);
    const onRenamed = () => {
      preserveScroll.current = true;
      setRoute(parseHash());
    };
    window.addEventListener("brain:note-renamed", onRenamed);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("brain:note-renamed", onRenamed);
    };
  }, []);

  const mutated = useCallback(() => setDataVersion((v) => v + 1), []);

  useEffect(() => {
    if (preserveScroll.current) {
      preserveScroll.current = false;
      return;
    }
    if (window.matchMedia("(max-width: 600px)").matches && mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [route.view, route.param]);

  const createPage = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreatingPage(true);
    try {
      const result = await api.createNote(language);
      setNewNoteId(result.id);
      mutated();
      navigate("notes", result.id);
    } catch (error) {
      toast((error as Error).message);
    } finally {
      creatingRef.current = false;
      setCreatingPage(false);
    }
  };

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
    return () =>
      window.removeEventListener("brain:unauthorized", onUnauthorized);
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
            aria-label={t(v.label)}
            aria-current={route.view === v.key ? "page" : undefined}
          >
            <span className="icon">{v.icon}</span>
            <span className="txt">{t(v.label as TranslationKey)}</span>
          </button>
        ))}
        <div className="spacer" />
        <button
          className="new-page-btn"
          onClick={createPage}
          disabled={creatingPage}
        >
          ＋ <span>{t("nav.newPage")}</span>
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
      <header className="mobile-header">
        <div className="mobile-workspace">
          <strong>
            2nd<span>Brain</span>
          </strong>
          <div className="mobile-workspace-actions">
            <button
              onClick={() => navigate("settings")}
              aria-label={t("settings.title")}
              aria-current={route.view === "settings" ? "page" : undefined}
            >
              <span aria-hidden="true">⚙</span>
            </button>
          </div>
        </div>
        <nav className="mobile-functions" aria-label={t("nav.main")}>
          {[VIEWS[1], VIEWS[0], ...VIEWS.slice(2)].map((v) => (
            <button
              key={v.key}
              className={route.view === v.key ? "active" : ""}
              onClick={() => navigate(v.key)}
              aria-current={route.view === v.key ? "page" : undefined}
            >
              <span aria-hidden="true">{v.icon}</span>
              <span>{t(v.key === "graph" ? "nav.graphShort" : v.label)}</span>
            </button>
          ))}
        </nav>
      </header>
      <main className="main" ref={mainRef}>
        {route.view === "dashboard" && <Dashboard dataVersion={dataVersion} />}
        {route.view === "notes" && (
          <Notes
            noteId={route.param}
            autoEditId={newNoteId}
            onEditStarted={editStarted}
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
      <div
        className="mobile-actions"
        role="group"
        aria-label={t("nav.pageActions")}
      >
        <button
          className="mobile-search-button"
          onClick={() => setSearchOpen(true)}
          aria-haspopup="dialog"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
          <span>{t("nav.search")}</span>
        </button>
        <button
          className="mobile-create-button"
          onClick={createPage}
          disabled={creatingPage}
          aria-busy={creatingPage}
        >
          <span aria-hidden="true">＋</span>
          {t("nav.newPage")}
        </button>
      </div>
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      {needsToken && <TokenGate />}
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
