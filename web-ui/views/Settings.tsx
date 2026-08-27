import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n";
import type { EnvKey, SettingsSnapshot } from "../types";

function isEnabled(value: string): boolean {
  return ["true", "1", "yes"].includes(value.trim().toLowerCase());
}

export function Settings({ dataVersion }: { dataVersion: number }) {
  const { language, setLanguage, t } = useI18n();
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [values, setValues] = useState<Record<EnvKey, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.settings().then(
      (next) => {
        if (cancelled) return;
        setSnapshot(next);
        setValues(next.values);
        setLoading(false);
      },
      (error) => {
        if (cancelled) return;
        setLoading(false);
        toast((error as Error).message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [dataVersion, toast]);

  const update = (key: EnvKey, value: string) => {
    setValues((current) => (current ? { ...current, [key]: value } : current));
  };

  const save = async () => {
    if (!values) return;
    setSaving(true);
    try {
      const next = await api.saveSettings(values);
      setSnapshot(next);
      setValues(next.values);
      toast(t("settings.saved"));
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const sourceLabel = (key: EnvKey) => {
    const source = snapshot?.sources[key];
    return source === "notes"
      ? t("settings.sourceNotes")
      : source === "home"
        ? t("settings.sourceHome")
        : source === "process"
          ? t("settings.sourceProcess")
          : t("settings.sourceDefault");
  };

  return (
    <div className="settings-page">
      <div className="settings-page-head">
        <div>
          <div className="settings-kicker">{t("settings.kicker")}</div>
          <h1 className="page-title">{t("settings.title")}</h1>
        </div>
        <button
          className="btn primary"
          onClick={save}
          disabled={loading || saving || !values}
        >
          {saving ? t("settings.saving") : t("settings.save")}
        </button>
      </div>

      {loading || !values || !snapshot ? (
        <div className="panel settings-loading">{t("common.loading")}</div>
      ) : (
        <div className="settings-grid">
          <section className="panel settings-form">
            <div className="settings-section-head">
              <div>
                <h2>{t("settings.configuration")}</h2>
                <p>{t("settings.priority")}</p>
              </div>
              <span className="settings-live">{t("settings.live")}</span>
            </div>
            <label className="settings-field">
              <span>{t("settings.notesDir")}</span>
              <input
                value={values.NOTES_DIR}
                onChange={(event) => update("NOTES_DIR", event.target.value)}
              />
              <small>{sourceLabel("NOTES_DIR")}</small>
            </label>
            <div className="settings-field">
              <span>{t("language.label")}</span>
              <div
                className="language-control"
                role="group"
                aria-label={t("language.label")}
              >
                <button
                  type="button"
                  className={language === "zh" ? "active" : ""}
                  aria-pressed={language === "zh"}
                  onClick={() => setLanguage("zh")}
                >
                  中
                </button>
                <button
                  type="button"
                  className={language === "en" ? "active" : ""}
                  aria-pressed={language === "en"}
                  onClick={() => setLanguage("en")}
                >
                  EN
                </button>
              </div>
            </div>
            <label className="settings-field settings-check">
              <input
                type="checkbox"
                checked={isEnabled(values.GIT_AUTO_COMMIT)}
                onChange={(event) =>
                  update(
                    "GIT_AUTO_COMMIT",
                    event.target.checked ? "true" : "false",
                  )
                }
              />
              <span>{t("settings.gitAutoCommit")}</span>
              <small>{sourceLabel("GIT_AUTO_COMMIT")}</small>
            </label>
            <label className="settings-field settings-check">
              <input
                type="checkbox"
                checked={isEnabled(values.WATCH_ENABLED)}
                onChange={(event) =>
                  update(
                    "WATCH_ENABLED",
                    event.target.checked ? "true" : "false",
                  )
                }
              />
              <span>{t("settings.watchEnabled")}</span>
              <small>{sourceLabel("WATCH_ENABLED")}</small>
            </label>
            <div className="settings-number-grid">
              <label className="settings-field">
                <span>{t("settings.commitInterval")}</span>
                <input
                  type="number"
                  min="0"
                  value={values.COMMIT_INTERVAL}
                  onChange={(event) =>
                    update("COMMIT_INTERVAL", event.target.value)
                  }
                />
                <small>{sourceLabel("COMMIT_INTERVAL")}</small>
              </label>
              <label className="settings-field">
                <span>{t("settings.pushInterval")}</span>
                <input
                  type="number"
                  min="0"
                  value={values.PUSH_INTERVAL}
                  onChange={(event) =>
                    update("PUSH_INTERVAL", event.target.value)
                  }
                />
                <small>{sourceLabel("PUSH_INTERVAL")}</small>
              </label>
            </div>
            <div className="settings-paths">
              <div>
                <span>{t("settings.notesEnv")}</span>
                <code>{snapshot.files.notes}</code>
              </div>
              <div>
                <span>{t("settings.homeEnv")}</span>
                <code>{snapshot.files.home}</code>
              </div>
              <div>
                <span>{t("settings.writeTarget")}</span>
                <code>{snapshot.files.writeTarget}</code>
              </div>
            </div>
          </section>
          <section className="panel settings-example">
            <div className="settings-section-head">
              <div>
                <h2>.env.example</h2>
                <p>{t("settings.exampleHint")}</p>
              </div>
            </div>
            <pre>{snapshot.example}</pre>
          </section>
        </div>
      )}
    </div>
  );
}
