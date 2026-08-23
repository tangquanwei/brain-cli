import { backup as doBackup } from "../utils/git.js";
import { c, panel } from "../utils/ui.js";

export async function runBackup(message: string | undefined, doPush: boolean): Promise<void> {
  panel(
    `${c.bold("💾 notes Git 备份")}\n${doPush ? "提交并推送 notes" : "仅在 notes 本地提交"}`,
    { borderColor: "yellow" },
  );
  await doBackup(message, doPush);
}
