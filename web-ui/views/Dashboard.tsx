import { useEffect, useMemo, useState } from "react";
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

const DAY_MS = 86400000;
const WEEKDAYS: Record<"zh" | "en", string[]> = {
  zh: ["日", "一", "二", "三", "四", "五", "六"],
  en: ["S", "M", "T", "W", "T", "F", "S"],
};

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface HeatDay {
  date: string;
  count: number;
  future: boolean;
}

/** GitHub 风格笔记热力图：最近 13 个月，每日笔记/日记越多格子越深 */
function ActivityHeatmap({
  activity,
}: {
  activity: { date: string; count: number }[];
}) {
  const { t, language } = useI18n();
  const { weeks, months, rangeCount, max } = useMemo(() => {
    const counts = new Map(activity.map((a) => [a.date, a.count]));
    const end = new Date();
    // 起点：13 个月之前（一年零一个月），对齐到该周周日
    let start = new Date(end.getFullYear(), end.getMonth() - 12, 1);
    start = new Date(start.getTime() - start.getDay() * DAY_MS);

    const weeks: HeatDay[][] = [];
    const months: (string | null)[] = [];
    let lastMonth = -1;
    for (let w = start; w <= end; w = new Date(w.getTime() + 7 * DAY_MS)) {
      const week: HeatDay[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(w.getTime() + i * DAY_MS);
        const key = fmt(d);
        week.push({ date: key, count: counts.get(key) ?? 0, future: d > end });
      }
      weeks.push(week);
      const first = week.find((d) => !d.future && d.date.endsWith("-01"));
      const mNum = first
        ? Number(first.date.slice(5, 7))
        : Number(week[0]!.date.slice(5, 7));
      months.push(first || lastMonth === -1 ? `${mNum}` : null);
      lastMonth = mNum;
    }

    let rangeCount = 0;
    let max = 0;
    const startKey = fmt(start);
    const endKey = fmt(end);
    for (const a of activity) {
      if (a.date >= startKey && a.date <= endKey) rangeCount += a.count;
      if (a.count > max) max = a.count;
    }
    return { weeks, months, rangeCount, max };
  }, [activity]);

  const level = (n: number) =>
    n <= 0 ? 0 : Math.min(4, Math.ceil((n / Math.max(max, 1)) * 4));
  const monthLabel = (m: number) =>
    language === "zh"
      ? `${m}月`
      : [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ][m - 1];

  return (
    <div className="panel">
      <h3>
        {t("dashboard.heatmap")}
        <span className="muted heatmap-sub">
          {t("dashboard.heatmapRange", { count: rangeCount })}
        </span>
      </h3>
      <div className="heatmap">
        <div className="heatmap-days">
          {WEEKDAYS[language].map((d, i) => (
            <span key={`${d}-${i}`}>{i % 2 === 1 ? d : ""}</span>
          ))}
        </div>
        <div className="heatmap-body">
          <div className="heatmap-months">
            {months.map((m, i) =>
              m ? (
                <span key={i} style={{ left: i * 13 }}>
                  {monthLabel(Number(m))}
                </span>
              ) : null,
            )}
          </div>
          <div className="heatmap-grid">
            {weeks.map((week, i) => (
              <div className="heatmap-week" key={i}>
                {week.map((d) =>
                  d.future ? (
                    <span key={d.date} className="cell skip" />
                  ) : (
                    <span
                      key={d.date}
                      className={`cell lv${level(d.count)}`}
                      title={
                        d.count > 0
                          ? t("dashboard.heatmapAdded", {
                              date: d.date,
                              count: d.count,
                            })
                          : t("dashboard.heatmapEmpty", { date: d.date })
                      }
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="heatmap-legend">
        <span className="muted">{t("dashboard.heatmapLess")}</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`cell lv${i}`} />
        ))}
        <span className="muted">{t("dashboard.heatmapMore")}</span>
      </div>
    </div>
  );
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

      <ActivityHeatmap activity={data.activity ?? []} />

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
