/** Keep metadata byte-for-byte outside the rich editor. */
export function splitMarkdownDocument(raw: string): {
  prefix: string;
  body: string;
} {
  const match =
    /^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(
      raw,
    );
  return match
    ? { prefix: match[0], body: raw.slice(match[0].length) }
    : { prefix: "", body: raw };
}
