import { isAbsolute } from "node:path";
import { spawn } from "node:child_process";
import type { NoteNode } from "./noteIndex.js";

export type NoteLauncher = (absolutePath: string) => void;

export function resolveSafeNote(
  id: unknown,
  nodes: NoteNode[],
): NoteNode | undefined {
  if (typeof id !== "string" || !id || isAbsolute(id) || id.includes("\\"))
    return undefined;
  if (id.split("/").includes("..")) return undefined;
  return nodes.find((node) => node.relPath === id);
}

export function launchInCode(absolutePath: string): void {
  const child = spawn("code", [absolutePath], {
    detached: true,
    shell: false,
    stdio: "ignore",
  });
  child.unref();
}

export function openSafeNote(
  id: unknown,
  nodes: NoteNode[],
  launcher: NoteLauncher = launchInCode,
): boolean {
  const node = resolveSafeNote(id, nodes);
  if (!node) return false;
  launcher(node.path);
  return true;
}
