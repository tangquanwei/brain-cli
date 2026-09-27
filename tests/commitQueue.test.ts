import { describe, expect, it, vi } from "vitest";
import { createCommitQueue } from "../src/web/commitQueue.js";

describe("WebUI background commits", () => {
  it("returns immediately and serializes commits to their captured directories", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const commit = vi
      .fn()
      .mockImplementationOnce(() => gate)
      .mockResolvedValue(true);
    const queue = createCommitQueue(commit);
    expect(queue.enqueue("vault-a", "first")).toBeUndefined();
    queue.enqueue("vault-b", "second");
    await Promise.resolve();
    expect(commit.mock.calls).toEqual([["vault-a", "first"]]);
    release();
    await queue.flush();
    expect(commit.mock.calls).toEqual([
      ["vault-a", "first"],
      ["vault-b", "second"],
    ]);
  });

  it("reports a failure and continues processing later saves", async () => {
    const error = new Error("Git unavailable");
    const commit = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(true);
    const onError = vi.fn();
    const queue = createCommitQueue(commit, onError);
    queue.enqueue("vault", "first");
    queue.enqueue("vault", "second");
    await queue.flush();
    expect(onError).toHaveBeenCalledWith(error);
    expect(commit).toHaveBeenCalledTimes(2);
  });
});
