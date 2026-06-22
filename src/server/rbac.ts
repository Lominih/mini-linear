import { PrismaClient } from "@prisma/client";`nimport { SystemRole, ProjectMemberRole } from "@/generated/prisma/enums";

// ------ Types ----------------------------------------------------------------------------------------------

export type Role = SystemRole | ProjectMemberRole;

export type ProjectAction =
  | "project.create"
  | "project.read"
  | "project.update"
  | "project.delete"
  | "project.archive"
  | "project.manage_members";

export type IssueAction =
  | "issue.create"
  | "issue.read"
  | "issue.update"
  | "issue.delete"
  | "issue.assign"
  | "issue.change_status";

export type SprintAction =
  | "sprint.create"
  | "sprint.read"
  | "sprint.update"
  | "sprint.delete"
  | "sprint.start"
  | "sprint.complete";

export type CommentAction =
  | "comment.create"
  | "comment.read"
  | "comment.update"
  | "comment.delete";

export type Action = ProjectAction | IssueAction | SprintAction | CommentAction;

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

// ------ Permission Matrix ----------------------------------------------------------------------

const SYSTEM_ROLE_HIERARCHY: Record<SystemRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

const PROJECT_ROLE_HIERARCHY: Record<ProjectMemberRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

const PROJECT_PERMISSIONS: Record<ProjectMemberRole, ProjectAction[]> = {
  OWNER: [
    "project.create",
    "project.read",
    "project.update",
    "project.delete",
    "project.archive",
    "project.manage_members",
  ],
  ADMIN: [
    "project.create",
    "project.read",
    "project.update",
    "project.archive",
    "project.manage_members",
  ],
  MEMBER: ["project.create", "project.read", "project.update"],
  VIEWER: ["project.read"],
};

const ISSUE_PERMISSIONS: Record<ProjectMemberRole, IssueAction[]> = {
  OWNER: [
    "issue.create",
    "issue.read",
    "issue.update",
    "issue.delete",
    "issue.assign",
    "issue.change_status",
  ],
  ADMIN: [
    "issue.create",
    "issue.read",
    "issue.update",
    "issue.delete",
    "issue.assign",
    "issue.change_status",
  ],
  MEMBER: [
    "issue.create",
    "issue.read",
    "issue.update",
    "issue.assign",
    "issue.change_status",
  ],
  VIEWER: ["issue.read"],
};

const SPRINT_PERMISSIONS: Record<ProjectMemberRole, SprintAction[]> = {
  OWNER: [
    "sprint.create",
    "sprint.read",
    "sprint.update",
    "sprint.delete",
    "sprint.start",
    "sprint.complete",
  ],
  ADMIN: [
    "sprint.create",
    "sprint.read",
    "sprint.update",
    "sprint.start",
    "sprint.complete",
  ],
  MEMBER: ["sprint.read"],
  VIEWER: ["sprint.read"],
};

const COMMENT_PERMISSIONS: Record<ProjectMemberRole, CommentAction[]> = {
  OWNER: ["comment.create", "comment.read", "comment.update", "comment.delete"],
  ADMIN: ["comment.create", "comment.read", "comment.update", "comment.delete"],
  MEMBER: ["comment.create", "comment.read", "comment.update"],
  VIEWER: ["comment.read"],
};

const GLOBAL_ADMIN_ACTIONS: Action[] = [
  "project.read",
  "issue.read",
  "sprint.read",
  "comment.read",
  "project.update",
  "project.delete",
  "project.archive",
  "project.manage_members",
];

// ------ Helpers ------------------------------------------------------------------------------------------

function getRequiredProjectRoleForAction(action: Action): ProjectMemberRole | null {
  const roles: ProjectMemberRole[] = ["VIEWER", "MEMBER", "ADMIN", "OWNER"];

  for (const role of roles) {
    const perms = [
      ...PROJECT_PERMISSIONS[role],
      ...ISSUE_PERMISSIONS[role],
      ...SPRINT_PERMISSIONS[role],
      ...COMMENT_PERMISSIONS[role],
    ];

    if (perms.includes(action as never)) {
      return role;
    }
  }

  return null;
}

function projectRoleMeetsRequirement(
  userRole: ProjectMemberRole,
  requiredRole: ProjectMemberRole,
): boolean {
  return PROJECT_ROLE_HIERARCHY[userRole] >= PROJECT_ROLE_HIERARCHY[requiredRole];
}

// ------ Core RBAC --------------------------------------------------------------------------------------

export async function checkPermission(
  prisma: PrismaClient,
  userId: string,
  projectId: string | null,
  action: Action,
): Promise<PermissionCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    return { allowed: false, reason: "User not found" };
  }

  if (
    (user.role === SystemRole.OWNER || user.role === SystemRole.ADMIN) &&
    GLOBAL_ADMIN_ACTIONS.includes(action)
  ) {
    return { allowed: true };
  }

  if (user.role === SystemRole.VIEWER) {
    if (action.endsWith(".read") || action === "comment.create") {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "System VIEWER role cannot perform write actions",
    };
  }

  if (!projectId) {
    return {
      allowed: false,
      reason: "Project ID required for this action",
    };
  }

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
    select: { role: true },
  });

  if (!membership) {
    return {
      allowed: false,
      reason: "User is not a member of this project",
    };
  }

  const requiredRole = getRequiredProjectRoleForAction(action);
  if (!requiredRole) {
    return { allowed: false, reason: `Unknown action: ${action}` };
  }

  if (projectRoleMeetsRequirement(membership.role, requiredRole)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Requires at least ${requiredRole} role (user has ${membership.role})`,
  };
}

export function hasRole(userRole: SystemRole, minimumRole: SystemRole): boolean {
  return SYSTEM_ROLE_HIERARCHY[userRole] >= SYSTEM_ROLE_HIERARCHY[minimumRole];
}

export function hasProjectRole(
  memberRole: ProjectMemberRole,
  minimumRole: ProjectMemberRole,
): boolean {
  return PROJECT_ROLE_HIERARCHY[memberRole] >= PROJECT_ROLE_HIERARCHY[minimumRole];
}

export function getProjectPermissions(role: ProjectMemberRole): Action[] {
  return [
    ...PROJECT_PERMISSIONS[role],
    ...ISSUE_PERMISSIONS[role],
    ...SPRINT_PERMISSIONS[role],
    ...COMMENT_PERMISSIONS[role],
  ];
}
