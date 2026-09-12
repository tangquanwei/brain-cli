import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, expect, it } from "vitest";
import { publishNote } from "../src/web/blogData.js";

let dir: string, notes: string, blog: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "brain-publish-"));
  notes = join(dir, "notes");
  blog = join(dir, "blog");
  mkdirSync(join(notes, "resources"), { recursive: true });
  mkdirSync(join(blog, "source/_posts"), { recursive: true });
  writeFileSync(join(blog, "_config.yml"), "source_dir: source\n");
  writeFileSync(
    join(notes, "resources/article.md"),
    "---\ntitle: Example\ntags: [demo]\nprivate_field: hidden\n---\nHello ![image](photo.png)\n[[Private note|Read more]]\n",
  );
  writeFileSync(join(notes, "resources/photo.png"), "fictional image");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it("publishes an article and its assets, updates one copy, preserves Notes and manual Blog edits", () => {
  const source = readFileSync(join(notes, "resources/article.md"), "utf8");
  const result = publishNote(notes, blog, "resources/article.md");
  const first = readFileSync(result.path, "utf8");
  const article = matter(first);
  expect(article.data.title).toBe("Example");
  expect(article.data.private_field).toBeUndefined();
  expect(article.content).toContain("/brain-assets/");
  expect(article.content).toContain("Read more");
  expect(article.content).not.toContain("[[");
  expect(result.assets).toBe(1);
  expect(result.noteLinks).toBe(1);
  expect(readFileSync(join(notes, "resources/article.md"), "utf8")).toBe(
    source,
  );
  expect(publishNote(notes, blog, "resources/article.md").updated).toBe(true);
  expect(readFileSync(result.path, "utf8")).toBe(first);
  writeFileSync(
    join(notes, "resources/article.md"),
    source + "New paragraph\n",
  );
  publishNote(notes, blog, "resources/article.md");
  expect(readFileSync(result.path, "utf8")).toContain("New paragraph");
  expect(readdirSync(join(blog, "source/_posts"))).toHaveLength(1);
  writeFileSync(result.path, first + "Blog-only edit\n");
  expect(() => publishNote(notes, blog, "resources/article.md")).toThrow(
    "edited",
  );
  expect(readFileSync(result.path, "utf8")).toBe(first + "Blog-only edit\n");
});

it("fails before writing for invalid ids, missing assets and escaped/symlink assets", () => {
  for (const id of [
    undefined,
    "../outside.md",
    "/article.md",
    "resources\\article.md",
  ])
    expect(() => publishNote(notes, blog, id)).toThrow("not found");
  for (const href of ["missing.png", "../../outside.png", "leak.png"]) {
    writeFileSync(join(dir, "outside.png"), "private");
    if (href === "leak.png")
      symlinkSync(join(dir, "outside.png"), join(notes, "resources/leak.png"));
    writeFileSync(join(notes, "resources/article.md"), `![image](${href})`);
    expect(() => publishNote(notes, blog, "resources/article.md")).toThrow();
    expect(readdirSync(join(blog, "source/_posts"))).toEqual([]);
  }
});

it("rejects symlink output directories and overlapping vaults", () => {
  rmSync(join(blog, "source/_posts"), { recursive: true });
  symlinkSync(notes, join(blog, "source/_posts"));
  expect(() => publishNote(notes, blog, "resources/article.md")).toThrow(
    "Symlinks",
  );
  mkdirSync(join(notes, "source/_posts"), { recursive: true });
  writeFileSync(join(notes, "_config.yml"), "");
  expect(() => publishNote(notes, notes, "resources/article.md")).toThrow(
    "separate",
  );
});

it("copies WikiLink attachments and leaves code samples and external URLs alone", () => {
  writeFileSync(
    join(notes, "resources/article.md"),
    "![[photo.png|sample]]\n`![code](missing.png)`\n![remote](https://example.com/a.png)\n",
  );
  const result = publishNote(notes, blog, "resources/article.md");
  const body = matter(readFileSync(result.path, "utf8")).content;
  expect(body).toContain("![sample](/brain-assets/");
  expect(body).toContain("`![code](missing.png)`");
  expect(body).toContain("https://example.com/a.png");
});

it("uses the site root for downloads and lets Hexo prepend it to images", () => {
  writeFileSync(join(blog, "_config.yml"), "root: /journal/\n");
  writeFileSync(
    join(notes, "resources/article.md"),
    "[download](photo.png) ![image](photo.png)",
  );
  const article = matter(
    readFileSync(publishNote(notes, blog, "resources/article.md").path, "utf8"),
  );
  expect(article.content).toContain("[download](/journal/brain-assets/");
  expect(article.content).toContain("![image](/brain-assets/");
  writeFileSync(join(blog, "_config.yml"), "source_dir: custom\n");
  expect(() => publishNote(notes, blog, "resources/article.md")).toThrow(
    "source_dir",
  );
});
