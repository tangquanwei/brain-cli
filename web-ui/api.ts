import type { DrawingDocument, DrawingScene } from "../src/web/drawingData";
import type {
  BacklinkEdge,
  DashboardData,
  GraphViewData,
  LinksData,
  MoveResult,
  NoteContent,
  NoteSummary,
  ReviewNote,
  TreeFolderNode,
  WhiteboardSummary,
  SettingsSnapshot,
} from "./types";

const TOKEN_KEY = "brain-web-token";

export function getToken(): string {
  // 首次通过 URL ?token= 访问时，持久化到 localStorage 并把 token 从地址栏抹掉
  try {
    const url = new URL(location.href);
    const fromUrl = url.searchParams.get("token");
    if (fromUrl) {
      localStorage.setItem(TOKEN_KEY, fromUrl);
      url.searchParams.delete("token");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
      return fromUrl;
    }
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function withToken(path: string): string {
  const token = getToken();
  if (!token) return path;
  return `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(withToken(path), init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent("brain:unauthorized"));
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  dashboard: () => request<DashboardData>("/api/dashboard"),
  tree: () => request<TreeFolderNode>("/api/tree"),
  notes: (q: string) =>
    request<NoteSummary[]>(`/api/notes?q=${encodeURIComponent(q)}`),
  note: (id: string) =>
    request<NoteContent>(`/api/note?id=${encodeURIComponent(id)}`),
  saveNote: (id: string, raw: string) =>
    request<{ ok: boolean; id: string }>("/api/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, raw }),
    }),
  inbox: (text: string) =>
    post<{ ok: boolean; id: string }>("/api/inbox", { text }),
  backlinks: (id: string) =>
    request<BacklinkEdge[]>(`/api/backlinks?id=${encodeURIComponent(id)}`),
  review: (mode: string, extra = "") =>
    request<{ mode: string; notes: ReviewNote[] }>(
      `/api/review?mode=${mode}${extra}`,
    ),
  links: () => request<LinksData>("/api/links"),
  graph: () => request<GraphViewData>("/api/graph"),
  open: (id: string) => post<{ ok: boolean }>("/api/open", { id }),
  publish: (id: string) =>
    post<{ path: string; updated: boolean; assets: number; noteLinks: number }>(
      "/api/publish",
      { id },
    ),
  capture: (body: {
    title: string;
    type: string;
    tags: string[];
    content: string;
  }) => post<{ ok: boolean; id: string }>("/api/capture", body),
  rename: (id: string, newName: string) =>
    post<MoveResult>("/api/rename", { id, newName }),
  move: (id: string, newPath: string) =>
    post<MoveResult>("/api/move", { id, newPath }),
  whiteboard: (id = "research-map") =>
    request<DrawingDocument>(`/api/whiteboard?id=${encodeURIComponent(id)}`),
  whiteboards: () => request<WhiteboardSummary[]>("/api/whiteboards"),
  saveWhiteboard: (
    id: string,
    scene: DrawingScene,
    title: string,
    revision: string | null,
  ) =>
    request<DrawingDocument>("/api/whiteboard", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, scene, title, revision }),
    }),
  whiteboardAction: (body: {
    action: "create" | "delete";
    id?: string;
    title?: string;
    revision?: string | null;
  }) => post<DrawingDocument | { ok: boolean }>("/api/whiteboards", body),
  settings: () => request<SettingsSnapshot>("/api/settings"),
  saveSettings: (values: Partial<SettingsSnapshot["values"]>) =>
    request<SettingsSnapshot>("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values }),
    }),
};
