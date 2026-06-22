import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import {
  getGitHubAuthUrl,
  exchangeGitHubCode,
  getGitHubUser,
  listGitHubRepos,
  syncGitHubIssues,
  linkGitHubPR,
  getLinkedPRs,
} from "@/server/integrations/github";
import {
  getGitLabAuthUrl,
  exchangeGitLabCode,
  getGitLabUser,
  listGitLabProjects,
  syncGitLabIssues,
  linkGitLabMR,
} from "@/server/integrations/gitlab";
import { randomBytes } from "crypto";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const connectGitHubSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
  projectId: z.string().min(1, "Project ID is required"),
  state: z.string().optional(),
});

const connectGitLabSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
  projectId: z.string().min(1, "Project ID is required"),
  state: z.string().optional(),
});

const listReposSchema = z.object({
  integrationId: z.string().min(1),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(30),
});

const syncIssuesSchema = z.object({
  integrationId: z.string().min(1),
  repoOwner: z.string().optional(),
  repoName: z.string().optional(),
  gitlabProjectId: z.number().optional(),
});

const linkPRSchema = z.object({
  integrationId: z.string().min(1),
  repoOwner: z.string().optional(),
  repoName: z.string().optional(),
  prNumber: z.number().int().min(1),
  projectId: z.string().min(1),
});

const linkMRSchema = z.object({
  integrationId: z.string().min(1),
  gitlabProjectId: z.number().int().min(1),
  mrIid: z.number().int().min(1),
  projectId: z.string().min(1),
});

const getLinkedPRsSchema = z.object({
  integrationId: z.string().min(1),
  repoOwner: z.string(),
  repoName: z.string(),
  issueId: z.string().min(1),
});

// ─── Router ──────────────────────────────────────────────────────────────────

