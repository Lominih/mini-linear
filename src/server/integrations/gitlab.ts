import { prisma } from "@/server/prisma";

const GITLAB_CLIENT_ID = process.env.GITLAB_CLIENT_ID ?? "";
const GITLAB_CLIENT_SECRET = process.env.GITLAB_CLIENT_SECRET ?? "";
const GITLAB_API_BASE = process.env.GITLAB_API_BASE_URL ?? "https://gitlab.com/api/v4";
const GITLAB_AUTH_URL = process.env.GITLAB_AUTH_URL ?? "https://gitlab.com";

export interface GitLabOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email: string;
  avatar_url: string;
}

export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  default_branch: string;
  visibility: string;
}

export interface GitLabIssue {
  iid: number;
  title: string;
  description: string;
  state: string;
  labels: string[];
}

export function getGitLabOAuthConfig(): GitLabOAuthConfig {
  return { clientId: GITLAB_CLIENT_ID, clientSecret: GITLAB_CLIENT_SECRET };
}

export function getGitLabAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GITLAB_CLIENT_ID,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/auth/gitlab/callback`,
    scope: "api read_user",
    state,
    response_type: "code",
  });
  return `${GITLAB_AUTH_URL}/oauth/authorize?${params.toString()}`;
}

export async function exchangeGitLabCode(code: string): Promise<{ access_token: string; token_type: string; scope: string }> {
  const response = await fetch(`${GITLAB_AUTH_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GITLAB_CLIENT_ID,
      client_secret: GITLAB_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/auth/gitlab/callback`,
    }),
  });
  return response.json() as Promise<{ access_token: string; token_type: string; scope: string }>;
}

export async function getGitLabUser(accessToken: string): Promise<GitLabUser> {
  return (await gitlabFetch("/user", accessToken)) as GitLabUser;
}

export async function listGitLabProjects(
  accessToken: string,
  options?: { membership?: boolean; per_page?: number },
): Promise<GitLabProject[]> {
  const params = new URLSearchParams({
    membership: String(options?.membership ?? true),
    per_page: String(options?.per_page ?? 20),
    order_by: "last_activity_at",
    sort: "desc",
  });
  const projects = await gitlabFetch(`/projects?${params.toString()}`, accessToken);
  return projects as GitLabProject[];
}

export async function getGitLabProject(
  accessToken: string,
  projectId: string,
): Promise<GitLabProject> {
  return (await gitlabFetch(`/projects/${encodeURIComponent(projectId)}`, accessToken)) as GitLabProject;
}

export async function syncGitLabIssues(
  accessToken: string,
  projectId: string,
  projectPath: string,
): Promise<number> {
  const issues = (await gitlabFetch(
    `/projects/${encodeURIComponent(projectPath)}/issues?state=all&per_page=100`,
    accessToken,
  )) as GitLabIssue[];
  let count = 0;
  for (const issue of issues) {
    const exists = await prisma.issue.findFirst({
      where: { projectId, externalId: String(issue.iid) },
    });
    if (!exists) {
      await prisma.issue.create({
        data: {
          projectId,
          title: issue.title,
          description: issue.description ?? "",
          status: issue.state === "closed" ? "DONE" : "TODO",
          externalId: String(issue.iid),
          source: "gitlab",
        },
      });
      count++;
    }
  }
  return count;
}

async function gitlabFetch(
  path: string,
  accessToken: string,
  options?: RequestInit,
): Promise<unknown> {
  const response = await fetch(`${GITLAB_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
export async function linkGitLabMR(
  accessToken: string,
  projectId: string,
  issueId: string,
  mrIid: number,
): Promise<void> {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) throw new Error("Issue not found");
  await prisma.issue.update({
    where: { id: issueId },
    data: {
      externalPrNumber: mrIid,
      externalPrUrl: `${GITLAB_API_BASE}/projects/${projectId}/merge_requests/${mrIid}`,
    },
  });
}