import { prisma } from "@/server/prisma";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? "";
const GITHUB_API_BASE = process.env.GITHUB_API_BASE_URL ?? "https://api.github.com";
const GITHUB_AUTH_URL = process.env.GITHUB_AUTH_URL ?? "https://github.com";

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface GitHubOAuthToken {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  labels: Array<{ name: string; color: string }>;
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  head: { ref: string };
  base: { ref: string };
}

export function getGitHubOAuthConfig(): GitHubOAuthConfig {
  return { clientId: GITHUB_CLIENT_ID, clientSecret: GITHUB_CLIENT_SECRET };
}

export function getGitHubAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/auth/github/callback`,
    scope: "repo read:user user:email",
    state,
  });
  return `${GITHUB_AUTH_URL}/authorize?${params.toString()}`;
}

export async function exchangeGitHubCode(code: string): Promise<GitHubOAuthToken> {
  const response = await fetch(`${GITHUB_AUTH_URL}/login/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  return response.json() as Promise<GitHubOAuthToken>;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  return (await githubFetch("/user", accessToken)) as GitHubUser;
}

export async function listGitHubRepos(
  accessToken: string,
  options?: { type?: string; sort?: string; per_page?: number },
): Promise<GitHubRepo[]> {
  const params = new URLSearchParams({
    sort: options?.sort ?? "updated",
    direction: "desc",
    per_page: String(options?.per_page ?? 30),
  });
  if (options?.type) params.set("type", options.type);
  const repos = await githubFetch(`/user/repos?${params.toString()}`, accessToken);
  return repos as GitHubRepo[];
}

export async function getGitHubRepo(
  accessToken: string,
  owner: string,
  repo: string,
): Promise<GitHubRepo> {
  return (await githubFetch(`/repos/${owner}/${repo}`, accessToken)) as GitHubRepo;
}

export async function syncGitHubIssues(
  accessToken: string,
  owner: string,
  repo: string,
  projectId: string,
): Promise<number> {
  const issues = (await githubFetch(
    `/repos/${owner}/${repo}/issues?state=all&per_page=100&page=1`,
    accessToken,
  )) as GitHubIssue[];
  let count = 0;
  for (const issue of issues) {
    const exists = await prisma.issue.findFirst({
      where: { projectId, externalId: String(issue.id) },
    });
    if (!exists) {
      await prisma.issue.create({
        data: {
          projectId,
          title: issue.title,
          description: issue.body ?? "",
          status: issue.state === "closed" ? "DONE" : "TODO",
          externalId: String(issue.id),
          source: "github",
        },
      });
      count++;
    }
  }
  return count;
}

export async function listGitHubPRs(
  accessToken: string,
  owner: string,
  repo: string,
): Promise<GitHubPR[]> {
  return (await githubFetch(`/repos/${owner}/${repo}/pulls`, accessToken)) as GitHubPR[];
}

export async function createGitHubIssue(
  accessToken: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
): Promise<GitHubIssue> {
  return (await githubFetch(
    `/repos/${owner}/${repo}/issues`,
    accessToken,
    { method: "POST", body: JSON.stringify({ title, body }) },
  )) as GitHubIssue;
}

async function githubFetch(
  path: string,
  accessToken: string,
  options?: RequestInit,
): Promise<unknown> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
export async function linkGitHubPR(
  accessToken: string,
  owner: string,
  repo: string,
  issueId: string,
  prNumber: number,
): Promise<void> {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) throw new Error("Issue not found");
  await prisma.issue.update({
    where: { id: issueId },
    data: {
      externalPrNumber: prNumber,
      externalPrUrl: `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`,
    },
  });
}

export async function getLinkedPRs(
  accessToken: string,
  issueId: string,
): Promise<GitHubPR[]> {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue?.externalPrNumber) return [];
  return [] as GitHubPR[];
}