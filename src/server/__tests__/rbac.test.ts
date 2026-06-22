import { describe, it, expect, vi, beforeEach } from "vitest";
const SystemRole = { OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER', VIEWER: 'VIEWER' } as const;
type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];
const ProjectMemberRole = { OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER', VIEWER: 'VIEWER' } as const;
type ProjectMemberRole = (typeof ProjectMemberRole)[keyof typeof ProjectMemberRole];

// Mock prisma before importing rbac
vi.mock("@/server/prisma", () => ({
  prisma: {},
}));

import { checkPermission } from "@/server/rbac";

const mockPrisma = {
  user: { findUnique: vi.fn() },
  projectMember: { findUnique: vi.fn() },
};

// 鈹€鈹€鈹€ System Role Hierarchy (pure, no DB) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

import { hasRole, hasProjectRole, getProjectPermissions } from "@/server/rbac";

describe("hasRole", () => {
  it("OWNER meets OWNER requirement", () => {
    expect(hasRole(SystemRole.OWNER, SystemRole.OWNER)).toBe(true);
  });

  it("ADMIN does not meet OWNER requirement", () => {
    expect(hasRole(SystemRole.ADMIN, SystemRole.OWNER)).toBe(false);
  });

  it("OWNER meets VIEWER requirement", () => {
    expect(hasRole(SystemRole.OWNER, SystemRole.VIEWER)).toBe(true);
  });

  it("VIEWER meets VIEWER requirement", () => {
    expect(hasRole(SystemRole.VIEWER, SystemRole.VIEWER)).toBe(true);
  });

  it("MEMBER does not meet ADMIN requirement", () => {
    expect(hasRole(SystemRole.MEMBER, SystemRole.ADMIN)).toBe(false);
  });

  it("ADMIN meets MEMBER requirement", () => {
    expect(hasRole(SystemRole.ADMIN, SystemRole.MEMBER)).toBe(true);
  });
});

// 鈹€鈹€鈹€ Project Role Hierarchy 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

describe("hasProjectRole", () => {
  it("OWNER meets OWNER requirement", () => {
    expect(hasProjectRole(ProjectMemberRole.OWNER, ProjectMemberRole.OWNER)).toBe(true);
  });

  it("ADMIN does not meet OWNER requirement", () => {
    expect(hasProjectRole(ProjectMemberRole.ADMIN, ProjectMemberRole.OWNER)).toBe(false);
  });

  it("MEMBER meets VIEWER requirement", () => {
    expect(hasProjectRole(ProjectMemberRole.MEMBER, ProjectMemberRole.VIEWER)).toBe(true);
  });

  it("VIEWER does not meet MEMBER requirement", () => {
    expect(hasProjectRole(ProjectMemberRole.VIEWER, ProjectMemberRole.MEMBER)).toBe(false);
  });

  it("ADMIN meets MEMBER requirement", () => {
    expect(hasProjectRole(ProjectMemberRole.ADMIN, ProjectMemberRole.MEMBER)).toBe(true);
  });
});

// 鈹€鈹€鈹€ Get Project Permissions 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

describe("getProjectPermissions", () => {
  it("OWNER gets all permission categories", () => {
    const perms = getProjectPermissions(ProjectMemberRole.OWNER);
    expect(perms).toContain("project.create");
    expect(perms).toContain("project.delete");
    expect(perms).toContain("issue.create");
    expect(perms).toContain("issue.delete");
    expect(perms).toContain("sprint.create");
    expect(perms).toContain("sprint.delete");
    expect(perms).toContain("comment.create");
    expect(perms).toContain("comment.delete");
  });

  it("ADMIN can manage but not delete projects", () => {
    const perms = getProjectPermissions(ProjectMemberRole.ADMIN);
    expect(perms).toContain("project.update");
    expect(perms).toContain("project.manage_members");
    expect(perms).not.toContain("project.delete");
  });

  it("MEMBER can create and update issues", () => {
    const perms = getProjectPermissions(ProjectMemberRole.MEMBER);
    expect(perms).toContain("issue.create");
    expect(perms).toContain("issue.update");
    expect(perms).toContain("sprint.read");
    expect(perms).not.toContain("sprint.create");
  });

  it("VIEWER can only read", () => {
    const perms = getProjectPermissions(ProjectMemberRole.VIEWER);
    expect(perms).toContain("project.read");
    expect(perms).toContain("issue.read");
    expect(perms).toContain("sprint.read");
    expect(perms).toContain("comment.read");
    expect(perms).not.toContain("project.update");
    expect(perms).not.toContain("issue.create");
  });
});

// 鈹€鈹€鈹€ checkPermission (using mocked prisma) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

describe("checkPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for non-existent user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await checkPermission(mockPrisma as any, "user-1", "proj-1", "project.read");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("User not found");
  });

  it("allows system OWNER to perform global admin actions", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: SystemRole.OWNER });
    const result = await checkPermission(mockPrisma as any, "user-1", "proj-1", "project.delete");
    expect(result.allowed).toBe(true);
  });

  it("allows system ADMIN to perform global admin actions", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: SystemRole.ADMIN });
    const result = await checkPermission(mockPrisma as any, "user-1", "proj-1", "project.archive");
    expect(result.allowed).toBe(true);
  });

  it("denies system VIEWER write actions", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: SystemRole.VIEWER });
    const result = await checkPermission(mockPrisma as any, "user-1", "proj-1", "issue.create");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("System VIEWER role cannot perform write actions");
  });

  it("allows system VIEWER read actions", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: SystemRole.VIEWER });
    const result = await checkPermission(mockPrisma as any, "user-1", "proj-1", "issue.read");
    expect(result.allowed).toBe(true);
  });

  it("requires projectId for non-global actions", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: SystemRole.MEMBER });
    const result = await checkPermission(mockPrisma as any, "user-1", null, "issue.create");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Project ID required");
  });

  it("denies non-member access to project", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: SystemRole.MEMBER });
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);
    const result = await checkPermission(mockPrisma as any, "user-1", "proj-1", "issue.create");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not a member");
  });

  it("allows project MEMBER to create issues", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: SystemRole.MEMBER });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
    const result = await checkPermission(mockPrisma as any, "user-1", "proj-1", "issue.create");
    expect(result.allowed).toBe(true);
  });

  it("denies project VIEWER from creating issues", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: SystemRole.MEMBER });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.VIEWER });
    const result = await checkPermission(mockPrisma as any, "user-1", "proj-1", "issue.create");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Requires at least");
  });
});

