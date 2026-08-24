import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectVault } from "../src/commands/doctor.js";

describe("doctor", () => {
  it("inspects an existing vault without creating or migrating files", () => {
    const dir = mkdtempSync(join(tmpdir(), "brain-cli-doctor-"));
    try {
      mkdirSync(join(dir, "notes"), { recursive: true });
      writeFileSync(join(dir, "notes", "A.md"), "# A\n\n[[Missing]]\n", "utf8");
      const before = readdirSync(join(dir, "notes"));

      const result = inspectVault(join(dir, "notes"));

      expect(result.notes).toBe(1);
      expect(result.wikiLinks).toBe(1);
      expect(result.brokenLinks).toBe(1);
      expect(readdirSync(join(dir, "notes"))).toEqual(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects a missing directory instead of creating it", () => {
    expect(() => inspectVault("/definitely/missing/brain-cli-vault")).toThrow(
      "知识库目录不存在",
    );
  });
});
