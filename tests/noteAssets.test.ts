import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readNoteAsset } from "../src/web/noteAssets.js";

const directories: string[] = [];
afterEach(() =>
  directories
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true })),
);
describe("local editor image assets", () => {
  it("resolves relative images and rejects traversal outside the vault and non-images", () => {
    const dir = mkdtempSync(join(tmpdir(), "brain-assets-"));
    directories.push(dir);
    const root = join(dir, "notes");
    mkdirSync(join(root, "resources"), { recursive: true });
    mkdirSync(join(root, "images"));
    writeFileSync(join(root, "images/a&b.png"), "fixture");
    writeFileSync(join(root, "secret.md"), "private");
    writeFileSync(join(dir, "outside.png"), "outside");
    expect(readNoteAsset(root, "resources/../images/a&b.png")?.type).toBe(
      "image/png",
    );
    expect(readNoteAsset(root, "../outside.png")).toBeNull();
    expect(readNoteAsset(root, "secret.md")).toBeNull();
    expect(readNoteAsset(root, "images/missing.png")).toBeNull();
  });
});
