import { prisma } from "@/server/prisma";
import { TRPCError } from "@trpc/server";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GitHubOAuthToken {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<{ name: string; color: string }>;
  assignee: { login: string } | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request?: unknown;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed" | "merged";
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_AUTH_URL = "https://github.com/login/oauth";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? "";

// ─── OAuth ───────────────────────────────────────────────────────────────────

/**
 * Build the GitHub OAuth authorization URL.
 */
export function getGitHubAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/auth/github/callback,
    scope: "repo read:user user:email",
    state,
  });
  return ${GITHUB_AUTH_URL}/authorize?;
}

/**
 * Exchange the OAuth code for an access token.
 */
export async function exchangeGitHubCode(code: string): Promise<GitHubOAuthToken> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to exchange GitHub authorization code",
    });
  }

  const data = (await response.json()) as GitHubOAuthToken & { error?: string; error_description?: string };

  if (data.error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: data.error_description ?? data.error,
    });
  }

  return data;
}

/**
 * Fetch the authenticated GitHub user profile.
 */
export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await githubFetch("/user", accessToken);
  return response as GitHubUser;
}

// ─── Repository Operations ───────────────────────────────────────────────────

/**
 * List repositories accessible to the authenticated user.
 */
export async function listGitHubRepos(
  accessToken: string,
  options?: { page?: number; perPage?: number; type?: "all" | "owner" | "member" },
): Promise<GitHubRepo[]> {
  const params = new URLSearchParams({
    page: String(options?.page ?? 1),
    per_page: String(options?.perPage ?? 30),
    sort: "updated",
    direction: "desc",
  });
  if (options?.type) params.set("type", options.type);

  const repos = await githubFetch(/user/repos?, accessToken);
  return repos as GitHubRepo[];
}

/**
 * Get a specific repository.
 */
export async function getGitHubRepo(
  accessToken: string,
  owner: string,
  repo: string,
): Promise<GitHubRepo> {
  return (await githubFetch(/repos//, accessToken)) as GitHubRepo;
}

// ─── Issue Sync ──────────────────────────────────────────────────────────────

/**
 * Sync issues from a GitHub repository into Mini Linear issues.
 * Maps GitHub issues to Mini Linear issues based on labels and state.
 */
export async function syncGitHubIssues(
  integrationId: string,
  repoOwner: string,
  repoName: string,
  projectId: string,
): Promise<SyncResult> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.accessToken) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Integration not found or missing access token",
    });
  }

  const accessToken = integration.accessToken;
  const result: SyncResult = { synced: 0, created: 0, updated: 0, errors: [] };

  try {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const ghIssues = await githubFetch(
        /repos///issues?state=all&per_page=100&page=,
        accessToken,
      );

      const issues = ghIssues as GitHubIssue[];
      if (issues.length === 0) {
        hasMore = false;
        break;
      }

      for (const ghIssue of issues) {
        // Skip pull requests (they show up as issues in the API)
        if (ghIssue.pull_request) continue;

        try {
          const status = ghIssue.state === "closed" ? "DONE" : "TODO";
          const labels = ghIssue.labels.map((l) => l.name);

          // Check if we already have this issue synced (by external ID in customFields)
          const existing = await prisma.issue.findFirst({
            where: {
              projectId,
              customFields: { contains: "githubIssueId": },
            },
          });

          if (existing) {
            await prisma.issue.update({
              where: { id: existing.id },
              data: {
                title: ghIssue.title,
                description: ghIssue.body ?? undefined,
                status: status as never,
                labels: JSON.stringify(labels),
              },
            });
            result.updated++;
          } else {
            // Find a reporter in the project or fall back to project owner
            const project = await prisma.project.findUnique({
              where: { id: projectId },
              select: { ownerId: true },
            });

            await prisma.issue.create({
              data: {
                title: ghIssue.title,
                description: ghIssue.body ?? undefined,
                status: status as never,
                priority: "NONE",
                labels: JSON.stringify(labels),
                reporterId: project?.ownerId ?? "system",
                projectId,
                customFields: JSON.stringify({
                  githubIssueId: ghIssue.id,
                  githubIssueNumber: ghIssue.number,
                  githubUrl: ghIssue.html_url,
                  source: "github",
                }),
              },
            });
            result.created++;
          }

          result.synced++;
        } catch (err) {
          result.errors.push(
            Failed to sync issue #: ,
          );
        }
      }

      page++;
      if (issues.length < 100) hasMore = false;
    }

    // Update last sync timestamp
    await prisma.integration.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date() },
    });
  } catch (err) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: GitHub sync failed: ,
    });
  }

  return result;
}

