import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "zh" | "en";

const zh = {
  "language.label": "界面语言",
  "language.zh": "中文",
  "language.en": "English",
  "common.loading": "加载中…",
  "common.loadFailed": "加载失败：{error}",
  "common.cancel": "取消",
  "common.none": "无",
  "common.openedInVSCode": "已在 VS Code 打开",
  "nav.dashboard": "仪表盘",
  "nav.notes": "笔记",
  "nav.review": "回顾",
  "nav.links": "链接健康",
  "nav.graph": "知识图谱",
  "nav.capture": "捕获想法",
  "capture.titleRequired": "标题不能为空",
  "capture.success": "✅ 已捕获",
  "capture.modalTitle": "💡 捕获想法",
  "capture.title": "标题",
  "capture.titlePlaceholder": "笔记标题",
  "capture.type": "类型",
  "capture.typeFleeting": "闪念",
  "capture.typeLiterature": "文献笔记",
  "capture.typePermanent": "永久笔记",
  "capture.typeProject": "项目笔记",
  "capture.tags": "标签（逗号分隔）",
  "capture.content": "正文",
  "capture.contentPlaceholder": "想法内容…",
  "capture.submit": "捕获",
  "dashboard.totalNotes": "笔记总数",
  "area.projects": "📁 项目",
  "area.areas": "🎯 领域",
  "area.resources": "📚 资源",
  "area.archives": "📦 归档",
  "area.questions": "❓ 问题",
  "area.root": "根目录",
  "dashboard.linkHealth": "链接健康",
  "dashboard.broken": "{count} 处断链",
  "dashboard.noBroken": "无断链",
  "dashboard.missingHeading": "{count} 处缺失标题/块",
  "dashboard.missingAssets": "{count} 个缺失附件",
  "dashboard.ambiguousWiki": "{count} 个歧义 WikiLink",
  "dashboard.orphans": "{count} 篇孤岛笔记",
  "dashboard.activeOrphans": "活跃孤岛 {orphans}/{notes}",
  "dashboard.gitBackup": "Git 备份",
  "dashboard.notRepo": "notes 不是 Git 仓库",
  "dashboard.pendingFiles": "{count} 个文件待备份",
  "dashboard.runBackup": "运行 brain backup 提交",
  "dashboard.clean": "notes 工作区干净",
  "dashboard.recent": "最近笔记",
  "notes.nameRequired": "名称不能为空",
  "notes.renameSuccess": "✅ 已重命名，更新 {count} 处链接",
  "notes.renameTitle": "✏️ 重命名笔记",
  "notes.renameHint": "会自动同步图片目录和所有引用链接。",
  "notes.rename": "重命名",
  "notes.pathRequired": "路径不能为空",
  "notes.moveSuccess": "✅ 已移动，更新 {count} 处链接",
  "notes.moveTitle": "🚚 移动笔记",
  "notes.currentPath": "当前位置",
  "notes.newPath": "新路径（相对 notes 根目录）",
  "notes.moveHint": "会自动重写相对链接，例如 areas/x/note.md。",
  "notes.move": "移动",
  "notes.backlinks": "反向链接（{count}）",
  "notes.searchPlaceholder": "搜索标题、路径、标签…",
  "notes.noMatches": "没有匹配的笔记",
  "notes.selectPrompt": "← 选择一篇笔记开始阅读",
  "notes.openHint": "双击树中条目可在 VS Code 打开",
  "review.week": "📅 本周",
  "review.month": "🗓 本月",
  "review.random": "🎲 随机 5 篇",
  "review.tags": "🏷️ 按标签",
  "review.tagsPrompt": "输入标签（逗号分隔）",
  "review.total": "共 {count} 篇",
  "review.empty": "没有符合条件的笔记 📝",
  "links.analyzing": "分析中…",
  "links.notes": "笔记",
  "links.internal": "内部链接",
  "links.broken": "断链",
  "links.missingHeadingShort": "缺失标题/块",
  "links.orphanNotes": "孤岛笔记",
  "links.missingHeading": "缺失标题或块引用",
  "links.missingAssets": "缺失图片或附件",
  "links.ambiguousWiki": "歧义 WikiLink",
  "graph.searchPlaceholder": "搜索标题、路径、标签",
  "graph.allAreas": "全部区域",
  "graph.tagPlaceholder": "标签过滤",
  "graph.folders": "文件夹",
  "graph.archives": "归档",
  "graph.indexes": "索引关系",
  "graph.isolated": "孤岛",
  "graph.global": "全局",
  "graph.local": "局部",
  "graph.selectFirst": "请先选择一个节点",
  "graph.hop1": "1 跳",
  "graph.hop2": "2 跳",
  "graph.relayout": "重排",
  "graph.fit": "适应",
  "graph.status": "{nodes} 个节点 · {edges} 条边",
  "graph.empty": "当前过滤条件下没有节点",
  "graph.area": "区域",
  "graph.contains": "包含",
  "graph.incoming": "入链",
  "graph.outgoing": "出链",
  "graph.semantic": "语义连接",
  "graph.index": "索引连接",
  "graph.noTags": "无标签",
  "graph.folderHint": "文件夹节点：单击高亮包含关系。",
  "graph.noteHint": "单击高亮入链与出链；双击在 VS Code 打开。",
  "graph.openReader": "在阅读器中打开 →",
  "graph.selectNode": "选择一个节点",
  "graph.selectHint": "单击查看关系，双击在 VS Code 打开。",
  "graph.defaultHint":
    "默认显示文件夹层级（虚线框节点），隐藏 archives、索引关系和语义孤岛。索引边使用虚线，不能代替真实知识联系。",
} as const;

