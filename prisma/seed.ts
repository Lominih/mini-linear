// @ts-nocheck
import { PrismaClient, SystemRole, ProjectStatus, ProjectMemberRole, IssueStatus, IssuePriority, SprintStatus } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

// Prisma 7 for SQLite uses bundled WASM engine — no adapter needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new (PrismaClient as any)();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await prisma.view.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.issueRelation.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.sprint.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  console.log("  Cleared existing data");

  // ─── Users ──────────────────────────────────────────

  const password = await bcrypt.hash("Password1", 12);

  const alice = await prisma.user.create({
    data: {
      email: "alice@minilinear.dev",
      name: "Alice Chen",
      password,
      role: SystemRole.OWNER,
      avatar: null,
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: "bob@minilinear.dev",
      name: "Bob Martinez",
      password,
      role: SystemRole.ADMIN,
      avatar: null,
    },
  });

  const carol = await prisma.user.create({
    data: {
      email: "carol@minilinear.dev",
      name: "Carol Williams",
      password,
      role: SystemRole.MEMBER,
      avatar: null,
    },
  });

  const dave = await prisma.user.create({
    data: {
      email: "dave@minilinear.dev",
      name: "Dave Kim",
      password,
      role: SystemRole.MEMBER,
      avatar: null,
    },
  });

  const eve = await prisma.user.create({
    data: {
      email: "eve@minilinear.dev",
      name: "Eve Johnson",
      password,
      role: SystemRole.VIEWER,
      avatar: null,
    },
  });

  console.log("  Created 5 users");

  // ─── Projects ───────────────────────────────────────

  const miniLinear = await prisma.project.create({
    data: {
      name: "Mini Linear",
      description: "A lightweight project management tool inspired by Linear",
      key: "ML",
      status: ProjectStatus.ACTIVE,
      ownerId: alice.id,
    },
  });

  const mobileApp = await prisma.project.create({
    data: {
      name: "Mobile App",
      description: "React Native companion app for Mini Linear",
      key: "MOB",
      status: ProjectStatus.PLANNING,
      ownerId: bob.id,
    },
  });

  const infra = await prisma.project.create({
    data: {
      name: "Infrastructure",
      description: "DevOps, CI/CD, and infrastructure management",
      key: "INF",
      status: ProjectStatus.ACTIVE,
      ownerId: alice.id,
    },
  });

  console.log("  Created 3 projects");

  // ─── Project Members ────────────────────────────────

  const memberData = [
    { projectId: miniLinear.id, userId: alice.id, role: ProjectMemberRole.OWNER },
    { projectId: miniLinear.id, userId: bob.id, role: ProjectMemberRole.ADMIN },
    { projectId: miniLinear.id, userId: carol.id, role: ProjectMemberRole.MEMBER },
    { projectId: miniLinear.id, userId: dave.id, role: ProjectMemberRole.MEMBER },
    { projectId: miniLinear.id, userId: eve.id, role: ProjectMemberRole.VIEWER },
    { projectId: mobileApp.id, userId: bob.id, role: ProjectMemberRole.OWNER },
    { projectId: mobileApp.id, userId: dave.id, role: ProjectMemberRole.MEMBER },
    { projectId: infra.id, userId: alice.id, role: ProjectMemberRole.OWNER },
    { projectId: infra.id, userId: carol.id, role: ProjectMemberRole.MEMBER },
  ];

  await prisma.projectMember.createMany({ data: memberData });
  console.log("  Created project memberships");

  // ─── Sprints ────────────────────────────────────────

  const now = new Date();

  const sprint1 = await prisma.sprint.create({
    data: {
      name: "Sprint 1 - Foundation",
      description: "Set up core architecture and authentication",
      startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime()),
      goal: "Complete DB schema, auth system, and basic CRUD",
      status: SprintStatus.COMPLETED,
      projectId: miniLinear.id,
    },
  });

  const sprint2 = await prisma.sprint.create({
    data: {
      name: "Sprint 2 - Core Features",
      description: "Build project management and issue tracking",
      startDate: now,
      endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      goal: "Ship project boards, issue CRUD, and sprint views",
      status: SprintStatus.ACTIVE,
      projectId: miniLinear.id,
    },
  });

  const sprint3 = await prisma.sprint.create({
    data: {
      name: "Sprint 3 - Polish",
      description: "UI polish, performance, and integrations",
      startDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000),
      goal: "Launch-ready with notifications and real-time updates",
      status: SprintStatus.PLANNED,
      projectId: miniLinear.id,
    },
  });

  console.log("  Created 3 sprints");

  // ─── Issues ─────────────────────────────────────────

  const issues = [
    {
      title: "Design database schema",
      description: "Define all models, relations, and indexes for the SQLite database",
      status: IssueStatus.DONE,
      priority: IssuePriority.HIGH,
      labels: JSON.stringify(["backend", "database"]),
      assigneeId: alice.id,
      reporterId: alice.id,
      projectId: miniLinear.id,
      sprintId: sprint1.id,
      order: 1,
    },
    {
      title: "Implement JWT authentication",
      description: "Set up JWT token generation, validation, and refresh flow",
      status: IssueStatus.DONE,
      priority: IssuePriority.HIGH,
      labels: JSON.stringify(["backend", "auth"]),
      assigneeId: bob.id,
      reporterId: alice.id,
      projectId: miniLinear.id,
      sprintId: sprint1.id,
      order: 2,
    },
    {
      title: "Create tRPC router setup",
      description: "Initialize tRPC with context, public and protected procedures",
      status: IssueStatus.DONE,
      priority: IssuePriority.MEDIUM,
      labels: JSON.stringify(["backend", "api"]),
      assigneeId: carol.id,
      reporterId: alice.id,
      projectId: miniLinear.id,
      sprintId: sprint1.id,
      order: 3,
    },
    {
      title: "Build project CRUD endpoints",
      description: "Create, read, update, delete projects with proper RBAC",
      status: IssueStatus.IN_PROGRESS,
      priority: IssuePriority.HIGH,
      labels: JSON.stringify(["backend", "api"]),
      assigneeId: bob.id,
      reporterId: alice.id,
      projectId: miniLinear.id,
      sprintId: sprint2.id,
      order: 4,
    },
    {
      title: "Implement issue status workflow",
      description: "Drag-and-drop status transitions with validation",
      status: IssueStatus.TODO,
      priority: IssuePriority.HIGH,
      labels: JSON.stringify(["backend", "feature"]),
      assigneeId: carol.id,
      reporterId: bob.id,
      projectId: miniLinear.id,
      sprintId: sprint2.id,
      order: 5,
    },
    {
      title: "Add real-time updates via Socket.IO",
      description: "Broadcast issue changes to connected clients in real time",
      status: IssueStatus.BACKLOG,
      priority: IssuePriority.MEDIUM,
      labels: JSON.stringify(["backend", "realtime"]),
      assigneeId: dave.id,
      reporterId: bob.id,
      projectId: miniLinear.id,
      sprintId: sprint2.id,
      order: 6,
    },
    {
      title: "Set up notification system",
      description: "In-app notifications for assignments, mentions, and updates",
      status: IssueStatus.BACKLOG,
      priority: IssuePriority.MEDIUM,
      labels: JSON.stringify(["backend", "feature"]),
      assigneeId: null,
      reporterId: alice.id,
      projectId: miniLinear.id,
      sprintId: sprint3.id,
      order: 7,
    },
    {
      title: "Add search and filtering",
      description: "Full-text search across issues with advanced filters",
      status: IssueStatus.BACKLOG,
      priority: IssuePriority.LOW,
      labels: JSON.stringify(["backend", "feature"]),
      assigneeId: null,
      reporterId: carol.id,
      projectId: miniLinear.id,
      sprintId: sprint3.id,
      order: 8,
    },
  ];

  const createdIssues = [];
  for (const issueData of issues) {
    const issue = await prisma.issue.create({ data: issueData });
    createdIssues.push(issue);
  }

  // Create issue relations
  await prisma.issueRelation.createMany({
    data: [
      { fromIssueId: createdIssues[0].id, toIssueId: createdIssues[2].id, type: "BLOCKS" as const },
      { fromIssueId: createdIssues[1].id, toIssueId: createdIssues[3].id, type: "BLOCKS" as const },
      { fromIssueId: createdIssues[4].id, toIssueId: createdIssues[5].id, type: "RELATES_TO" as const },
      { fromIssueId: createdIssues[5].id, toIssueId: createdIssues[6].id, type: "RELATES_TO" as const },
    ],
  });

  console.log("  Created 8 issues with relations");

  // ─── Comments ───────────────────────────────────────

  await prisma.comment.createMany({
    data: [
      {
        content: "Schema looks good. Added composite indexes for common query patterns.",
        authorId: bob.id,
        issueId: createdIssues[0].id,
      },
      {
        content: "Using bcryptjs for password hashing. 12 rounds should be sufficient.",
        authorId: bob.id,
        issueId: createdIssues[1].id,
      },
      {
        content: "Should we add rate limiting to the auth endpoints?",
        authorId: carol.id,
        issueId: createdIssues[1].id,
      },
      {
        content: "Good idea — let's add that as a follow-up task.",
        authorId: bob.id,
        issueId: createdIssues[1].id,
      },
    ],
  });

  console.log("  Created comments");

  // ─── Notifications ──────────────────────────────────

  await prisma.notification.createMany({
    data: [
      {
        type: "ISSUE_ASSIGNED",
        message: "You have been assigned to 'Design database schema'",
        userId: alice.id,
        link: `/projects/ML/issues/${createdIssues[0].id}`,
      },
      {
        type: "ISSUE_ASSIGNED",
        message: "You have been assigned to 'Implement JWT authentication'",
        userId: bob.id,
        link: `/projects/ML/issues/${createdIssues[1].id}`,
      },
      {
        type: "SPRINT_STARTED",
        message: "Sprint 2 - Core Features has started",
        userId: alice.id,
        link: `/projects/ML/sprints/${sprint2.id}`,
      },
      {
        type: "ISSUE_UPDATED",
        message: "'Create tRPC router setup' has been marked as done",
        userId: alice.id,
        read: true,
        link: `/projects/ML/issues/${createdIssues[2].id}`,
      },
    ],
  });

  console.log("  Created notifications");

  // ─── Views ──────────────────────────────────────────

  await prisma.view.createMany({
    data: [
      {
        name: "All Issues",
        type: "LIST",
        filters: JSON.stringify({}),
        projectId: miniLinear.id,
        userId: alice.id,
        shared: true,
      },
      {
        name: "My Open Issues",
        type: "BOARD",
        filters: JSON.stringify({ assigneeId: alice.id, status: { not: "DONE" } }),
        projectId: miniLinear.id,
        userId: alice.id,
        shared: false,
      },
      {
        name: "Backlog",
        type: "BOARD",
        filters: JSON.stringify({ status: "BACKLOG" }),
        projectId: miniLinear.id,
        userId: bob.id,
        shared: true,
      },
    ],
  });

  console.log("  Created views");

  console.log("✅ Seed complete!");
  console.log("\nTest accounts (all passwords: Password1):");
  console.log(`  Owner:   ${alice.email}`);
  console.log(`  Admin:   ${bob.email}`);
  console.log(`  Member:  ${carol.email}`);
  console.log(`  Member:  ${dave.email}`);
  console.log(`  Viewer:  ${eve.email}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });