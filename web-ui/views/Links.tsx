import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import { navigate } from "../App";
import { useI18n } from "../i18n";
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
  const { t } = useI18n();
  return (
    <div className="panel">
      <h3>
        {title} <span className={`pill ${pillKind}`}>{count}</span>
      </h3>
      {rows.length === 0 ? (
        <span className="muted">{t("common.none")}</span>
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
  const { t } = useI18n();
  const [data, setData] = useState<LinksData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.links().then(setData, (e) => setError((e as Error).message));
  }, [dataVersion]);

  let body: ReactNode;
  if (error) body = <p className="muted">{error}</p>;
  else if (!data) body = <p className="muted">{t("links.analyzing")}</p>;
  else
    body = (
      <>
        <div className="cards">
          <div className="card">
            <div className="num">{data.nodes}</div>
            <div className="lbl">{t("links.notes")}</div>
          </div>
          <div className="card">
            <div className="num">{data.edges}</div>
            <div className="lbl">{t("links.internal")}</div>
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
            <div className="lbl">{t("links.broken")}</div>
          </div>
          <div className="card">
            <div className="num">{data.missingHeadingLinks.length}</div>
            <div className="lbl">{t("links.missingHeadingShort")}</div>
          </div>
          <div className="card">
            <div className="num">{data.orphanNotes.length}</div>
            <div className="lbl">{t("links.orphanNotes")}</div>
          </div>
        </div>
        <Section
          title={t("links.broken")}
          count={data.brokenLinks.length}
          pillKind={data.brokenLinks.length ? "bad" : "ok"}
          rows={data.brokenLinks.map((e) => [
            e.fromRel,
            `→ ${e.href}${e.suffix}`,
          ])}
        />
        <Section
          title={t("links.missingHeading")}
          count={data.missingHeadingLinks.length}
          pillKind={data.missingHeadingLinks.length ? "warn" : "ok"}
          rows={data.missingHeadingLinks.map((e) => [
            e.fromRel,
            `→ ${e.href}${e.suffix}`,
          ])}
        />
        <Section
          title={t("links.missingAssets")}
          count={data.missingAssets.length}
          pillKind={data.missingAssets.length ? "warn" : "ok"}
          rows={data.missingAssets.map((asset) => [
            asset.file,
            `→ ${asset.target}`,
          ])}
        />
        <Section
          title={t("links.ambiguousWiki")}
          count={data.nonStandardLinks.length}
          pillKind={data.nonStandardLinks.length ? "warn" : "ok"}
          rows={data.nonStandardLinks.map((l) => [l.file, l.raw])}
        />
        <Section
          title={t("links.orphanNotes")}
          count={data.orphanNotes.length}
          pillKind=""
          rows={data.orphanNotes.map((p) => [p, ""])}
        />
      </>
    );

  return (
    <>
      <h1 className="page-title">{t("nav.links")}</h1>
      {body}
    </>
  );
}
