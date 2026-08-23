import { describe, expect, it } from "vitest";
import {
  extractMarkdownLinks,
  extractWikiLinks,
  formatMarkdownDestination,
} from "../src/utils/markdownLinks.js";

describe("markdownLinks", () => {
  it("extracts note links and keeps heading suffixes", () => {
    const links = extractMarkdownLinks(
      "[Padding](Padding.md#padding)\n![x](a.png)",
    );
    expect(links).toHaveLength(2);
    expect(links[0]?.kind).toBe("note");
    expect(links[0]?.href).toBe("Padding.md");
    expect(links[0]?.suffix).toBe("#padding");
    expect(links[1]?.kind).toBe("asset");
    expect(links[1]?.image).toBe(true);
  });

  it("supports angle wrapped paths with spaces", () => {
    const links = extractMarkdownLinks("[Haskell](<Haskell Monad.md#intro>)");
    expect(links[0]?.href).toBe("Haskell Monad.md");
    expect(links[0]?.suffix).toBe("#intro");
    expect(links[0]?.angleWrapped).toBe(true);
  });

  it("ignores links in code blocks", () => {
    const links = extractMarkdownLinks(
      "```md\n[x](A.md)\n```\n~~~md\n[z](C.md)\n~~~\n[y](B.md)",
    );
    expect(links.map((l) => l.href)).toEqual(["B.md"]);
  });

  it("finds non-standard wikilinks", () => {
    const links = extractWikiLinks("[[Padding]] and ![[image.png]]");
    expect(links.map((l) => [l.target, l.embed])).toEqual([
      ["Padding", false],
      ["image.png", true],
    ]);
  });

  it("does not treat token id arrays as wikilinks", () => {
    const links = extractWikiLinks(
      "ids: [[1986, 374, 264]] single: [[62057]] note: [[Padding]]",
    );
    expect(links.map((l) => l.target)).toEqual(["Padding"]);
  });

  it("classifies same-note heading links as anchors", () => {
    expect(extractMarkdownLinks("[section](#中文-标题)")[0]?.kind).toBe(
      "anchor",
    );
  });

  it("formats paths with spaces for VS Code preview", () => {
    expect(formatMarkdownDestination("../A B.md", "#x")).toBe("<../A B.md#x>");
  });
});
