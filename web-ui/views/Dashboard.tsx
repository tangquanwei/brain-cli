import { useEffect, useState } from "react";
import { api } from "../api";
import { navigate } from "../App";
import type { DashboardData } from "../types";

const AREA_NAMES: Record<string, string> = {
  projects: "📁 Projects",
  areas: "🎯 Areas",
  resources: "📚 Resources",
  archives: "📦 Archives",
};

function Pill({ kind, children }: { kind: string; children: React.ReactNode }) {
  return <span className={`pill ${kind}`}>{children}</span>;
}

export function Dashboard({ dataVersion }: { dataVersion: number }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.dashboard().then(setData, (e) => setError((e as Error).message));
  }, [dataVersion]);

  if (error)
    return (
      <>
        <h1 className="page-title">仪表盘</h1>
        <p className="muted">加载失败:{error}</p>
      </>
    );
  if (!data)
    return (
      <>
        <h1 className="page-title">仪表盘</h1>
        <p className="muted">加载中…</p>
      </>
    );

  const cards: [number, string][] = [
    [data.total, "笔记总数"],
    ...data.areas.map((a): [number, string] => [
      a.count,
      AREA_NAMES[a.area] ?? a.area,
    ]),
  ];

  return (
    <>
      <h1 className="page-title">仪表盘</h1>
      <div className="cards">
        {cards.map(([n, label]) => (
          <div className="card" key={label}>
            <div className="num">{n}</div>
            <div className="lbl">{label}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>链接健康</h3>
        <div className="btn-row">
          {data.links.broken > 0 ? (
            <Pill kind="bad">{data.links.broken} 断链</Pill>
          ) : (
            <Pill kind="ok">无断链</Pill>
          )}
          <Pill kind={data.links.missingHeading ? "warn" : "ok"}>
            {data.links.missingHeading} 缺失标题/块
          </Pill>
          <Pill kind={data.links.missingAssets ? "warn" : "ok"}>
            {data.links.missingAssets} 缺失附件
          </Pill>
          <Pill kind={data.links.nonStandard ? "warn" : "ok"}>
            {data.links.nonStandard} 歧义 WikiLink
          </Pill>
          <Pill kind="">{data.links.orphans} 孤岛</Pill>
          <Pill kind="">
            活跃孤岛 {data.links.activeOrphans}/{data.links.activeNotes}
          </Pill>
        </div>
      </div>

      <div className="panel">
        <h3>Git 备份</h3>
        {!data.git.notesRepo ? (
          <Pill kind="bad">notes 不是 Git 仓库</Pill>
        ) : data.git.pendingFiles ? (
          <>
            <Pill kind="warn">{data.git.pendingFiles} 个文件待备份</Pill>{" "}
            <span className="muted">运行 brain backup 提交</span>
          </>
        ) : (
          <Pill kind="ok">notes 工作区干净</Pill>
        )}
      </div>

      <div className="panel">
        <h3>最近笔记</h3>
        <div className="note-cards">
          {data.recent.map((n) => (
            <div
              className="note-card"
              key={n.id}
              onClick={() => navigate("notes", n.id)}
            >
              <div className="t">{n.title}</div>
              <div className="d">
                {n.date} · {n.id}
              </div>
              <div className="d">{n.summary}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
