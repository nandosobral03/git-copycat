import ora, { type Ora } from "ora";
import cliProgress from "cli-progress";
import chalk from "chalk";
import boxen from "boxen";

const colors = {
  primary: chalk.cyan,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  muted: chalk.gray,
  highlight: chalk.bold.white,
  accent: chalk.magenta,
};

const symbols = {
  success: chalk.green("✔"),
  error: chalk.red("✖"),
  warning: chalk.yellow("⚠"),
  info: chalk.cyan("ℹ"),
  arrow: chalk.cyan("→"),
  bullet: chalk.gray("•"),
  cat: "🐱",
};

export function printBanner(): void {
  const title = `${symbols.cat}  ${colors.highlight("Git Copycat")}\n${colors.muted("Contribution Sync")}`;

  console.log(
    boxen(title, {
      padding: 1,
      margin: { top: 1, bottom: 1, left: 2, right: 0 },
      borderStyle: "round",
      borderColor: "cyan",
      textAlignment: "center",
    })
  );
}

export function printConfig(config: { sourceUsername: string; targetRepoPath: string; fromDate: Date; toDate: Date; dryRun: boolean }): void {
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  console.log(colors.muted("  Configuration:"));
  console.log(`    ${symbols.bullet} Source:  ${colors.highlight(config.sourceUsername)}`);
  console.log(`    ${symbols.bullet} Target:  ${colors.muted(config.targetRepoPath)}`);
  console.log(`    ${symbols.bullet} Period:  ${colors.accent(formatDate(config.fromDate))} ${symbols.arrow} ${colors.accent(formatDate(config.toDate))}`);
  if (config.dryRun) {
    console.log(`    ${symbols.bullet} Mode:    ${colors.warning("DRY RUN")}`);
  }
  console.log();
}

export function createSpinner(text: string): Ora {
  return ora({
    text,
    spinner: "dots",
    color: "cyan",
  });
}

export function printPlanHeader(totalCommits: number, totalDays: number): void {
  console.log();
  console.log(`  ${symbols.info} Plan: Create ${colors.highlight(String(totalCommits))} commits across ${colors.highlight(String(totalDays))} days`);
  console.log();
}

export function printPlanItem(item: { date: string; toCreate: number; existing: number; needed: number }): void {
  const bar = colors.primary("█").repeat(Math.min(item.toCreate, 20));
  const existingInfo = item.existing > 0 ? colors.muted(` (${item.existing} existing)`) : "";

  console.log(`    ${colors.muted(item.date)}  ${colors.success(`+${item.toCreate.toString().padStart(2)}`)}  ${bar}${existingInfo}`);
}

export function printSyncedMessage(): void {
  console.log();
  console.log(`  ${symbols.success} ${colors.success("Already in sync!")} No commits needed.`);
  console.log();
}

export function createProgressBar(): cliProgress.SingleBar {
  return new cliProgress.SingleBar(
    {
      format: `  ${colors.primary("{bar}")} ${colors.muted("{percentage}%")} | ${colors.highlight("{value}/{total}")} commits | ${colors.accent("{date}")}`,
      barCompleteChar: "█",
      barIncompleteChar: "░",
      hideCursor: true,
      clearOnComplete: false,
      barsize: 30,
    },
    cliProgress.Presets.shades_classic
  );
}

export function printSuccess(message: string): void {
  console.log(`  ${symbols.success} ${colors.success(message)}`);
}

export function printError(message: string): void {
  console.log(`  ${symbols.error} ${colors.error(message)}`);
}

export function printWarning(message: string): void {
  console.log(`  ${symbols.warning} ${colors.warning(message)}`);
}

export function printInfo(message: string): void {
  console.log(`  ${symbols.info} ${colors.muted(message)}`);
}

export function printDivider(): void {
  console.log(colors.muted("  " + "─".repeat(40)));
}

export async function confirmProceed(message: string): Promise<boolean> {
  process.stdout.write(`\n  ${symbols.warning} ${colors.warning(message)} ${colors.muted("Press Enter to continue, Ctrl+C to cancel...")}`);

  return new Promise((resolve) => {
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.once("data", (data) => {
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
      const key = data.toString();
      if (key === "\r" || key === "\n") {
        console.log();
        resolve(true);
      } else if (key === "\x03") {
        console.log();
        resolve(false);
      } else {
        console.log();
        resolve(true);
      }
    });
  });
}

export { colors, symbols };