export type TranslationKey = keyof typeof zh;

const en = {
  "language.label": "Interface language",
  "language.zh": "中文",
  "language.en": "English",
  "common.loading": "Loading…",
  "common.loadFailed": "Could not load: {error}",
  "common.cancel": "Cancel",
  "common.none": "None",
  "common.openedInVSCode": "Opened in VS Code",
  "nav.dashboard": "Dashboard",
  "nav.notes": "Notes",
  "nav.review": "Review",
  "nav.links": "Link health",
  "nav.graph": "Knowledge graph",
  "nav.capture": "Capture idea",
  "capture.titleRequired": "A title is required",
  "capture.success": "✅ Captured",
  "capture.modalTitle": "💡 Capture an idea",
  "capture.title": "Title",
  "capture.titlePlaceholder": "Note title",
  "capture.type": "Type",
  "capture.typeFleeting": "Fleeting",
  "capture.typeLiterature": "Literature",
  "capture.typePermanent": "Permanent",
  "capture.typeProject": "Project",
  "capture.tags": "Tags (comma-separated)",
  "capture.content": "Content",
  "capture.contentPlaceholder": "Write down the idea…",
  "capture.submit": "Capture",
  "dashboard.totalNotes": "Total notes",
  "area.projects": "📁 Projects",
  "area.areas": "🎯 Areas",
  "area.resources": "📚 Resources",
  "area.archives": "📦 Archives",
  "area.questions": "❓ Questions",
  "area.root": "Root",
  "dashboard.linkHealth": "Link health",
  "dashboard.broken": "{count} broken links",
  "dashboard.noBroken": "No broken links",
  "dashboard.missingHeading": "{count} missing headings/blocks",
  "dashboard.missingAssets": "{count} missing assets",
  "dashboard.ambiguousWiki": "{count} ambiguous WikiLinks",
  "dashboard.orphans": "{count} orphan notes",
  "dashboard.activeOrphans": "Active orphans {orphans}/{notes}",
  "dashboard.gitBackup": "Git backup",
  "dashboard.notRepo": "notes is not a Git repository",
  "dashboard.pendingFiles": "{count} files waiting for backup",
  "dashboard.runBackup": "Run brain backup to commit",
  "dashboard.clean": "notes working tree is clean",
  "dashboard.recent": "Recent notes",
  "notes.nameRequired": "A name is required",
  "notes.renameSuccess": "✅ Renamed and updated {count} links",
  "notes.renameTitle": "✏️ Rename note",
  "notes.renameHint":
    "The matching image folder and all references will be updated.",
  "notes.rename": "Rename",
  "notes.pathRequired": "A path is required",
  "notes.moveSuccess": "✅ Moved and updated {count} links",
  "notes.moveTitle": "🚚 Move note",
  "notes.currentPath": "Current location",
  "notes.newPath": "New path (relative to the notes root)",
  "notes.moveHint":
    "Relative links will be rewritten, for example areas/x/note.md.",
  "notes.move": "Move",
  "notes.backlinks": "Backlinks ({count})",
  "notes.searchPlaceholder": "Search titles, paths, and tags…",
  "notes.noMatches": "No matching notes",
  "notes.selectPrompt": "← Select a note to start reading",
  "notes.openHint": "Double-click a tree item to open it in VS Code",
  "review.week": "📅 This week",
  "review.month": "🗓 This month",
  "review.random": "🎲 5 random notes",
  "review.tags": "🏷️ By tag",
  "review.tagsPrompt": "Enter tags (comma-separated)",
  "review.total": "{count} notes",
  "review.empty": "No notes match this review 📝",
  "links.analyzing": "Analyzing…",
  "links.notes": "Notes",
  "links.internal": "Internal links",
  "links.broken": "Broken links",
  "links.missingHeadingShort": "Missing headings/blocks",
  "links.orphanNotes": "Orphan notes",
  "links.missingHeading": "Missing headings or block references",
  "links.missingAssets": "Missing images or assets",
  "links.ambiguousWiki": "Ambiguous WikiLinks",
  "graph.searchPlaceholder": "Search titles, paths, and tags",
  "graph.allAreas": "All areas",
  "graph.tagPlaceholder": "Filter by tag",
  "graph.folders": "Folders",
  "graph.archives": "Archives",
  "graph.indexes": "Index links",
  "graph.isolated": "Isolated",
  "graph.global": "Global",
  "graph.local": "Local",
  "graph.selectFirst": "Select a node first",
  "graph.hop1": "1 hop",
  "graph.hop2": "2 hops",
  "graph.relayout": "Relayout",
  "graph.fit": "Fit",
  "graph.status": "{nodes} nodes · {edges} edges",
  "graph.empty": "No nodes match the current filters",
  "graph.area": "Area",
  "graph.contains": "Contains",
  "graph.incoming": "Incoming",
  "graph.outgoing": "Outgoing",
  "graph.semantic": "Semantic links",
  "graph.index": "Index links",
  "graph.noTags": "No tags",
  "graph.folderHint": "Folder node: click to highlight contained notes.",
  "graph.noteHint":
    "Click to highlight incoming and outgoing links; double-click to open in VS Code.",
  "graph.openReader": "Open in reader →",
  "graph.selectNode": "Select a node",
  "graph.selectHint":
    "Click to inspect relationships; double-click to open in VS Code.",
  "graph.defaultHint":
    "Folder hierarchy is shown by default. Archives, index links, and semantic orphans are hidden. Dashed index edges are navigational aids, not real knowledge relationships.",
} satisfies Record<TranslationKey, string>;

const dictionaries: Record<Language, Record<TranslationKey, string>> = {
  zh,
  en,
};

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem("brain-language");
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // Browser storage can be disabled; language still works for this session.
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    try {
      localStorage.setItem("brain-language", nextLanguage);
    } catch {
      // Keep the in-memory choice when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const t = useCallback(
    (key: TranslationKey, params: Record<string, string | number> = {}) =>
      dictionaries[language][key].replace(/\{(\w+)\}/g, (_, name: string) =>
        String(params[name] ?? `{${name}}`),
      ),
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within I18nProvider");
  return value;
}
