import { describe, expect, it, vi } from "vitest";
import { openSafeNote, resolveSafeNote } from "../src/utils/safeOpenNote.js";
import type { NoteNode } from "../src/utils/noteIndex.js";

const nodes: NoteNode[] = [
  {
    title: "A",
    path: "/vault/notes/areas/A B.md",
    relPath: "areas/A B.md",
    tags: [],
    headings: [],
  },
];

describe("safe note opening", () => {
  it("accepts only an indexed relative id", () => {
    expect(resolveSafeNote("areas/A B.md", nodes)?.path).toBe(
      "/vault/notes/areas/A B.md",
    );
    expect(resolveSafeNote("../secret.md", nodes)).toBeUndefined();
    expect(resolveSafeNote("/etc/passwd", nodes)).toBeUndefined();
    expect(resolveSafeNote("areas\\A B.md", nodes)).toBeUndefined();
    expect(resolveSafeNote("areas/missing.md", nodes)).toBeUndefined();
  });

  it("passes the path as one launcher argument", () => {
    const launcher = vi.fn();
    expect(openSafeNote("areas/A B.md", nodes, launcher)).toBe(true);
    expect(launcher).toHaveBeenCalledWith("/vault/notes/areas/A B.md");
  });
});
