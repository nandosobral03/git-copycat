import { fetchContributions } from "./github";
import { getExistingCommitCounts, createBackdatedCommit, ensureRepo, pushToRemote, cloneRepo, configureGit } from "./git";
import { printBanner, printConfig, printPlanHeader, printPlanItem, printSyncedMessage, printSuccess, printError, printInfo, printWarning, createSpinner, createProgressBar, printDivider, confirmProceed } from "./ui";

interface Config {
  githubToken: string;
  sourceUsername: string;
  targetRepoPath?: string;
  targetRepoUrl?: string;
  fromDate: Date;
  toDate: Date;
  dryRun: boolean;
  autoPush: boolean;
  ci: boolean;
  gitUserName?: string;
  gitUserEmail?: string;
}

function getConfig(): Config {
  const githubToken = process.env.GITHUB_TOKEN;
  const sourceUsername = process.env.SOURCE_USERNAME;
  const targetRepoPath = process.env.TARGET_REPO_PATH;
  const targetRepoUrl = process.env.TARGET_REPO_URL;

  if (!githubToken) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }
  if (!sourceUsername) {
    throw new Error("SOURCE_USERNAME environment variable is required");
  }
  if (!targetRepoPath && !targetRepoUrl) {
    throw new Error("Either TARGET_REPO_PATH or TARGET_REPO_URL environment variable is required");
  }

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - 1);

  if (process.env.FROM_DATE) {
    fromDate.setTime(Date.parse(process.env.FROM_DATE));
  }
  if (process.env.TO_DATE) {
    toDate.setTime(Date.parse(process.env.TO_DATE));
  }

  const dryRun = process.env.DRY_RUN === "true";
  const autoPush = process.env.AUTO_PUSH === "true";
  const ci = process.env.CI === "true";
  const gitUserName = process.env.GIT_USER_NAME;
  const gitUserEmail = process.env.GIT_USER_EMAIL;

  return {
    githubToken,
    sourceUsername,
    targetRepoPath,
    targetRepoUrl,
    fromDate,
    toDate,
    dryRun,
    autoPush,
    ci,
    gitUserName,
    gitUserEmail,
  };
}

interface CommitPlan {
  date: string;
  needed: number;
  existing: number;
  toCreate: number;
}

function calculateCommitPlan(sourceContributions: Map<string, number>, existingCommits: Map<string, number>): CommitPlan[] {
  const plan: CommitPlan[] = [];

  for (const [date, needed] of sourceContributions) {
    const existing = existingCommits.get(date) || 0;
    const toCreate = Math.max(0, needed - existing);

    if (toCreate > 0) {
      plan.push({ date, needed, existing, toCreate });
    }
  }

  plan.sort((a, b) => a.date.localeCompare(b.date));

  return plan;
}

async function main() {
  printBanner();

  const config = getConfig();

  // Resolve target repo path - either use provided path or clone from URL
  let targetRepoPath: string;

  if (config.targetRepoUrl) {
    const cloneSpinner = createSpinner(`Cloning ${config.targetRepoUrl}...`);
    cloneSpinner.start();
    targetRepoPath = await cloneRepo(config.targetRepoUrl, config.githubToken);
    cloneSpinner.succeed("Repository cloned");
  } else {
    targetRepoPath = config.targetRepoPath!;
  }

  printConfig({ ...config, targetRepoPath });
  printDivider();

  const repoSpinner = createSpinner("Checking target repository...");
  repoSpinner.start();
  await ensureRepo(targetRepoPath);
  repoSpinner.succeed("Target repository ready");

  // Configure git user if provided (required for CI)
  if (config.gitUserName && config.gitUserEmail) {
    await configureGit(targetRepoPath, config.gitUserName, config.gitUserEmail);
  }

  const fetchSpinner = createSpinner(`Fetching contributions for ${config.sourceUsername}...`);
  fetchSpinner.start();

  const contributions = await fetchContributions(config.githubToken, config.sourceUsername, config.fromDate, config.toDate);

  const sourceMap = new Map<string, number>();
  for (const day of contributions) {
    sourceMap.set(day.date, day.count);
  }
  fetchSpinner.succeed(`Found ${contributions.length} days with contributions`);

  const analyzeSpinner = createSpinner("Analyzing existing commits...");
  analyzeSpinner.start();

  const existingCommits = await getExistingCommitCounts(targetRepoPath);
  analyzeSpinner.succeed(`Found commits on ${existingCommits.size} days`);

  const plan = calculateCommitPlan(sourceMap, existingCommits);

  if (plan.length === 0) {
    printSyncedMessage();
    return;
  }

  const totalCommits = plan.reduce((sum, p) => sum + p.toCreate, 0);
  printPlanHeader(totalCommits, plan.length);

  for (const item of plan) {
    printPlanItem(item);
  }

  console.log();
  printDivider();

  if (config.dryRun) {
    console.log();
    printWarning("Dry run mode - no commits created");
    printInfo("Remove DRY_RUN=true to create commits");
    console.log();
    return;
  }

  // Skip confirmation in CI mode
  if (!config.ci) {
    const confirmed = await confirmProceed(`About to create ${totalCommits} commits.`);
    if (!confirmed) {
      console.log();
      printInfo("Cancelled by user");
      console.log();
      return;
    }
  } else {
    printInfo("CI mode - skipping confirmation");
    console.log();
  }

  console.log();
  const progressBar = createProgressBar();
  progressBar.start(totalCommits, 0, { date: plan[0].date });

  let created = 0;
  for (const item of plan) {
    for (let i = 0; i < item.toCreate; i++) {
      const message = `Contribution sync: ${item.date} (${i + 1}/${item.toCreate})`;
      await createBackdatedCommit(targetRepoPath, item.date, message);
      created++;
      progressBar.update(created, { date: item.date });
    }
  }

  progressBar.stop();
  console.log();
  printSuccess(`Created ${totalCommits} commits`);

  if (config.autoPush) {
    console.log();
    const pushSpinner = createSpinner("Pushing to remote...");
    pushSpinner.start();
    await pushToRemote(targetRepoPath);
    pushSpinner.succeed("Pushed to remote");
  } else {
    console.log();
    printInfo("Run with AUTO_PUSH=true to automatically push");
  }

  console.log();
}

main().catch((error) => {
  printError(error.message);
  process.exit(1);
});
