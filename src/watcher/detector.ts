import chokidar, { type FSWatcher } from "chokidar";

/** Collects changed file paths between flushes, debounced via chokidar's awaitWriteFinish. */
export class ChangeDetector {
  private changed = new Set<string>();
  private watcher: FSWatcher | null = null;

  constructor(private readonly watchDir: string) {}

  start(): void {
    if (this.watcher) return;
    this.watcher = chokidar.watch(this.watchDir, {
      ignored: /(^|[\\/])\../, // dotfiles
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });
    const handler = (path: string) => {
      if (/\.(md|markdown|txt)$/i.test(path)) this.changed.add(path);
    };
    this.watcher.on("add", handler);
    this.watcher.on("change", handler);
    this.watcher.on("unlink", handler);
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  flush(): string[] {
    const arr = [...this.changed];
    this.changed.clear();
    return arr;
  }
}
