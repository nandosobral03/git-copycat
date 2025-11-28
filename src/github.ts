import { Octokit } from "octokit";

export interface ContributionDay {
  date: string;
  count: number;
}

const CONTRIBUTIONS_QUERY = `
  query($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

interface ContributionsResponse {
  user: {
    contributionsCollection: {
      contributionCalendar: {
        weeks: {
          contributionDays: {
            date: string;
            contributionCount: number;
          }[];
        }[];
      };
    };
  };
}

export async function fetchContributions(token: string, username: string, from: Date, to: Date): Promise<ContributionDay[]> {
  const octokit = new Octokit({ auth: token });

  const response = await octokit.graphql<ContributionsResponse>(CONTRIBUTIONS_QUERY, {
    username,
    from: from.toISOString(),
    to: to.toISOString(),
  });

  const days: ContributionDay[] = [];
  const weeks = response.user.contributionsCollection.contributionCalendar.weeks;

  for (const week of weeks) {
    for (const day of week.contributionDays) {
      if (day.contributionCount > 0) {
        days.push({
          date: day.date,
          count: day.contributionCount,
        });
      }
    }
  }

  return days;
}
