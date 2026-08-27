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
  WhiteboardDocument,
  SettingsSnapshot,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
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
  backlinks: (id: string) =>
    request<BacklinkEdge[]>(`/api/backlinks?id=${encodeURIComponent(id)}`),
  review: (mode: string, extra = "") =>
    request<{ mode: string; notes: ReviewNote[] }>(
      `/api/review?mode=${mode}${extra}`,
    ),
  links: () => request<LinksData>("/api/links"),
  graph: () => request<GraphViewData>("/api/graph"),
  open: (id: string) => post<{ ok: boolean }>("/api/open", { id }),
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
    request<WhiteboardDocument>(`/api/whiteboard?id=${encodeURIComponent(id)}`),
  saveWhiteboard: (id: string, board: WhiteboardDocument) =>
    request<WhiteboardDocument>("/api/whiteboard", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, board }),
    }),
  settings: () => request<SettingsSnapshot>("/api/settings"),
  saveSettings: (values: Partial<SettingsSnapshot["values"]>) =>
    request<SettingsSnapshot>("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values }),
    }),
};
