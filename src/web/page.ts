export function renderWebPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>2ndBrain</title>
<style>
:root {
  --bg:#f5f5f7; --card:#ffffff; --sidebar:rgba(255,255,255,.72);
  --text:#1d1d1f; --secondary:#86868b; --accent:#007aff; --accent-text:#fff;
  --line:#d2d2d7; --line-soft:#e8e8ed; --hover:rgba(0,0,0,.045);
  --shadow:0 4px 24px rgba(0,0,0,.05); --danger:#ff3b30; --ok:#34c759; --warn:#ff9500;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:#000000; --card:#1c1c1e; --sidebar:rgba(28,28,30,.72);
    --text:#f5f5f7; --secondary:#98989d; --accent:#0a84ff;
    --line:#38383a; --line-soft:#2c2c2e; --hover:rgba(255,255,255,.07);
    --shadow:0 4px 24px rgba(0,0,0,.4);
    color-scheme: dark;
  }
}
* { box-sizing:border-box; }
html,body { margin:0; height:100%; }
body {
  background:var(--bg); color:var(--text);
  font:14px/1.6 -apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro SC","PingFang SC","Helvetica Neue",sans-serif;
  -webkit-font-smoothing:antialiased;
}
.app { display:grid; grid-template-columns:232px 1fr; height:100vh; }
.app.sidebar-collapsed { grid-template-columns:72px 1fr; }

/* ── 侧边栏 ── */
.sidebar {
  background:var(--sidebar); backdrop-filter:saturate(180%) blur(20px); -webkit-backdrop-filter:saturate(180%) blur(20px);
  border-right:1px solid var(--line-soft); padding:20px 12px; display:flex; flex-direction:column; gap:2px;
}
.brand-row { display:flex; align-items:center; gap:4px; min-width:0; }
.brand { flex:1; min-width:0; font-size:19px; font-weight:700; letter-spacing:-.02em; padding:4px 8px 18px 12px; }
.brand .brand-full > span { color:var(--accent); }
.brand-short { display:none; }
.sidebar-toggle { width:28px; height:28px; flex:none; border:1px solid var(--line-soft); border-radius:7px; background:transparent; color:var(--secondary); font:inherit; font-size:21px; line-height:1; cursor:pointer; }
.sidebar-toggle:hover { color:var(--accent); border-color:var(--accent); background:var(--hover); }
.nav-item {
  display:flex; align-items:center; gap:9px; padding:7px 12px; border-radius:9px;
  color:var(--text); cursor:pointer; border:0; background:transparent; width:100%;
  font:inherit; text-align:left; transition:background .15s;
}
.nav-item:hover { background:var(--hover); }
.nav-item.active { background:var(--accent); color:var(--accent-text); font-weight:600; }
.nav-item .icon { width:20px; text-align:center; }
.sidebar .spacer { flex:1; }
.language-control {
  display:grid; grid-template-columns:1fr 1fr; gap:2px; margin:4px 8px 8px; padding:3px;
  border:1px solid var(--line); border-radius:9px; background:var(--hover);
}
.language-control button {
  min-width:0; padding:3px 5px; border:0; border-radius:6px; background:transparent;
  color:var(--secondary); font:inherit; font-size:11px; font-weight:600; cursor:pointer;
}
.language-control button:hover { color:var(--text); }
.language-control button.active { background:var(--card); color:var(--accent); box-shadow:0 1px 4px rgba(0,0,0,.08); }
.capture-btn {
  margin:4px 8px 2px; padding:8px 0; border:0; border-radius:980px; background:var(--accent);
  color:var(--accent-text); font:inherit; font-weight:600; cursor:pointer;
}
.capture-btn:hover { filter:brightness(1.08); }