// ─── Pull Request Linking ────────────────────────────────────────────────────

/**
 * Link a GitHub pull request to a Mini Linear issue.
 * Parses issue references (e.g., "Fixes ML-42") from PR body.
 */
export async function linkGitHubPR(
  accessToken: string,
  repoOwner: string,
  repoName: string,
  prNumber: number,
  projectId: string,
): Promise<{ linked: boolean; issueId?: string }> {
  const pr = (await githubFetch(
    /repos///pulls/,
    accessToken,
  )) as GitHubPullRequest;

  // Extract issue references from PR body
  const issueRefs = extractIssueReferences(pr.body ?? "");

  if (issueRefs.length === 0) {
    return { linked: false };
  }

  let linkedIssueId: string | undefined;

  for (const ref of issueRefs) {
    // Try to find a matching issue in Mini Linear
    const issue = await prisma.issue.findFirst({
      where: {
        projectId,
        OR: [
          { title: { contains: ref } },
          { customFields: { contains: "githubIssueNumber": } },
        ],
      },
    });

    if (issue) {
      // Update the issue's custom fields to include PR link
      const customFields = parseCustomFields(issue.customFields);
      const linkedPRs = (customFields.linkedPRs as number[] | undefined) ?? [];
      if (!linkedPRs.includes(prNumber)) {
        linkedPRs.push(prNumber);
      }

      await prisma.issue.update({
        where: { id: issue.id },
        data: {
          customFields: JSON.stringify({
            ...customFields,
            linkedPRs,
            lastPRSyncAt: new Date().toISOString(),
          }),
        },
      });

      linkedIssueId = issue.id;
    }
  }

  return { linked: !!linkedIssueId, issueId: linkedIssueId };
}

/**
 * Get all PRs linked to a Mini Linear issue.
 */
export async function getLinkedPRs(
  accessToken: string,
  repoOwner: string,
  repoName: string,
  issueId: string,
): Promise<GitHubPullRequest[]> {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
  });

  if (!issue) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
  }

  const customFields = parseCustomFields(issue.customFields);
  const linkedPRNumbers = (customFields.linkedPRs as number[] | undefined) ?? [];

  if (linkedPRNumbers.length === 0) return [];

  const prs: GitHubPullRequest[] = [];
  for (const prNumber of linkedPRNumbers) {
    try {
      const pr = (await githubFetch(
        /repos///pulls/,
        accessToken,
      )) as GitHubPullRequest;
      prs.push(pr);
    } catch {
      // PR may have been deleted or is inaccessible
    }
  }

  return prs;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Make an authenticated request to the GitHub API.
 */
async function githubFetch(path: string, accessToken: string): Promise<unknown> {
  const response = await fetch(${GITHUB_API_BASE}, {
    headers: {
      Authorization: Bearer ,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: GitHub API error (): ,
    });
  }

  return response.json();
}

/**
 * Extract issue number references from text.
 * Matches patterns like "ML-42", "#42", "fixes #42", "closes 42".
 */
function extractIssueReferences(text: string): number[] {
  const patterns = [
    /(?:fixes|closes|resolves|refs?)\s+#?(\d+)/gi,
    /(?:ML|DEV|PROJ)-(\d+)/gi,
  ];

  const refs = new Set<number>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) refs.add(num);
    }
  }

  return Array.from(refs);
}

/**
 * Parse JSON custom fields string safely.
 */
function parseCustomFields(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed;
    return {};
  } catch {
    return {};
  }
}
