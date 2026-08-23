import { runMove } from "./move.js";

export async function runRename(
  oldArg: string,
  newArg: string,
  opts: { dryRun: boolean },
): Promise<void> {
  await runMove(oldArg, newArg, opts);
}