.app.sidebar-collapsed .brand-row { justify-content:center; }
.app.sidebar-collapsed .brand { flex:none; padding:4px 0 18px; text-align:center; font-size:17px; }
.app.sidebar-collapsed .brand-full { display:none; }
.app.sidebar-collapsed .brand-short { display:inline; color:var(--accent); }
.app.sidebar-collapsed .brand-short .brand-two { color:var(--text); }
.app.sidebar-collapsed .sidebar-toggle { order:2; }
.app.sidebar-collapsed .nav-item { justify-content:center; padding-left:0; padding-right:0; }
.app.sidebar-collapsed .nav-item .txt,
.app.sidebar-collapsed .capture-btn span { display:none; }
.app.sidebar-collapsed .capture-btn { margin-left:8px; margin-right:8px; }
.app.sidebar-collapsed .language-control { grid-template-columns:1fr; }
.app.sidebar-collapsed .language-control button { width:100%; padding-left:0; padding-right:0; }

/* ── 主区域 ── */
.main { overflow:auto; padding:28px 34px 60px; min-width:0; }
.page-title { font-size:26px; font-weight:700; letter-spacing:-.02em; margin:0 0 20px; }
.muted { color:var(--secondary); }

/* 卡片 */
.cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(158px,1fr)); gap:14px; margin-bottom:22px; }
.card {
  background:var(--card); border-radius:14px; box-shadow:var(--shadow); padding:16px 18px;
}
.card .num { font-size:28px; font-weight:700; letter-spacing:-.02em; }
.card .lbl { color:var(--secondary); font-size:12px; margin-top:2px; }
.panel { background:var(--card); border-radius:14px; box-shadow:var(--shadow); padding:18px 20px; margin-bottom:18px; }
.panel h3 { margin:0 0 12px; font-size:15px; font-weight:600; }

/* 按钮 */
.btn {
  border:1px solid var(--line); background:var(--card); color:var(--text);
  border-radius:980px; padding:5px 14px; font:inherit; font-size:13px; cursor:pointer; transition:all .15s;
}
.btn:hover { border-color:var(--accent); color:var(--accent); }
.btn.primary { background:var(--accent); border-color:var(--accent); color:var(--accent-text); font-weight:600; }
.btn.primary:hover { filter:brightness(1.08); }
.btn.danger:hover { border-color:var(--danger); color:var(--danger); }
.btn:disabled { opacity:.4; cursor:default; }
.btn-row { display:flex; gap:8px; flex-wrap:wrap; }

input,select,textarea {
  border:1px solid var(--line); border-radius:9px; background:var(--card); color:var(--text);
  padding:7px 11px; font:inherit; outline:none;
}
input:focus,select:focus,textarea:focus { border-color:var(--accent); box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent); }

