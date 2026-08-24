import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import { navigate } from "../App";
import type { LinksData } from "../types";

function Section({
  title,
  count,
  pillKind,
  rows,
}: {
  title: string;
  count: number;
  pillKind: string;
  rows: [string, string][];
}) {
  return (
    <div className="panel">
      <h3>
        {title} <span className={`pill ${pillKind}`}>{count}</span>
      </h3>
      {rows.length === 0 ? (
        <span className="muted">无</span>
      ) : (
        <table className="link-table">
          <tbody>
            {rows.map(([from, to], i) => (
              <tr key={i}>
                <td
                  className="clickable"
                  onClick={() => navigate("notes", from)}
                >
                  {from}
                </td>
                <td className="muted">{to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function Links({ dataVersion }: { dataVersion: number }) {
  const [data, setData] = useState<LinksData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.links().then(setData, (e) => setError((e as Error).message));
  }, [dataVersion]);

  let body: ReactNode;
  if (error) body = <p className="muted">{error}</p>;
  else if (!data) body = <p className="muted">分析中…</p>;
  else
    body = (
      <>
        <div className="cards">
          <div className="card">
            <div className="num">{data.nodes}</div>
            <div className="lbl">笔记</div>
          </div>
          <div className="card">
            <div className="num">{data.edges}</div>
            <div className="lbl">内部链接</div>
          </div>
          <div className="card">
            <div
              className="num"
              style={{
                color: data.brokenLinks.length ? "var(--danger)" : "var(--ok)",
              }}
            >
              {data.brokenLinks.length}
            </div>
            <div className="lbl">断链</div>
          </div>
          <div className="card">
            <div className="num">{data.missingHeadingLinks.length}</div>
            <div className="lbl">缺失标题/块</div>
          </div>
          <div className="card">
            <div className="num">{data.orphanNotes.length}</div>
            <div className="lbl">孤岛笔记</div>
          </div>
        </div>
        <Section
          title="断链"
          count={data.brokenLinks.length}
          pillKind={data.brokenLinks.length ? "bad" : "ok"}
          rows={data.brokenLinks.map((e) => [
            e.fromRel,
            `→ ${e.href}${e.suffix}`,
          ])}
        />
        <Section
          title="缺失标题或块引用"
          count={data.missingHeadingLinks.length}
          pillKind={data.missingHeadingLinks.length ? "warn" : "ok"}
          rows={data.missingHeadingLinks.map((e) => [
            e.fromRel,
            `→ ${e.href}${e.suffix}`,
          ])}
        />
        <Section
          title="缺失图片或附件"
          count={data.missingAssets.length}
          pillKind={data.missingAssets.length ? "warn" : "ok"}
          rows={data.missingAssets.map((asset) => [
            asset.file,
            `→ ${asset.target}`,
          ])}
        />
        <Section
          title="歧义 WikiLink"
          count={data.nonStandardLinks.length}
          pillKind={data.nonStandardLinks.length ? "warn" : "ok"}
          rows={data.nonStandardLinks.map((l) => [l.file, l.raw])}
        />
        <Section
          title="孤岛笔记"
          count={data.orphanNotes.length}
          pillKind=""
          rows={data.orphanNotes.map((p) => [p, ""])}
        />
      </>
    );

  return (
    <>
      <h1 className="page-title">链接健康</h1>
      {body}
    </>
  );
}
