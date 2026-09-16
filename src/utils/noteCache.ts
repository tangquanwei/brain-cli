import { readFileSync, statSync } from "node:fs";

interface CacheEntry {
  mtimeMs: number;
  size: number;
  content: string;
}

const cache = new Map<string, CacheEntry>();

/**
 * Read a UTF-8 file, reusing a cached copy as long as the file is unchanged.
 *
 * 仪表盘 / 链接图 / 笔记摘要会在一次请求里反复读取同一批笔记文件，
 * 这里按 mtime + size 做进程内缓存，避免重复的磁盘读取与解码。
 * 文件被修改后（mtime/size 变化）会自动失效并重新读取。
 */
export function readFileCached(path: string): string {
  const stat = statSync(path);
  const cached = cache.get(path);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.content;
  }
  const content = readFileSync(path, "utf8");
  cache.set(path, { mtimeMs: stat.mtimeMs, size: stat.size, content });
  return content;
}

/** Drop all cached entries (used by tests and when the notes root changes). */
export function clearNoteCache(): void {
  cache.clear();
}
