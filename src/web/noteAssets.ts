import { readFileSync, realpathSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

const imageTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

export function readNoteAsset(root: string, path: string) {
  try {
    const realRoot = realpathSync(root);
    const file = realpathSync(resolve(realRoot, path));
    const type = imageTypes[extname(file).toLowerCase()];
    if (!file.startsWith(realRoot + sep) || !type || !statSync(file).isFile())
      return null;
    return { type, data: readFileSync(file) };
  } catch {
    return null;
  }
}
