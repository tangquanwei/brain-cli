import { settings } from "../config.js";
import { autoCommit } from "../utils/git.js";

/** Keep Git latency outside HTTP responses and serialize WebUI commits. */
export function createCommitQueue(
  commit: (directory: string, message: string) => Promise<unknown>,
  onError: (error: unknown) => void = (error) =>
    console.error("WebUI Git backup failed:", error),
) {
  let pending = Promise.resolve();
  return {
    enqueue(directory: string, message: string): void {
      pending = pending
        .then(() => commit(directory, message))
        .then(() => {}, onError);
    },
    flush: () => pending,
  };
}

const queue = createCommitQueue((directory, message) =>
  autoCommit(message, false, directory),
);

export function queueWebCommit(message: string): void {
  if (settings.gitAutoCommit) queue.enqueue(settings.notesDir, message);
}
