import cytoscape from "cytoscape";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { navigate } from "../App";
import { useToast } from "../components/Toast";
import { useI18n, type TranslationKey } from "../i18n";
import { filterGraphView, localGraphIds } from "../../src/graph/filters";
import type { GraphViewData, GraphViewNode } from "../types";

const COLORS: Record<string, string> = {
  projects: "#3b82f6",
  areas: "#22c55e",
  resources: "#a855f7",
  questions: "#f59e0b",
  archives: "#64748b",
  root: "#06b6d4",
};

const AREA_LABELS: Record<string, TranslationKey> = {
  projects: "area.projects",
  areas: "area.areas",
  resources: "area.resources",
  questions: "area.questions",
  archives: "area.archives",
  root: "area.root",
};

function ink() {
  const dark =
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  return {
    label: dark ? "#e5e7eb" : "#1d1d1f",
    outline: dark ? "#000000" : "#f5f5f7",
    edge: dark ? "#475569" : "#c7c7cc",
    indexEdge: dark ? "#64748b" : "#aeaeb2",
    current: dark ? "#f8fafc" : "#007aff",
    outgoing: dark ? "#38bdf8" : "#007aff",
  };
}

interface Filters {
  search: string;
  area: string;
  tag: string;
  archives: boolean;
  indexes: boolean;
  isolated: boolean;
  folders: boolean;
  mode: "global" | "local";
  depth: 1 | 2;
}

function applyFilters(
  data: GraphViewData,
  f: Filters,
  selectedId: string | null,
): { nodes: GraphViewData["nodes"]; edges: GraphViewData["edges"] } {
  const base = filterGraphView(data, {
    scope: f.archives ? "all" : "active",
    includeIndex: f.indexes,
    includeIsolated: f.isolated,
    includeFolders: f.folders,
  });
  const search = f.search.trim().toLowerCase();
  const tag = f.tag.trim().toLowerCase();
  let nodes = base.nodes.filter((n) => {
    if (f.area !== "all" && n.area !== f.area) return false;
    if (tag && !n.tags.some((t) => t.toLowerCase().includes(tag))) return false;
    if (
      search &&
      !`${n.title} ${n.id} ${n.tags.join(" ")}`.toLowerCase().includes(search)
    )
      return false;
    return true;
  });
  let edges = base.edges;
  if (f.mode === "local" && selectedId) {
    const ids = localGraphIds(
      { ...base, nodes, edges },
      selectedId,
      f.depth,
      f.indexes,
      f.folders,
    );
    nodes = nodes.filter((n) => ids.has(n.id));
    edges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  } else {
    const ids = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }
  return { nodes, edges };
}

