import cytoscape from "cytoscape";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { navigate } from "../App";
import { useToast } from "../components/Toast";
import {
  filterGraphView,
  localGraphIds,
} from "../../src/graph/filters";
import type { GraphViewData, GraphViewNode } from "../types";

const COLORS: Record<string, string> = {
  projects: "#3b82f6",
  areas: "#22c55e",
  resources: "#a855f7",
  questions: "#f59e0b",
  archives: "#64748b",
  root: "#06b6d4",
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
  const [status, setStatus] = useState("加载中…");
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

  const openNote = (id: string) =>
    api
      .open(id)
      .then(() => toast("已在 VS Code 打开"))
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
          style: { "border-width": 4, "border-color": theme.current, "z-index": 20 },
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
      cy
        .layout({
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
        })
        .run();
    }
    cyRef.current = cy;
    setStatus(`${filtered.nodes.length} 节点 · ${filtered.edges.length} 边`);
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
  }, [filtered]);

  const relayout = () => {
    const cy = cyRef.current;
    if (!cy || !cy.nodes().length) return;
    cy
      .layout({
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
      })
      .run();
  };

  return (
    <>
      <h1 className="page-title">知识图谱</h1>
      <div className="toolbar panel">
        <input
          placeholder="搜索标题、路径、标签"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
        />
        <>
            <select
              value={filters.area}
              onChange={(e) => set("area", e.target.value)}
            >
              <option value="all">全部区域</option>
              <option value="projects">Projects</option>
              <option value="areas">Areas</option>
              <option value="resources">Resources</option>
              <option value="questions">Questions</option>
              <option value="archives">Archives</option>
              <option value="root">Root</option>
            </select>
            <input
              placeholder="标签过滤"
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
              文件夹
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={filters.archives}
                onChange={(e) => set("archives", e.target.checked)}
              />
              归档
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={filters.indexes}
                onChange={(e) => set("indexes", e.target.checked)}
              />
              索引关系
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={filters.isolated}
                onChange={(e) => set("isolated", e.target.checked)}
              />
              孤岛
            </label>
            <button
              className={`btn${filters.mode === "global" ? " primary" : ""}`}
              onClick={() => set("mode", "global")}
            >
              全局
            </button>
            <button
              className={`btn${filters.mode === "local" ? " primary" : ""}`}
              onClick={() => {
                if (!selectedId) return toast("请先选择一个节点");
                set("mode", "local");
              }}
            >
              局部
            </button>
            <select
              value={filters.depth}
              onChange={(e) => set("depth", Number(e.target.value) as 1 | 2)}
            >
              <option value={1}>1 跳</option>
              <option value={2}>2 跳</option>
            </select>
            <button className="btn" onClick={relayout}>
              重排
            </button>
            <button
              className="btn"
              onClick={() => cyRef.current?.fit(undefined, 35)}
            >
              适应
            </button>
        </>
        <span className="status">{status}</span>
      </div>
      <div className="graph-body">
        <div className="graph-wrap panel">
          <div ref={containerRef} className="cy-container" />
          {filtered && filtered.nodes.length === 0 && (
            <div id="empty" style={{ display: "block" }}>
              当前过滤条件下没有节点
            </div>
          )}
        </div>
        <aside className="side panel">
          {selectedNode ? (
            <>
              <h2>{selectedNode.title}</h2>
              <div className="path">{selectedNode.id}</div>
              <div className="metric">
                <span>区域</span>
                <b>{selectedNode.area}</b>
                {selectedNode.isFolder ? (
                  <>
                    <span>包含</span>
                    <b>{selectedNode.folderDegree}</b>
                  </>
                ) : (
                  <>
                    <span>入链</span>
                    <b>{selectedNode.inDegree}</b>
                    <span>出链</span>
                    <b>{selectedNode.outDegree}</b>
                    <span>语义连接</span>
                    <b>{selectedNode.semanticDegree}</b>
                    <span>索引连接</span>
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
                  <span className="path">无标签</span>
                )}
              </div>
              <div className="hint">
                {selectedNode.isFolder
                  ? "文件夹节点：单击高亮包含关系。"
                  : "单击高亮入链与出链；双击在 VS Code 打开。"}
                {!selectedNode.isFolder && (
                  <button
                    className="btn"
                    style={{ marginTop: 10 }}
                    onClick={() => navigate("notes", selectedNode.id)}
                  >
                    在阅读器中打开 →
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <h2>选择一个节点</h2>
              <div className="path">单击查看关系，双击在 VS Code 打开。</div>
              <div className="hint">
                默认显示文件夹层级（虚线框节点），隐藏 archives、索引关系和语义孤岛。索引边使用虚线，不能代替真实知识联系。
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