export const integrationRouter = router({
  /**
   * Get the OAuth authorization URL for GitHub.
   */
  getGitHubAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const state = randomBytes(16).toString("hex");
    const url = getGitHubAuthUrl(state);
    return { url, state };
  }),

  /**
   * Connect a GitHub account using the OAuth code.
   */
  connectGitHub: protectedProcedure
    .input(connectGitHubSchema)
    .mutation(async ({ ctx, input }) => {
      // Exchange code for token
      const tokenData = await exchangeGitHubCode(input.code);
      const githubUser = await getGitHubUser(tokenData.access_token);

      // Check for existing integration
      const existing = await ctx.prisma.integration.findUnique({
        where: {
          provider_userId_projectId: {
            provider: "GITHUB",
            userId: ctx.user.userId,
            projectId: input.projectId,
          },
        },
      });

      if (existing) {
        // Update existing integration
        const updated = await ctx.prisma.integration.update({
          where: { id: existing.id },
          data: {
            accessToken: tokenData.access_token,
            providerId: String(githubUser.id),
            providerName: githubUser.login,
            status: "CONNECTED",
            config: JSON.stringify({
              login: githubUser.login,
              email: githubUser.email,
              avatarUrl: githubUser.avatar_url,
            }),
          },
        });
        return updated;
      }

      // Create new integration
      const integration = await ctx.prisma.integration.create({
        data: {
          provider: "GITHUB",
          userId: ctx.user.userId,
          projectId: input.projectId,
          accessToken: tokenData.access_token,
          providerId: String(githubUser.id),
          providerName: githubUser.login,
          status: "CONNECTED",
          config: JSON.stringify({
            login: githubUser.login,
            email: githubUser.email,
            avatarUrl: githubUser.avatar_url,
          }),
        },
      });

      return integration;
    }),

  /**
   * Get the OAuth authorization URL for GitLab.
   */
  getGitLabAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const state = randomBytes(16).toString("hex");
    const url = getGitLabAuthUrl(state);
    return { url, state };
  }),

  /**
   * Connect a GitLab account using the OAuth code.
   */
  connectGitLab: protectedProcedure
    .input(connectGitLabSchema)
    .mutation(async ({ ctx, input }) => {
      const tokenData = await exchangeGitLabCode(input.code);
      const gitlabUser = await getGitLabUser(tokenData.access_token);

      const existing = await ctx.prisma.integration.findUnique({
        where: {
          provider_userId_projectId: {
            provider: "GITLAB",
            userId: ctx.user.userId,
            projectId: input.projectId,
          },
        },
      });

      if (existing) {
        const updated = await ctx.prisma.integration.update({
          where: { id: existing.id },
          data: {
            accessToken: tokenData.access_token,
            providerId: String(gitlabUser.id),
            providerName: gitlabUser.username,
            status: "CONNECTED",
            config: JSON.stringify({
              username: gitlabUser.username,
              email: gitlabUser.email,
              avatarUrl: gitlabUser.avatar_url,
            }),
          },
        });
        return updated;
      }

      const integration = await ctx.prisma.integration.create({
        data: {
          provider: "GITLAB",
          userId: ctx.user.userId,
          projectId: input.projectId,
          accessToken: tokenData.access_token,
          providerId: String(gitlabUser.id),
          providerName: gitlabUser.username,
          status: "CONNECTED",
          config: JSON.stringify({
            username: gitlabUser.username,
            email: gitlabUser.email,
            avatarUrl: gitlabUser.avatar_url,
          }),
        },
      });

      return integration;
    }),

  /**
   * List all integrations for the current user and optionally a project.
   */
  listIntegrations: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        provider: z.enum(["GITHUB", "GITLAB"]).optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        userId: ctx.user.userId,
      };
      if (input?.projectId) where.projectId = input.projectId;
      if (input?.provider) where.provider = input.provider;

      const integrations = await ctx.prisma.integration.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, key: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Strip access tokens from response
      return integrations.map((i) => ({
        ...i,
        accessToken: undefined,
        refreshToken: undefined,
      }));
    }),

  /**
   * List available repositories/projects for a connected integration.
   */
  listRepos: protectedProcedure
    .input(listReposSchema)
    .query(async ({ ctx, input }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: { id: input.integrationId },
      });

      if (!integration) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Integration not found" });
      }
      if (integration.userId !== ctx.user.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your integration" });
      }
      if (!integration.accessToken) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Integration has no access token" });
      }

      if (integration.provider === "GITHUB") {
        const repos = await listGitHubRepos(integration.accessToken, {
          page: input.page,
          perPage: input.perPage,
        });
        return { repos, provider: "GITHUB" as const };
      }

      if (integration.provider === "GITLAB") {
        const projects = await listGitLabProjects(integration.accessToken, {
          page: input.page,
          perPage: input.perPage,
          membership: true,
        });
        return { repos: projects, provider: "GITLAB" as const };
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown provider" });
    }),

  /**
   * Sync issues from an external repo into Mini Linear.
   */
  syncNow: protectedProcedure
    .input(syncIssuesSchema)
    .mutation(async ({ ctx, input }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: { id: input.integrationId },
        select: { id: true, userId: true, projectId: true, provider: true, accessToken: true },
      });

      if (!integration) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Integration not found" });
      }
      if (integration.userId !== ctx.user.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your integration" });
      }

      if (integration.provider === "GITHUB") {
        if (!input.repoOwner || !input.repoName) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "repoOwner and repoName are required for GitHub sync",
          });
        }
        return syncGitHubIssues(
          input.integrationId,
          input.repoOwner,
          input.repoName,
          integration.projectId,
        );
      }

      if (integration.provider === "GITLAB") {
        if (!input.gitlabProjectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "gitlabProjectId is required for GitLab sync",
          });
        }
        return syncGitLabIssues(
          input.integrationId,
          input.gitlabProjectId,
          integration.projectId,
        );
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown provider" });
    }),

  /**
   * Link a GitHub pull request to an issue.
   */
  linkGitHubPR: protectedProcedure
    .input(linkPRSchema)
    .mutation(async ({ ctx, input }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: { id: input.integrationId },
      });

      if (!integration || integration.userId !== ctx.user.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Integration not found" });
      }
      if (!integration.accessToken) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No access token" });
      }
      if (!input.repoOwner || !input.repoName) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "repoOwner and repoName are required" });
      }

      return linkGitHubPR(
        integration.accessToken,
        input.repoOwner,
        input.repoName,
        input.prNumber,
        input.projectId,
      );
    }),

  /**
   * Link a GitLab merge request to an issue.
   */
  linkGitLabMR: protectedProcedure
    .input(linkMRSchema)
    .mutation(async ({ ctx, input }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: { id: input.integrationId },
      });

      if (!integration || integration.userId !== ctx.user.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Integration not found" });
      }
      if (!integration.accessToken) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No access token" });
      }

      return linkGitLabMR(
        integration.accessToken,
        input.gitlabProjectId,
        input.mrIid,
        input.projectId,
      );
    }),

  /**
   * Get PRs linked to a Mini Linear issue.
   */
  getLinkedPRs: protectedProcedure
    .input(getLinkedPRsSchema)
    .query(async ({ ctx, input }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: { id: input.integrationId },
      });

      if (!integration || integration.userId !== ctx.user.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Integration not found" });
      }
      if (!integration.accessToken) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No access token" });
      }

      return getLinkedPRs(
        integration.accessToken,
        input.repoOwner,
        input.repoName,
        input.issueId,
      );
    }),

  /**
   * Disconnect an integration.
   */
  disconnect: protectedProcedure
    .input(z.object({ integrationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: { id: input.integrationId },
      });

      if (!integration) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Integration not found" });
      }
      if (integration.userId !== ctx.user.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your integration" });
      }

      await ctx.prisma.integration.delete({
        where: { id: input.integrationId },
      });

      return { success: true };
    }),
});
