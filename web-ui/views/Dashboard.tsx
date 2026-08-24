import { useEffect, useState } from "react";
import { api } from "../api";
import { navigate } from "../App";
import { useI18n, type TranslationKey } from "../i18n";
import type { DashboardData } from "../types";

const AREA_NAMES: Record<string, TranslationKey> = {
  projects: "area.projects",
  areas: "area.areas",
  resources: "area.resources",
  archives: "area.archives",
  questions: "area.questions",
  root: "area.root",
};

function Pill({ kind, children }: { kind: string; children: React.ReactNode }) {
  return <span className={`pill ${kind}`}>{children}</span>;
}

export function Dashboard({ dataVersion }: { dataVersion: number }) {
  const { t } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.dashboard().then(setData, (e) => setError((e as Error).message));
  }, [dataVersion]);

  if (error)
    return (
      <>
        <h1 className="page-title">{t("nav.dashboard")}</h1>
        <p className="muted">{t("common.loadFailed", { error })}</p>
      </>
    );
  if (!data)
    return (
      <>
        <h1 className="page-title">{t("nav.dashboard")}</h1>
        <p className="muted">{t("common.loading")}</p>
      </>
    );

  const cards: [number, string][] = [
    [data.total, t("dashboard.totalNotes")],
    ...data.areas.map((a): [number, string] => {
      const areaKey = AREA_NAMES[a.area];
      return [a.count, areaKey ? t(areaKey) : a.area];
    }),
  ];

  return (
    <>
      <h1 className="page-title">{t("nav.dashboard")}</h1>
      <div className="cards">
        {cards.map(([n, label]) => (
          <div className="card" key={label}>
            <div className="num">{n}</div>
            <div className="lbl">{label}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>{t("dashboard.linkHealth")}</h3>
        <div className="btn-row">
          {data.links.broken > 0 ? (
            <Pill kind="bad">
              {t("dashboard.broken", { count: data.links.broken })}
            </Pill>
          ) : (
            <Pill kind="ok">{t("dashboard.noBroken")}</Pill>
          )}
          <Pill kind={data.links.missingHeading ? "warn" : "ok"}>
            {t("dashboard.missingHeading", {
              count: data.links.missingHeading,
            })}
          </Pill>
          <Pill kind={data.links.missingAssets ? "warn" : "ok"}>
            {t("dashboard.missingAssets", {
              count: data.links.missingAssets,
            })}
          </Pill>
          <Pill kind={data.links.nonStandard ? "warn" : "ok"}>
            {t("dashboard.ambiguousWiki", {
              count: data.links.nonStandard,
            })}
          </Pill>
          <Pill kind="">
            {t("dashboard.orphans", { count: data.links.orphans })}
          </Pill>
          <Pill kind="">
            {t("dashboard.activeOrphans", {
              orphans: data.links.activeOrphans,
              notes: data.links.activeNotes,
            })}
          </Pill>
        </div>
      </div>

      <div className="panel">
        <h3>{t("dashboard.gitBackup")}</h3>
        {!data.git.notesRepo ? (
          <Pill kind="bad">{t("dashboard.notRepo")}</Pill>
        ) : data.git.pendingFiles ? (
          <>
            <Pill kind="warn">
              {t("dashboard.pendingFiles", {
                count: data.git.pendingFiles,
              })}
            </Pill>{" "}
            <span className="muted">{t("dashboard.runBackup")}</span>
          </>
        ) : (
          <Pill kind="ok">{t("dashboard.clean")}</Pill>
        )}
      </div>

      <div className="panel">
        <h3>{t("dashboard.recent")}</h3>
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
