import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  countMdRecursive,
  listNotes,
  readNoteContent,
} from "../src/web/data.js";

let dir: string;

function writeNote(rel: string, content: string): void {
  const full = join(dir, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "brain-webdata-"));
  mkdirSync(join(dir, "projects"), { recursive: true });
  mkdirSync(join(dir, "areas"), { recursive: true });
  writeNote(
    "projects/alpha.md",
    '---\ntitle: "Alpha 项目"\ndate: "2026-08-01 10:00"\ntags: [work, ai]\n---\n\n# Alpha\n\n这是 Alpha 的摘要。\n',
  );
  writeNote(
    "areas/health/beta.md",
    '---\ntitle: "Beta 习惯"\ndate: "2026-08-05 09:00"\ntags: [life]\n---\n\n# Beta\n\n保持运动。\n',
  );
  writeNote("gamma.md", "# 根目录笔记\n\n没有 frontmatter。\n");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("countMdRecursive", () => {
  it("递归统计 Markdown 文件并忽略隐藏目录", () => {
    expect(countMdRecursive(dir)).toBe(3);
    expect(countMdRecursive(join(dir, "projects"))).toBe(1);
    expect(countMdRecursive(join(dir, "missing"))).toBe(0);
  });
});

describe("listNotes", () => {
  it("默认按日期倒序返回全部笔记", () => {
    const notes = listNotes(dir);
    expect(notes.map((n) => n.id)).toEqual([
      "areas/health/beta.md",
      "projects/alpha.md",
      "gamma.md",
    ]);
  });

  it("支持按区域过滤", () => {
    expect(listNotes(dir, { area: "projects" }).map((n) => n.id)).toEqual([
      "projects/alpha.md",
    ]);
    expect(listNotes(dir, { area: "root" }).map((n) => n.id)).toEqual([
      "gamma.md",
    ]);
  });

  it("支持标签与关键字过滤", () => {
    expect(listNotes(dir, { tag: "ai" }).map((n) => n.id)).toEqual([
      "projects/alpha.md",
    ]);
    expect(listNotes(dir, { q: "运动" }).map((n) => n.id)).toEqual([
      "areas/health/beta.md",
    ]);
    expect(listNotes(dir, { q: "不存在的词" })).toEqual([]);
  });
});

describe("readNoteContent", () => {
  it("读取 frontmatter 与正文", () => {
    const note = readNoteContent(dir, "projects/alpha.md");
    expect(note).not.toBeNull();
    expect(note!.title).toBe("Alpha 项目");
    expect(note!.date).toBe("2026-08-01");
    expect(note!.tags).toEqual(["work", "ai"]);
    expect(note!.content).toContain("这是 Alpha 的摘要。");
  });

  it("拒绝路径穿越与绝对路径", () => {
    expect(readNoteContent(dir, "../outside.md")).toBeNull();
    expect(readNoteContent(dir, join(dir, "projects/alpha.md"))).toBeNull();
    expect(readNoteContent(dir, "projects\\alpha.md")).toBeNull();
    expect(readNoteContent(dir, "")).toBeNull();
    expect(readNoteContent(dir, undefined)).toBeNull();
  });

  it("未知笔记返回 null", () => {
    expect(readNoteContent(dir, "projects/ghost.md")).toBeNull();
  });
});
