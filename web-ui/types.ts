export interface AreaCount {
  area: string;
  count: number;
  children: { name: string; count: number }[];
}

export interface NoteSummary {
  id: string;
  title: string;
  date: string;
  tags: string[];
  summary: string;
}

export interface DashboardData {
  total: number;
  areas: AreaCount[];
  links: {
    edges: number;
    broken: number;
    missingHeading: number;
    missingAssets: number;
    nonStandard: number;
    orphans: number;
    activeOrphans: number;
    activeNotes: number;
  };
  recent: NoteSummary[];
  git: { notesRepo: boolean; pendingFiles: number };
}

export interface NoteContent {
  id: string;
  title: string;
  date: string;
  tags: string[];
  content: string;
  raw: string;
}

export interface TreeNoteNode {
  type: "note";
  name: string;
  id: string;
}

export interface TreeFolderNode {
  type: "folder" | "root";
  name: string;
  id: string;
  noteCount: number;
  children: TreeNode[];
}

export type TreeNode = TreeFolderNode | TreeNoteNode;

export interface BacklinkEdge {
  fromRel: string;
  text: string;
  href: string;
}

export interface ReviewNote {
  id: string;
  title: string;
  date: string;
  tags: string[];
}

export interface LinkEdgeItem {
  fromRel: string;
  href: string;
  suffix: string;
}

export interface LinksData {
  nodes: number;
  edges: number;
  brokenLinks: LinkEdgeItem[];
  missingHeadingLinks: LinkEdgeItem[];
  missingAssets: { file: string; raw: string; target: string }[];
  nonStandardLinks: { file: string; raw: string }[];
  orphanNotes: string[];
}

export type GraphArea =
  | "projects"
  | "areas"
  | "resources"
  | "questions"
  | "archives"
  | "root";

export interface GraphViewNode {
  id: string;
  title: string;
  area: GraphArea;
  tags: string[];
  inDegree: number;
  outDegree: number;
  semanticDegree: number;
  indexDegree: number;
  folderDegree: number;
  isArchive: boolean;
  isIndex: boolean;
  isFolder: boolean;
}

export interface GraphViewEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  heading?: string;
  count: number;
  kind: "semantic" | "index" | "folder";
}

export interface GraphViewData {
  generatedAt: string;
  nodes: GraphViewNode[];
  edges: GraphViewEdge[];
  stats: {
    nodes: number;
    edges: number;
    visibleNodes: number;
    visibleEdges: number;
  };
}

export interface MoveResult {
  ok: boolean;
  from: string;
  to: string;
  linkRewrites: number;
  assetMoves: number;
}

export type WhiteboardColor = "blue" | "yellow" | "green" | "pink";
export type WhiteboardCardKind = "note" | "text" | "block" | "attachment";

export interface WhiteboardCard {
  id: string;
  kind?: WhiteboardCardKind;
  title: string;
  body: string;
  color: WhiteboardColor;
  x: number;
  y: number;
  sourceId?: string;
  source?: { noteId?: string; blockId?: string; path?: string };
  tags?: string[];
  zIndex?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WhiteboardEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind?: "semantic" | "supports" | "contradicts" | "causes" | "references";
}

export interface WhiteboardDocument {
  version: 1 | 2;
  id: string;
  title: string;
  cards: WhiteboardCard[];
  frames?: WhiteboardFrame[];
  edges: WhiteboardEdge[];
  viewport: { x: number; y: number; zoom: number };
  updatedAt: string;
  persisted?: boolean;
}

export interface WhiteboardFrame {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: WhiteboardColor;
  zIndex?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WhiteboardSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export type EnvKey =
  | "NOTES_DIR"
  | "GIT_AUTO_COMMIT"
  | "WATCH_ENABLED"
  | "PUSH_INTERVAL"
  | "COMMIT_INTERVAL";

export interface SettingsSnapshot {
  values: Record<EnvKey, string>;
  sources: Record<EnvKey, "notes" | "home" | "process" | "default">;
  files: { notes: string; home: string; writeTarget: string };
  example: string;
}
