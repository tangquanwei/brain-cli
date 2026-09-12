import { isAbsolute } from "node:path";
import { spawn } from "node:child_process";
import type { NoteNode } from "./noteIndex.js";

export type NoteLauncher = (absolutePath: string) => void | Promise<void>;

export function resolveSafeNote(
  id: unknown,
  nodes: NoteNode[],
): NoteNode | undefined {
  if (typeof id !== "string" || !id || isAbsolute(id) || id.includes("\\"))
    return undefined;
  if (id.split("/").includes("..")) return undefined;
  return nodes.find((node) => node.relPath === id);
}

export function launchInCode(absolutePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("code", [absolutePath], {
      detached: true,
      shell: false,
      stdio: "ignore",
    });
    child.once("error", () =>
      reject(new Error("无法启动 VS Code，请确认 code 命令已安装到 PATH。")),
    );
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

export async function openSafeNote(
  id: unknown,
  nodes: NoteNode[],
  launcher: NoteLauncher = launchInCode,
): Promise<boolean> {
  const node = resolveSafeNote(id, nodes);
  if (!node) return false;
  await launcher(node.path);
  return true;
}
