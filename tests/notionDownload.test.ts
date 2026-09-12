import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { settings } from "../src/config.js";
import { parseNotionPageId, runDownload } from "../src/commands/download.js";

const PAGE_ID = "3b178eaf-d44e-8025-b0b1-cd05d4fb4581";
const PAGE_URL =
  "https://app.notion.com/p/qwtang/TLDR-3b178eafd44e8025b0b1cd05d4fb4581";
const originalNotesDir = settings.notesDir;
const originalToken = settings.notionToken;
const tempDirs: string[] = [];

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pageAndBlocks(title = "TLDR") {
  return {
    page: {
      id: PAGE_ID,
      url: PAGE_URL,
      properties: { Name: { type: "title", title: [{ plain_text: title }] } },
    },
    blocks: {
      object: "list",
      results: [
        {
          id: "heading",
          type: "heading_2",
          heading_2: { rich_text: [{ plain_text: "Summary" }] },
        },
        {
          id: "paragraph",
          type: "paragraph",
          paragraph: { rich_text: [{ plain_text: "Hello **Notion**" }] },
        },
        {
          id: "image",
          type: "image",
          image: {
            type: "external",
            external: { url: "https://cdn.example.test/photo.png" },
          },
        },
      ],
      has_more: false,
      next_cursor: null,
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  settings.notesDir = originalNotesDir;
  settings.notionToken = originalToken;
  while (tempDirs.length)
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("Notion download", () => {
  it("parses the example URL and rejects unrelated hosts", () => {
    expect(parseNotionPageId(PAGE_URL)).toBe(PAGE_ID);
    expect(() =>
      parseNotionPageId("https://example.com/3b178eafd44e8025b0b1cd05d4fb4581"),
    ).toThrow("只支持");
  });

  it("writes a Markdown note and downloaded media under resources", async () => {
    const vault = mkdtempSync(join(tmpdir(), "brain-cli-notion-"));
    tempDirs.push(vault);
    settings.notesDir = vault;
    settings.notionToken = "secret_test";
    const data = pageAndBlocks();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/pages/")) return response(data.page);
      if (url.includes("/blocks/") && url.includes("children"))
        return response(data.blocks);
      return new Response("image", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runDownload({ url: PAGE_URL });
    expect(result.filepath).toBe(join(vault, "resources", "TLDR.md"));
    const raw = readFileSync(result.filepath, "utf8");
    expect(raw).toContain(
      "notion_page_id: 3b178eaf-d44e-8025-b0b1-cd05d4fb4581",
    );
    expect(raw).toContain("## Summary");
    expect(raw).toContain("./TLDR.assets/photo.png");
    expect(
      existsSync(join(vault, "resources", "TLDR.assets", "photo.png")),
    ).toBe(true);
  });

  it("updates by page ID and refuses a title collision", async () => {
    const vault = mkdtempSync(join(tmpdir(), "brain-cli-notion-"));
    tempDirs.push(vault);
    settings.notesDir = vault;
    settings.notionToken = "secret_test";
    mkdirSync(join(vault, "resources"), { recursive: true });
    writeFileSync(
      join(vault, "resources", "Old title.md"),
      `---\nnotion_page_id: ${PAGE_ID}\n---\n\nold\n`,
    );
    const data = pageAndBlocks("New title");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/pages/")) return response(data.page);
        if (url.includes("/blocks/"))
          return response({ results: [], has_more: false });
        return response({});
      }),
    );
    const updated = await runDownload({ url: PAGE_URL });
    expect(updated.updated).toBe(true);
    expect(updated.filepath).toBe(join(vault, "resources", "Old title.md"));
    rmSync(join(vault, "resources", "Old title.md"));

    writeFileSync(join(vault, "resources", "Collision.md"), "local\n");
    const collisionPage = pageAndBlocks("Collision");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/pages/"))
          return response({
            ...collisionPage.page,
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          });
        if (url.includes("/blocks/"))
          return response({ results: [], has_more: false });
        return response({});
      }),
    );
    await expect(runDownload({ url: PAGE_URL })).rejects.toThrow(
      "目标文件已存在",
    );
    expect(readFileSync(join(vault, "resources", "Collision.md"), "utf8")).toBe(
      "local\n",
    );
  });

  it("does not create a file when the API fails", async () => {
    const vault = mkdtempSync(join(tmpdir(), "brain-cli-notion-"));
    tempDirs.push(vault);
    settings.notesDir = vault;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ message: "unauthorized" }, 401)),
    );
    await expect(runDownload({ url: PAGE_URL, token: "bad" })).rejects.toThrow(
      "Notion API 请求失败",
    );
    expect(existsSync(join(vault, "resources"))).toBe(false);
  });
});