/* 笔记页布局 */
.notes-grid { display:grid; grid-template-columns:296px 1fr; gap:18px; align-items:start; }
.tree-pane { background:var(--card); border-radius:14px; box-shadow:var(--shadow); padding:12px; max-height:calc(100vh - 150px); overflow:auto; }
.tree-pane .search { width:100%; margin-bottom:8px; }
.tree-list { list-style:none; margin:0; padding-left:15px; }
.tree-pane > .tree-list, .graph-tree > .tree-list { padding-left:0; }
.tree-folder > summary {
  cursor:pointer; padding:4px 8px; border-radius:7px; user-select:none; font-weight:500; list-style:none;
}
.tree-folder > summary::before { content:"▸ "; color:var(--secondary); font-size:11px; }
.tree-folder[open] > summary::before { content:"▾ "; }
.tree-folder > summary:hover { background:var(--hover); }
.tree-count { color:var(--secondary); font-size:11px; margin-left:5px; }
.tree-note {
  display:block; width:100%; border:0; background:transparent; color:var(--text); text-align:left;
  padding:4px 8px 4px 20px; border-radius:7px; font:inherit; font-size:13px; cursor:pointer;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.tree-note:hover { background:var(--hover); }
.tree-note.selected { background:color-mix(in srgb,var(--accent) 14%,transparent); color:var(--accent); font-weight:600; }
.search-hit { padding:8px 10px; border-radius:9px; cursor:pointer; }
.search-hit:hover { background:var(--hover); }
.search-hit .t { font-weight:600; }
.search-hit .p { color:var(--secondary); font-size:11px; overflow-wrap:anywhere; }
.search-hit .s { color:var(--secondary); font-size:12px; margin-top:2px; }

.reader { background:var(--card); border-radius:14px; box-shadow:var(--shadow); min-height:60vh; }
.reader-head { padding:18px 26px 12px; border-bottom:1px solid var(--line-soft); display:flex; align-items:flex-start; gap:14px; flex-wrap:wrap; }
.reader-head h2 { margin:0; font-size:21px; font-weight:700; letter-spacing:-.02em; overflow-wrap:anywhere; }
.reader-head .meta { color:var(--secondary); font-size:12px; margin-top:3px; overflow-wrap:anywhere; }
.reader-head .btn-row { margin-left:auto; }
.reader-body { padding:10px 26px 30px; }
.reader-empty { padding:70px 20px; text-align:center; color:var(--secondary); }

/* Markdown 排版 */
.md { font-size:14.5px; line-height:1.75; overflow-wrap:anywhere; }
.md h1,.md h2,.md h3,.md h4 { letter-spacing:-.02em; line-height:1.3; margin:1.3em 0 .5em; }
.md h1 { font-size:23px; } .md h2 { font-size:19px; } .md h3 { font-size:16px; }
.md p { margin:.6em 0; }
.md a { color:var(--accent); text-decoration:none; }
.md a:hover { text-decoration:underline; }
.md code { background:var(--hover); border-radius:5px; padding:1px 5px; font-size:12.5px; font-family:ui-monospace,"SF Mono",Menlo,monospace; }
.md pre { background:var(--hover); border-radius:10px; padding:12px 14px; overflow:auto; }
.md pre code { background:transparent; padding:0; }
.md blockquote { margin:.8em 0; padding:2px 14px; border-left:3px solid var(--line); color:var(--secondary); }
.md img { max-width:100%; border-radius:10px; }
.md table { border-collapse:collapse; } .md th,.md td { border:1px solid var(--line); padding:5px 10px; }
.md ul,.md ol { padding-left:1.5em; }
.md hr { border:0; border-top:1px solid var(--line-soft); margin:1.4em 0; }

/* 标签 */
.tags { display:flex; flex-wrap:wrap; gap:6px; }
.tag { background:color-mix(in srgb,var(--accent) 12%,transparent); color:var(--accent); border-radius:980px; padding:2px 10px; font-size:11.5px; font-weight:500; }

/* 回顾卡片 */
.note-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; }
.note-card { background:var(--card); border-radius:14px; box-shadow:var(--shadow); padding:15px 17px; cursor:pointer; transition:transform .15s; }
.note-card:hover { transform:translateY(-2px); }
.note-card .t { font-weight:600; margin-bottom:4px; overflow-wrap:anywhere; }
.note-card .d { color:var(--secondary); font-size:12px; }

/* 链接健康 */
.link-table { width:100%; border-collapse:collapse; font-size:13px; }
.link-table td { padding:6px 8px; border-top:1px solid var(--line-soft); overflow-wrap:anywhere; }
.link-table tr:first-child td { border-top:0; }
.link-table .clickable { color:var(--accent); cursor:pointer; }
.link-table .clickable:hover { text-decoration:underline; }
.pill { display:inline-block; border-radius:980px; padding:2px 10px; font-size:12px; font-weight:600; }
.pill.ok { background:color-mix(in srgb,var(--ok) 15%,transparent); color:var(--ok); }
.pill.warn { background:color-mix(in srgb,var(--warn) 15%,transparent); color:var(--warn); }
.pill.bad { background:color-mix(in srgb,var(--danger) 15%,transparent); color:var(--danger); }

