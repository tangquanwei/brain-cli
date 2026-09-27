import { describe, expect, it } from "vitest";
import { splitMarkdownDocument } from "../web-ui/markdownDocument";

describe("Markdown editor document boundary", () => {
  it("preserves YAML formatting, comments and CRLF without reserializing", () => {
    const prefix =
      '\uFEFF---\r\ntitle: "A" # keep this\r\ntags: [one, two]\r\n---\r\n';
    const body =
      "\r\n[[Wiki note]]\r\n![image](../assets/a.png)\r\n\r\n$$x^2$$\r\n";
    expect(splitMarkdownDocument(prefix + body)).toEqual({ prefix, body });
  });
  it("leaves ordinary Markdown and incomplete frontmatter intact", () => {
    for (const body of ["", "# Title\n\n---\nBody", "---\ntitle: unfinished"]) {
      expect(splitMarkdownDocument(body)).toEqual({ prefix: "", body });
    }
  });
  it("accepts a YAML document ending with three dots", () => {
    expect(splitMarkdownDocument("---\ntags: []\n...\nBody")).toEqual({
      prefix: "---\ntags: []\n...\n",
      body: "Body",
    });
  });
});
