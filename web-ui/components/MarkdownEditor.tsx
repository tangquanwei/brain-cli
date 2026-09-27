import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type Vditor from "vditor";
import { useI18n } from "../i18n";
import { withToken } from "../api";

export interface MarkdownEditorHandle {
  getValue: () => string;
}

const scripts = new Map<string, Promise<void>>();
function loadEditorScript(path: string, id: string): Promise<void> {
  if (document.getElementById(id)) return Promise.resolve();
  const existing = scripts.get(id);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      script.remove();
      scripts.delete(id);
      reject(new Error("Editor resource timeout"));
    }, 15000);
    script.src = path;
    script.onload = () => {
      clearTimeout(timer);
      script.id = id;
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      scripts.delete(id);
      reject(new Error("Editor resource unavailable"));
    };
    document.head.appendChild(script);
  });
  scripts.set(id, promise);
  return promise;
}

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  {
    initialValue: string;
    noteId: string;
    onChange: (value: string) => void;
    onSave: () => void;
  }
>(({ initialValue, noteId, onChange, onSave }, ref) => {
  const { language, t } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<Vditor | null>(null);
  const initial = useRef(initialValue);
  const changed = useRef(false);
  const callbacks = useRef({ onChange, onSave });
  callbacks.current = { onChange, onSave };
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const fallbackValue = useRef(initialValue);

  useImperativeHandle(
    ref,
    () => ({
      getValue: () =>
        instance.current && changed.current
          ? instance.current.getValue()
          : fallbackValue.current,
    }),
    [],
  );

  useEffect(() => {
    let disposed = false;
    const element = host.current!;
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const assetUrl = withToken("/api/note-asset");
    const folder = noteId
      .split("/")
      .slice(0, -1)
      .map(encodeURIComponent)
      .join("/");
    const markChanged = () => {
      changed.current = true;
    };
    const save = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopPropagation();
        if (!event.isComposing) callbacks.current.onSave();
      }
    };
    const theme = () => {
      if (!instance.current?.vditor?.lute) return;
      instance.current.setTheme(
        dark.matches ? "dark" : "classic",
        dark.matches ? "dark" : "light",
        dark.matches ? "github-dark" : "github",
        "/assets/vditor/dist/css/content-theme",
      );
    };
    element.addEventListener("input", markChanged, true);
    element.addEventListener("keydown", save, true);
    dark.addEventListener("change", theme);
    const locale = language === "zh" ? "zh_CN" : "en_US";
    void Promise.all([
      import("vditor"),
      loadEditorScript(
        `/assets/vditor/dist/js/i18n/${locale}.js`,
        `vditorI18nScript${locale}`,
      ),
      loadEditorScript(
        "/assets/vditor/dist/js/lute/lute.min.js",
        "vditorLuteScript",
      ),
    ])
      .then(([{ default: Editor }]) => {
        if (disposed) return;
        const editor = new Editor(element, {
          value: initial.current,
          cdn: "/assets/vditor",
          lang: language === "zh" ? "zh_CN" : "en_US",
          mode: "ir",
          theme: dark.matches ? "dark" : "classic",
          minHeight: 320,
          cache: { enable: false },
          link: { isOpen: false },
          hint: { emojiPath: "/assets/vditor/dist/images/emoji" },
          toolbar: window.matchMedia("(max-width: 600px)").matches
            ? [
                "undo",
                "redo",
                "headings",
                "bold",
                "list",
                "check",
                {
                  name: "more",
                  toolbar: [
                    "italic",
                    "strike",
                    "ordered-list",
                    "quote",
                    "link",
                    "table",
                    "code",
                    "edit-mode",
                    "both",
                    "preview",
                  ],
                },
              ]
            : [
                "undo",
                "redo",
                "|",
                "headings",
                "bold",
                "italic",
                "strike",
                "|",
                "list",
                "ordered-list",
                "check",
                "quote",
                "|",
                "link",
                "table",
                "code",
                "|",
                "edit-mode",
                "both",
                "preview",
              ],
          toolbarConfig: { pin: false },
          preview: {
            delay: 150,
            theme: {
              current: dark.matches ? "dark" : "light",
              path: "/assets/vditor/dist/css/content-theme",
            },
            markdown: {
              autoSpace: false,
              fixTermTypo: false,
              sanitize: true,
              linkBase: `${assetUrl}${assetUrl.includes("?") ? "&" : "?"}path=${folder ? `${folder}/` : "./"}`,
            },
            hljs: { style: dark.matches ? "github-dark" : "github" },
          },
          input(value) {
            if (disposed) return;
            changed.current = true;
            fallbackValue.current = value;
            callbacks.current.onChange(value);
          },
          after() {
            if (disposed) {
              editor.destroy();
              return;
            }
            instance.current = editor;
            setReady(true);
            editor.focus();
          },
        });
        instance.current = editor;
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      dark.removeEventListener("change", theme);
      element.removeEventListener("input", markChanged, true);
      element.removeEventListener("keydown", save, true);
      if (instance.current?.vditor?.wysiwyg) instance.current.destroy();
      instance.current = null;
    };
    // One editor per editing session; saving must never reset its selection/history.
  }, []);

  if (failed)
    return (
      <>
        <p role="status">{t("notes.editorFallback")}</p>
        <textarea
          className="note-editor"
          autoFocus
          defaultValue={fallbackValue.current}
          aria-label={t("capture.content")}
          onChange={(event) => {
            fallbackValue.current = event.target.value;
            callbacks.current.onChange(event.target.value);
          }}
        />
      </>
    );
  return (
    <div className="markdown-editor">
      {!ready && <p role="status">{t("common.loading")}</p>}
      <div ref={host} aria-label={t("capture.content")} />
    </div>
  );
});