/* 知识图谱 */
.toolbar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:12px 14px; }
.toolbar input { width:180px; }
.toolbar input[type="checkbox"] { width:auto; height:auto; }
.toolbar select { height:32px; }
.toolbar .status { margin-left:auto; color:var(--secondary); white-space:nowrap; font-size:12px; }
label.toggle { display:flex; gap:5px; align-items:center; color:var(--secondary); white-space:nowrap; font-size:13px; }
.graph-body { display:grid; grid-template-columns:1fr 290px; gap:18px; align-items:start; }
.graph-wrap { position:relative; padding:0; overflow:hidden; height:calc(100vh - 220px); min-height:420px; }
.cy-container { width:100%; height:100%; }
.graph-tree { height:100%; overflow:auto; padding:14px 18px; }
.side h2 { font-size:16px; letter-spacing:-.02em; margin:0 0 8px; overflow-wrap:anywhere; }
.side .path { color:var(--secondary); font-size:11px; overflow-wrap:anywhere; }
.side .metric { display:grid; grid-template-columns:1fr auto; gap:5px 12px; margin:14px 0; font-size:13px; }
.side .metric span:nth-child(odd) { color:var(--secondary); }
.side .hint { color:var(--secondary); margin-top:16px; font-size:12px; }
#empty { display:none; position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); color:var(--secondary); pointer-events:none; }

