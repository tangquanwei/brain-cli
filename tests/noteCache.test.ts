import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readFileCached } from "../src/utils/noteCache.js";

describe("readFileCached", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("returns fresh content after the file changes", () => {
    dir = mkdtempSync(join(tmpdir(), "brain-cache-"));
    const file = join(dir, "note.md");
    writeFileSync(file, "first", "utf8");
    expect(readFileCached(file)).toBe("first");

    writeFileSync(file, "second", "utf8");
    // Force a distinct mtime so the cache can detect the change.
    const future = new Date(Date.now() + 10_000);
    utimesSync(file, future, future);

    expect(readFileCached(file)).toBe("second");
  });

  it("reuses the cached copy while the file is unchanged", () => {
    dir = mkdtempSync(join(tmpdir(), "brain-cache-"));
    const file = join(dir, "note.md");
    writeFileSync(file, "content", "utf8");
    expect(readFileCached(file)).toBe("content");
    expect(readFileCached(file)).toBe("content");
  });
});