export function GraphView({
  noteId,
  dataVersion,
}: {
  noteId: string | null;
  dataVersion: number;
}) {
  const toast = useToast();
  const { language, t } = useI18n();
  const [data, setData] = useState<GraphViewData | null>(null);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    area: "all",
    tag: "",
    archives: false,
    indexes: false,
    isolated: false,
    folders: true,
    mode: noteId ? "local" : "global",
    depth: 1,
  });
  const [selectedId, setSelectedId] = useState<string | null>(noteId);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const lastTapRef = useRef<{ id: string | null; time: number }>({
    id: null,
    time: 0,
  });

  useEffect(() => {
    api.graph().then(setData, (e) => toast((e as Error).message));
  }, [toast, dataVersion]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const filtered = useMemo(
    () => (data ? applyFilters(data, filters, selectedId) : null),
    [data, filters, selectedId],
  );

  const selectedNode = useMemo(
    () =>
      selectedId && data
        ? (data.nodes.find((n) => n.id === selectedId) ?? null)
        : null,
    [data, selectedId],
  );

  const status = filtered
    ? t("graph.status", {
        nodes: filtered.nodes.length,
        edges: filtered.edges.length,
      })
    : t("common.loading");
  const selectedAreaLabel = selectedNode
    ? (() => {
        const areaKey = AREA_LABELS[selectedNode.area];
        return areaKey ? t(areaKey) : selectedNode.area;
      })()
    : "";

  const openNote = (id: string) =>
    api
      .open(id)
      .then(() => toast(t("common.openedInVSCode")))
      .catch((e) => toast((e as Error).message));

  const selectNode = (id: string | null) => {
    setSelectedId(id);
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("current incoming outgoing muted");
    if (!id) return;
    const node = cy.getElementById(id);
    if (!node.length) return;
    cy.elements().addClass("muted");
    node.removeClass("muted").addClass("current");
    node.incomers("edge").removeClass("muted").addClass("incoming");
    node.incomers("node").removeClass("muted").addClass("incoming");
    node.outgoers("edge").removeClass("muted").addClass("outgoing");
    node.outgoers("node").removeClass("muted").addClass("outgoing");
  };

  // 构建 / 重建 cytoscape
  useEffect(() => {
    if (!filtered || !containerRef.current) return;
    const theme = ink();
    cyRef.current?.destroy();
    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...filtered.nodes.map((n) => ({
          data: {
            ...n,
            color: COLORS[n.area],
            size:
              18 +
              Math.log1p(
                n.semanticDegree +
                  (filters.indexes ? n.indexDegree : 0) +
                  (filters.folders ? n.folderDegree : 0),
              ) *
                7,
          },
        })),
        ...filtered.edges.map((e) => ({ data: e })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            width: "data(size)",
            height: "data(size)",
            label: "data(title)",
            color: theme.label,
            "font-size": 8,
            "text-valign": "bottom",
            "text-margin-y": 5,
            "text-outline-width": 2,
            "text-outline-color": theme.outline,
          },
        },
        {
          selector: "edge",
          style: {
            width: "mapData(count,1,5,1,3)",
            "line-color": theme.edge,
            "target-arrow-color": theme.edge,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.55,
          },
        },
        {
          selector: "node[isFolder]",
          style: {
            shape: "round-rectangle",
            "background-opacity": 0.22,
            "border-width": 1.5,
            "border-color": "data(color)",
            "border-style": "dashed",
          },
        },
        {
          selector: 'edge[kind="index"]',
          style: {
            "line-style": "dashed",
            "line-color": theme.indexEdge,
            "target-arrow-color": theme.indexEdge,
          },
        },
        {
          selector: 'edge[kind="folder"]',
          style: {
            "line-style": "dotted",
            "line-color": theme.indexEdge,
            "target-arrow-color": theme.indexEdge,
            opacity: 0.35,
          },
        },
        { selector: ".muted", style: { opacity: 0.1 } },
        {
          selector: "node.current",
          style: {
            "border-width": 4,
            "border-color": theme.current,
            "z-index": 20,
          },
        },
        {
          selector: ".incoming",
          style: {
            opacity: 1,
            "line-color": "#f59e0b",
            "target-arrow-color": "#f59e0b",
            "border-width": 2,
            "border-color": "#f59e0b",
          },
        },
        {
          selector: ".outgoing",
          style: {
            opacity: 1,
            "line-color": theme.outgoing,
            "target-arrow-color": theme.outgoing,
            "border-width": 2,
            "border-color": theme.outgoing,
          },
        },
      ],
    });
    cy.on("tap", "node", (event) => {
      const node = event.target as cytoscape.NodeSingular;
      const now = Date.now();
      const last = lastTapRef.current;
      if (
        last.id === node.id() &&
        now - last.time < 350 &&
        !node.data("isFolder")
      )
        openNote(node.id());
      lastTapRef.current = { id: node.id(), time: now };
      selectNode(node.id());
    });
    cy.on("tap", (event) => {
      if (event.target === cy) {
        cy.elements().removeClass("current incoming outgoing muted");
        setSelectedId(null);
      }
    });
    if (cy.nodes().length) {
      cy.layout({
        name: "cose",
        animate: false,
        randomize: true,
        fit: true,
        padding: 35,
        nodeRepulsion: 7000,
        idealEdgeLength: 85,
        edgeElasticity: 100,
        gravity: 0.25,
        numIter: 700,
      }).run();
    }
    cyRef.current = cy;
    if (selectedId && cy.getElementById(selectedId).length) {
      // 保持选中高亮
      cy.elements().addClass("muted");
      const node = cy.getElementById(selectedId);
      node.removeClass("muted").addClass("current");
      node.incomers("edge").removeClass("muted").addClass("incoming");
      node.incomers("node").removeClass("muted").addClass("incoming");
      node.outgoers("edge").removeClass("muted").addClass("outgoing");
      node.outgoers("node").removeClass("muted").addClass("outgoing");
    }
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, language]);

  const relayout = () => {
    const cy = cyRef.current;
    if (!cy || !cy.nodes().length) return;
    cy.layout({
      name: "cose",
      animate: false,
      randomize: true,
      fit: true,
      padding: 35,
      nodeRepulsion: 7000,
      idealEdgeLength: 85,
      edgeElasticity: 100,
      gravity: 0.25,
      numIter: 700,
    }).run();
  };

  return (
    <>
      <h1 className="page-title">{t("nav.graph")}</h1>
      <div className="toolbar panel">
        <input
          placeholder={t("graph.searchPlaceholder")}
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
        />
        <>
          <select
            value={filters.area}
            onChange={(e) => set("area", e.target.value)}
          >
            <option value="all">{t("graph.allAreas")}</option>
            <option value="projects">{t("area.projects")}</option>
            <option value="areas">{t("area.areas")}</option>
            <option value="resources">{t("area.resources")}</option>
            <option value="questions">{t("area.questions")}</option>
            <option value="archives">{t("area.archives")}</option>
            <option value="root">{t("area.root")}</option>
          </select>
          <input
            placeholder={t("graph.tagPlaceholder")}
            style={{ width: 110 }}
            value={filters.tag}
            onChange={(e) => set("tag", e.target.value)}
          />
          <label className="toggle">
            <input
              type="checkbox"
              checked={filters.folders}
              onChange={(e) => set("folders", e.target.checked)}
            />
            {t("graph.folders")}
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={filters.archives}
              onChange={(e) => set("archives", e.target.checked)}
            />
            {t("graph.archives")}
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={filters.indexes}
              onChange={(e) => set("indexes", e.target.checked)}
            />
            {t("graph.indexes")}
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={filters.isolated}
              onChange={(e) => set("isolated", e.target.checked)}
            />
            {t("graph.isolated")}
          </label>
          <button
            className={`btn${filters.mode === "global" ? " primary" : ""}`}
            onClick={() => set("mode", "global")}
          >
            {t("graph.global")}
          </button>
          <button
            className={`btn${filters.mode === "local" ? " primary" : ""}`}
            onClick={() => {
              if (!selectedId) return toast(t("graph.selectFirst"));
              set("mode", "local");
            }}
          >
            {t("graph.local")}
          </button>
          <select
            value={filters.depth}
            onChange={(e) => set("depth", Number(e.target.value) as 1 | 2)}
          >
            <option value={1}>{t("graph.hop1")}</option>
            <option value={2}>{t("graph.hop2")}</option>
          </select>
          <button className="btn" onClick={relayout}>
            {t("graph.relayout")}
          </button>
          <button
            className="btn"
            onClick={() => cyRef.current?.fit(undefined, 35)}
          >
            {t("graph.fit")}
          </button>
        </>
        <span className="status">{status}</span>
      </div>
      <div className="graph-body">
        <div className="graph-wrap panel">
          <div ref={containerRef} className="cy-container" />
          {filtered && filtered.nodes.length === 0 && (
            <div id="empty" style={{ display: "block" }}>
              {t("graph.empty")}
            </div>
          )}
        </div>
        <aside className="side panel">
          {selectedNode ? (
            <>
              <h2>{selectedNode.title}</h2>
              <div className="path">{selectedNode.id}</div>
              <div className="metric">
                <span>{t("graph.area")}</span>
                <b>{selectedAreaLabel}</b>
                {selectedNode.isFolder ? (
                  <>
                    <span>{t("graph.contains")}</span>
                    <b>{selectedNode.folderDegree}</b>
                  </>
                ) : (
                  <>
                    <span>{t("graph.incoming")}</span>
                    <b>{selectedNode.inDegree}</b>
                    <span>{t("graph.outgoing")}</span>
                    <b>{selectedNode.outDegree}</b>
                    <span>{t("graph.semantic")}</span>
                    <b>{selectedNode.semanticDegree}</b>
                    <span>{t("graph.index")}</span>
                    <b>{selectedNode.indexDegree}</b>
                  </>
                )}
              </div>
              <div className="tags">
                {selectedNode.tags.length ? (
                  selectedNode.tags.map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="path">{t("graph.noTags")}</span>
                )}
              </div>
              <div className="hint">
                {selectedNode.isFolder
                  ? t("graph.folderHint")
                  : t("graph.noteHint")}
                {!selectedNode.isFolder && (
                  <button
                    className="btn"
                    style={{ marginTop: 10 }}
                    onClick={() => navigate("notes", selectedNode.id)}
                  >
                    {t("graph.openReader")}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <h2>{t("graph.selectNode")}</h2>
              <div className="path">{t("graph.selectHint")}</div>
              <div className="hint">{t("graph.defaultHint")}</div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
