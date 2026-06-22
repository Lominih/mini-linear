import { prisma } from "@/server/prisma";
import { TRPCError } from "@trpc/server";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email: string;
  avatar_url: string;
  web_url: string;
}

export interface GitLabProject {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  web_url: string;
  description: string | null;
  default_branch: string;
  visibility: "public" | "internal" | "private";
}

export interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: "opened" | "closed";
  labels: string[];
  assignees: Array<{ username: string; name: string }>;
  created_at: string;
  updated_at: string;
  web_url: string;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: "opened" | "closed" | "merged";
  source_branch: string;
  target_branch: string;
  web_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitLabSyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GITLAB_API_BASE = process.env.GITLAB_API_URL ?? "https://gitlab.com/api/v4";
const GITLAB_CLIENT_ID = process.env.GITLAB_CLIENT_ID ?? "";
const GITLAB_CLIENT_SECRET = process.env.GITLAB_CLIENT_SECRET ?? "";
const GITLAB_AUTH_URL = process.env.GITLAB_URL ?? "https://gitlab.com";

// ─── OAuth ───────────────────────────────────────────────────────────────────

/**
 * Build the GitLab OAuth authorization URL.
 */
export function getGitLabAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GITLAB_CLIENT_ID,
    redirect_uri: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/auth/gitlab/callback,
    scope: "api read_user",
    state,
    response_type: "code",
  });
  return ${GITLAB_AUTH_URL}/oauth/authorize?;
}

/**
 * Exchange the OAuth code for an access token.
 */
export async function exchangeGitLabCode(code: string): Promise<{ access_token: string; token_type: string; scope: string }> {
  const response = await fetch(${GITLAB_AUTH_URL}/oauth/token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITLAB_CLIENT_ID,
      client_secret: GITLAB_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/auth/gitlab/callback,
    }),
  });

  if (!response.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to exchange GitLab authorization code",
    });
  }

  const data = (await response.json()) as { access_token: string; token_type: string; scope: string; error?: string; error_description?: string };

  if (data.error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: data.error_description ?? data.error,
    });
  }

  return data;
}

/**
 * Fetch the authenticated GitLab user profile.
 */
export async function getGitLabUser(accessToken: string): Promise<GitLabUser> {
  return (await gitlabFetch("/user", accessToken)) as GitLabUser;
}

// ─── Project Operations ──────────────────────────────────────────────────────

/**
 * List projects accessible to the authenticated user.
 */
export async function listGitLabProjects(
  accessToken: string,
  options?: { page?: number; perPage?: number; owned?: boolean; membership?: boolean },
): Promise<GitLabProject[]> {
  const params = new URLSearchParams({
    page: String(options?.page ?? 1),
    per_page: String(options?.perPage ?? 20),
    order_by: "last_activity_at",
    sort: "desc",
  });
  if (options?.owned) params.set("owned", "true");
  if (options?.membership) params.set("membership", "true");

  const projects = await gitlabFetch(/projects?, accessToken);
  return projects as GitLabProject[];
}

/**
 * Get a specific project by ID or path.
 */
export async function getGitLabProject(
  accessToken: string,
  projectId: number,
): Promise<GitLabProject> {
  return (await gitlabFetch(/projects/, accessToken)) as GitLabProject;
}

// ─── Issue Sync ──────────────────────────────────────────────────────────────

/**
 * Sync issues from a GitLab project into Mini Linear issues.
 */
export async function syncGitLabIssues(
  integrationId: string,
  gitlabProjectId: number,
  projectId: string,
): Promise<GitLabSyncResult> {
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
  const result: GitLabSyncResult = { synced: 0, created: 0, updated: 0, errors: [] };

  try {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const issues = (await gitlabFetch(
        /projects//issues?state=all&per_page=100&page=,
        accessToken,
      )) as GitLabIssue[];

      if (issues.length === 0) {
        hasMore = false;
        break;
      }

      for (const glIssue of issues) {
        try {
          const status = glIssue.state === "closed" ? "DONE" : "TODO";
          const labels = glIssue.labels;

          const existing = await prisma.issue.findFirst({
            where: {
              projectId,
              customFields: { contains: "gitlabIssueId": },
            },
          });

          if (existing) {
            await prisma.issue.update({
              where: { id: existing.id },
              data: {
                title: glIssue.title,
                description: glIssue.description ?? undefined,
                status: status as never,
                labels: JSON.stringify(labels),
              },
            });
            result.updated++;
          } else {
            const project = await prisma.project.findUnique({
              where: { id: projectId },
              select: { ownerId: true },
            });

            await prisma.issue.create({
              data: {
                title: glIssue.title,
                description: glIssue.description ?? undefined,
                status: status as never,
                priority: "NONE",
                labels: JSON.stringify(labels),
                reporterId: project?.ownerId ?? "system",
                projectId,
                customFields: JSON.stringify({
                  gitlabIssueId: glIssue.id,
                  gitlabIssueIid: glIssue.iid,
                  gitlabUrl: glIssue.web_url,
                  source: "gitlab",
                }),
              },
            });
            result.created++;
          }

          result.synced++;
        } catch (err) {
          result.errors.push(
            Failed to sync issue !: ,
          );
        }
      }

      page++;
      if (issues.length < 100) hasMore = false;
    }

    await prisma.integration.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date() },
    });
  } catch (err) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: GitLab sync failed: ,
    });
  }

  return result;
}

// ─── Merge Request Linking ───────────────────────────────────────────────────

/**
 * Link a GitLab merge request to a Mini Linear issue.
 */
export async function linkGitLabMR(
  accessToken: string,
  gitlabProjectId: number,
  mrIid: number,
  projectId: string,
): Promise<{ linked: boolean; issueId?: string }> {
  const mr = (await gitlabFetch(
    /projects//merge_requests/,
    accessToken,
  )) as GitLabMergeRequest;

  const issueRefs = extractIssueReferences(mr.description ?? "");

  if (issueRefs.length === 0) {
    return { linked: false };
  }

  let linkedIssueId: string | undefined;

  for (const ref of issueRefs) {
    const issue = await prisma.issue.findFirst({
      where: {
        projectId,
        OR: [
          { title: { contains: ref } },
          { customFields: { contains: "gitlabIssueIid": } },
        ],
      },
    });

    if (issue) {
      const customFields = parseCustomFields(issue.customFields);
      const linkedMRs = (customFields.linkedMRs as number[] | undefined) ?? [];
      if (!linkedMRs.includes(mrIid)) {
        linkedMRs.push(mrIid);
      }

      await prisma.issue.update({
        where: { id: issue.id },
        data: {
          customFields: JSON.stringify({
            ...customFields,
            linkedMRs,
            lastMRSyncAt: new Date().toISOString(),
          }),
        },
      });

      linkedIssueId = issue.id;
    }
  }

  return { linked: !!linkedIssueId, issueId: linkedIssueId };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Make an authenticated request to the GitLab API.
 */
async function gitlabFetch(path: string, accessToken: string): Promise<unknown> {
  const response = await fetch(${GITLAB_API_BASE}, {
    headers: {
      Authorization: Bearer ,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: GitLab API error (): ,
    });
  }

  return response.json();
}

/**
 * Extract issue number references from text.
 * Matches patterns like "ML-42", "#42", "fixes #42".
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
