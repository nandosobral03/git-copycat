import { $ } from "bun";

export interface CommitCount {
  date: string;
  count: number;
}

export async function getExistingCommitCounts(repoPath: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  try {
    const result = await $`git -C ${repoPath} log --format=%ad --date=short`.text();

    const dates = result.trim().split("\n").filter(Boolean);

    for (const date of dates) {
      counts.set(date, (counts.get(date) || 0) + 1);
    }
  } catch (error) {
    console.log("No existing commits found or repository is empty");
  }

  return counts;
}

export async function createBackdatedCommit(repoPath: string, date: string, message: string): Promise<void> {
  const dateTime = `${date}T12:00:00`;

  await $`git -C ${repoPath} commit --allow-empty -m ${message} --date ${dateTime}`
    .env({
      ...process.env,
      GIT_AUTHOR_DATE: dateTime,
      GIT_COMMITTER_DATE: dateTime,
    })
    .quiet();
}

export async function createCommitsForDay(repoPath: string, date: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const message = `Contribution sync: ${date} (${i + 1}/${count})`;
    await createBackdatedCommit(repoPath, date, message);
  }
}

export async function ensureRepo(repoPath: string): Promise<void> {
  try {
    await $`git -C ${repoPath} rev-parse --git-dir`.quiet();
  } catch {
    console.log(`Initializing new git repository at ${repoPath}`);
    await $`git -C ${repoPath} init`.quiet();
  }
}

export async function pushToRemote(repoPath: string, remote: string = "origin", branch: string = "main"): Promise<void> {
  await $`git -C ${repoPath} push ${remote} ${branch}`;
}