/* 白板 */
.whiteboard-page { position:relative; height:100vh; min-height:560px; margin:-28px -34px -60px; overflow:hidden; }
.whiteboard-layout { position:absolute; inset:0; display:block; min-height:0; }
.whiteboard-stage { position:absolute; inset:0; min-width:0; display:flex; flex-direction:column; }
.whiteboard-toolbar { position:absolute; z-index:6; top:18px; left:22px; right:22px; min-height:42px; display:flex; align-items:center; gap:8px; padding:7px 9px; background:color-mix(in srgb,var(--card) 88%,transparent); border:1px solid var(--line-soft); border-radius:12px; box-shadow:var(--shadow); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); overflow-x:auto; }
.board-title { font-weight:700; display:flex; align-items:center; gap:8px; white-space:nowrap; }
.board-title-dot { width:8px; height:8px; border-radius:50%; background:#49a7ff; display:inline-block; flex:none; }
.board-edge-count { color:var(--secondary); font-size:11px; font-weight:500; }
.board-search { margin-left:auto; width:180px; height:32px; }
.toolbar-action { flex:none; white-space:nowrap; }
.toolbar-btn { width:30px; height:30px; border:1px solid var(--line); border-radius:7px; background:var(--card); color:var(--text); font:inherit; font-size:16px; line-height:1; cursor:pointer; }
.toolbar-btn:hover { border-color:var(--accent); color:var(--accent); }
.zoom-controls { display:flex; align-items:center; gap:7px; color:var(--secondary); font-size:12px; }
.icon-btn { width:28px; height:28px; border:1px solid var(--line); border-radius:7px; background:var(--card); color:var(--text); font:inherit; font-size:16px; line-height:1; cursor:pointer; }
.icon-btn:hover { border-color:var(--accent); color:var(--accent); }
.whiteboard-canvas { position:relative; overflow:hidden; flex:1; min-height:0; background-color:color-mix(in srgb,var(--card) 88%,var(--bg)); background-image:radial-gradient(color-mix(in srgb,var(--secondary) 30%,transparent) 1px,transparent 1px); background-size:22px 22px; cursor:grab; touch-action:none; }
.whiteboard-canvas:active { cursor:grabbing; }
.canvas-grid { position:absolute; inset:0; transform-origin:0 0; pointer-events:none; }
.board-links { position:absolute; left:0; top:0; overflow:visible; pointer-events:none; }
.board-link { fill:none; stroke:color-mix(in srgb,var(--secondary) 78%,var(--card)); stroke-width:2.4; stroke-linecap:round; opacity:.8; transition:stroke .16s,stroke-width .16s,opacity .16s; }
.board-link.focused { stroke:var(--accent); stroke-width:3.2; opacity:1; }
.board-link.dimmed { opacity:.18; }
.board-links marker path { fill:color-mix(in srgb,var(--secondary) 78%,var(--card)); }
.board-card { position:absolute; width:208px; min-height:152px; padding:17px 16px 13px; border-radius:10px; border:1px solid rgba(0,0,0,.08); box-shadow:0 7px 18px rgba(0,0,0,.10); cursor:grab; user-select:none; transition:box-shadow .15s, transform .15s; pointer-events:auto; }
.board-card:hover { box-shadow:0 10px 24px rgba(0,0,0,.15); transform:translateY(-2px); }
.board-card.selected { outline:2px solid var(--accent); outline-offset:3px; }
.board-card:active { cursor:grabbing; }
.board-card.blue { background:#e8f3ff; color:#18334f; }
.board-card.yellow { background:#fff3c7; color:#4a3a10; }
.board-card.green { background:#e4f4e9; color:#1f4430; }
.board-card.pink { background:#fce8ee; color:#502b37; }
@media(prefers-color-scheme:dark) { .board-card.blue { background:#19334d; color:#e5f2ff; } .board-card.yellow { background:#4b3b15; color:#fff4cd; } .board-card.green { background:#1b3b28; color:#e3f5e8; } .board-card.pink { background:#4b2633; color:#ffe8ef; } }
.card-pin { position:absolute; top:9px; right:12px; width:7px; height:7px; border-radius:50%; background:currentColor; opacity:.3; }
.board-card h3 { margin:0 0 8px; font-size:15px; line-height:1.3; letter-spacing:-.01em; overflow-wrap:anywhere; }
.board-card p { margin:0; font-size:12px; line-height:1.55; opacity:.78; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; white-space:pre-wrap; }
.card-source { margin-top:12px; border:0; padding:0; background:transparent; color:inherit; opacity:.62; font:inherit; font-size:10px; cursor:pointer; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.card-source:hover { opacity:1; text-decoration:underline; }
.canvas-hint { position:absolute; bottom:10px; left:50%; transform:translateX(-50%); background:color-mix(in srgb,var(--card) 88%,transparent); border:1px solid var(--line-soft); border-radius:980px; padding:4px 12px; color:var(--secondary); font-size:10px; pointer-events:none; white-space:nowrap; }
.board-empty { position:absolute; left:50%; top:45%; transform:translate(-50%,-50%); color:var(--secondary); font-size:13px; white-space:nowrap; }
.whiteboard-inspector { position:absolute; z-index:5; top:76px; right:22px; bottom:22px; width:280px; min-width:0; overflow:auto; background:color-mix(in srgb,var(--card) 94%,transparent); border:1px solid var(--line-soft); border-radius:14px; padding:14px 12px; box-shadow:0 12px 34px rgba(0,0,0,.14); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); transition:width .2s ease,padding .2s ease,background .2s ease; }
.whiteboard-inspector.collapsed { width:0; padding:0; overflow:hidden; border-color:transparent; box-shadow:none; pointer-events:none; }
.inspector-content { min-width:0; }
.whiteboard-inspector.collapsed .inspector-content { display:none; }
.inspector-head { display:flex; align-items:center; justify-content:space-between; font-size:13px; font-weight:700; padding:0 36px 13px 0; border-bottom:1px solid var(--line-soft); margin-bottom:14px; }
.inspector-label { display:block; color:var(--secondary); font-size:11px; margin:11px 0 5px; }
.whiteboard-inspector input,.whiteboard-inspector textarea { width:100%; font-size:13px; }
.whiteboard-inspector textarea { resize:vertical; line-height:1.5; }
.color-picker { display:flex; gap:8px; margin:8px 0 18px; }
.color-swatch { width:24px; height:24px; border-radius:50%; border:2px solid transparent; cursor:pointer; }
.color-swatch.active { border-color:var(--text); box-shadow:0 0 0 2px var(--card),0 0 0 3px var(--text); }
.color-swatch.blue { background:#6db8ff; } .color-swatch.yellow { background:#f2c94c; } .color-swatch.green { background:#70c58b; } .color-swatch.pink { background:#ea8eaa; }
.inspector-source { width:100%; margin-bottom:8px; }
.connect-hint { margin:4px 0 10px; color:var(--accent); font-size:11px; line-height:1.5; }
.connection-section { margin-top:14px; }
.connection-empty { color:var(--secondary); font-size:11px; margin:4px 0 12px; }
.connection-row { display:flex; align-items:center; gap:6px; min-width:0; padding:6px 4px; border-top:1px solid var(--line-soft); font-size:11px; }
.connection-direction { width:14px; color:var(--accent); font-size:14px; flex:none; }
.connection-name { min-width:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.connection-remove { border:0; background:transparent; color:var(--secondary); font:inherit; font-size:15px; line-height:1; cursor:pointer; }
.connection-remove:hover { color:var(--danger); }
.inspector-delete { width:100%; }
.inspector-empty { padding:66px 18px 20px; color:var(--secondary); text-align:center; }
.inspector-empty strong { display:block; color:var(--text); font-size:13px; margin-top:10px; }
.inspector-empty p { font-size:11px; line-height:1.6; }
.inspector-icon { color:var(--accent); font-size:27px; }

/* 弹窗 */
.modal-mask {
  position:fixed; inset:0; background:rgba(0,0,0,.32); display:none;
  align-items:flex-start; justify-content:center; padding-top:12vh; z-index:50;
}
.modal-mask.show { display:flex; }
.modal { background:var(--card); border-radius:16px; box-shadow:0 18px 60px rgba(0,0,0,.25); width:460px; max-width:92vw; padding:22px 24px; }
.modal h3 { margin:0 0 14px; font-size:17px; font-weight:700; }
.modal .field { margin-bottom:12px; }
.modal .field label { display:block; font-size:12px; color:var(--secondary); margin-bottom:4px; }
.modal .field input,.modal .field select,.modal .field textarea { width:100%; }
.modal .field textarea { min-height:110px; resize:vertical; }
.modal .actions { display:flex; justify-content:flex-end; gap:9px; margin-top:16px; }

/* Toast */
#toast {
  position:fixed; bottom:26px; left:50%; transform:translateX(-50%) translateY(20px);
  background:var(--text); color:var(--bg); border-radius:980px; padding:9px 20px; font-size:13px;
  opacity:0; transition:all .25s; pointer-events:none; z-index:99;
}
#toast.show { opacity:1; transform:translateX(-50%) translateY(0); }

@media(max-width:900px) {
  .app { grid-template-columns:64px 1fr; }
  .app.sidebar-collapsed { grid-template-columns:64px 1fr; }
  .sidebar { padding:16px 8px; }
  .brand { font-size:15px; padding:4px 4px 14px; text-align:center; }
  .brand-row { display:block; }
  .sidebar-toggle { display:none; }
  .nav-item span.txt, .capture-btn span { display:none; }
  .language-control { margin:4px 0 8px; }
  .language-control button { padding:3px 1px; font-size:9px; }
  .notes-grid, .graph-body { grid-template-columns:1fr; }
  .whiteboard-page { height:100vh; min-height:540px; margin:-20px -16px -50px; }
  .whiteboard-toolbar { top:14px; left:16px; right:16px; flex-wrap:wrap; overflow:visible; gap:6px; }
  .board-title { display:none; }
  .board-search { margin-left:0; }
  .whiteboard-inspector { top:150px; right:16px; bottom:16px; width:min(280px,calc(100vw - 32px)); }
  .board-search { width:130px; flex:0 0 130px; }
  .canvas-hint { max-width:calc(100% - 32px); overflow:hidden; text-overflow:ellipsis; }
  .side { display:none; }
  .main { padding:20px 16px 50px; }
}
</style>
</head>
<body>
<div id="root"></div>
<script src="/app.js" defer></script>
</body>
</html>`;
}
