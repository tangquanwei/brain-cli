import chalk from "chalk";
import boxen from "boxen";
import Table from "cli-table3";

export function panel(content: string, opts: { borderColor?: string; title?: string } = {}): void {
  console.log(
    boxen(content, {
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      borderStyle: "round",
      borderColor: opts.borderColor ?? "cyan",
      title: opts.title,
    }),
  );
}

export function table(opts: {
  head?: string[];
  rows: (string | number)[][];
  title?: string;
}): void {
  if (opts.title) console.log(chalk.bold(opts.title));
  const t = new Table({
    head: opts.head,
    style: { head: ["bold", "cyan"], border: ["gray"] },
  });
  for (const row of opts.rows) t.push(row.map(String));
  console.log(t.toString());
}

export const c = {
  success: (s: string) => chalk.green(s),
  warn: (s: string) => chalk.yellow(s),
  error: (s: string) => chalk.red(s),
  info: (s: string) => chalk.blue(s),
  dim: (s: string) => chalk.dim(s),
  bold: (s: string) => chalk.bold(s),
};

export function log(message: string): void {
  console.log(message);
}
