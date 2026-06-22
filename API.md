# Mini Linear API Documentation

> **Base URL:** `http://localhost:3000`
> **API Version:** v1
> **Last Updated:** 2026-06-22

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [REST API v1](#rest-api-v1)
  - [Auth Endpoints](#auth-endpoints)
  - [Projects](#projects)
  - [Issues](#issues)
  - [Sprints](#sprints)
  - [Export](#export)
- [tRPC API](#trpc-api)
  - [Issue Router](#trpc-issue-router)
  - [Issue Batch Router](#trpc-issue-batch-router)
  - [Sprint Router](#trpc-sprint-router)
  - [Notification Router](#trpc-notification-router)
  - [Activity Router](#trpc-activity-router)
  - [Integration Router](#trpc-integration-router)
  - [Webhook Router](#trpc-webhook-router)
  - [View Router](#trpc-view-router)
- [Data Models](#data-models)
- [Enums](#enums)
- [Webhooks](#webhooks)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Overview

Mini Linear exposes two API layers:

1. **REST API** - Traditional HTTP endpoints under `/api/auth/*` and `/api/v1/*`.
2. **tRPC API** - Type-safe RPC layer at `/api/trpc` with routers for issues, sprints, notifications, activity, integrations, webhooks, and views.

Both layers share the same **Prisma/SQLite** database and JWT-based authentication.

---

## Authentication

Mini Linear uses **JWT Bearer tokens** for authentication. Tokens can be provided via:

- **Authorization header:** `Authorization: Bearer <access_token>`
- **Cookie:** `access-token=<access_token>`

### Token Lifecycle

| Token | Default Expiry | Secret Env Var | Signing |
|---|---|---|---|
| Access Token | 7 days | `JWT_SECRET` | HS256 |
| Refresh Token | 30 days | `JWT_REFRESH_SECRET` | HS256 |

### NextAuth.js

The project also includes a NextAuth.js session endpoint at `/api/auth/[...nextauth]` using JWT strategy with a 7-day max age. This is used for browser-based login flows.

---

## REST API v1

### Auth Endpoints

#### POST `/api/auth/register`

Register a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "SecureP@ss1"
}
```

**Validation Rules:**

| Field | Rules |
|---|---|
| `email` | Valid email format, unique |
| `name` | 1-100 characters |
| `password` | Min 8 chars, uppercase, lowercase, digit |

**Response (201):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "MEMBER",
    "createdAt": "2026-06-22T10:00:00.000Z"
  },
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "expiresIn": 604800
}
```

**Error Responses:**

| Status | Error | When |
|---|---|---|
| `400` | Validation error | Invalid email, weak password, missing fields |
| `409` | Conflict | Email already registered |
| `500` | Internal server error | Server failure |

---

#### POST `/api/auth/refresh`

Refresh an expired access token using a valid refresh token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

> If `refreshToken` is omitted from the body, the endpoint falls back to the `refresh-token` cookie.

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "expiresIn": 604800
}
```

**Error Responses:**

| Status | Error | When |
|---|---|---|
| `400` | Bad request | No refresh token provided |
| `401` | Unauthorized | Invalid or expired refresh token, user deleted |
| `500` | Internal server error | Server failure |

---

#### GET/POST `/api/auth/[...nextauth]`

NextAuth.js handler for session-based authentication. Supports:

- **Credentials provider** (email + password)
- OAuth stubs for Google and GitHub (commented out in source, ready for configuration)

**Configuration:**

- Session strategy: `JWT`
- Session max age: 7 days
- Sign-in page: `/auth/login`
- Error page: `/auth/error`

---

### Projects

#### GET `/api/v1/projects`

List all projects with pagination and filtering.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `status` | string | - | Filter by project status (e.g., `ACTIVE`) |
| `search` | string | - | Search by name, description, or key |
| `page` | integer | `1` | Page number (min: 1) |
| `limit` | integer | `50` | Items per page (1-100) |

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "My Project",
      "description": "A project description",
      "key": "MP",
      "status": "ACTIVE",
      "ownerId": "uuid",
      "createdAt": "2026-06-22T10:00:00.000Z",
      "updatedAt": "2026-06-22T10:00:00.000Z",
      "owner": {
        "id": "uuid",
        "name": "John Doe",
        "email": "user@example.com",
        "avatar": null
      },
      "_count": {
        "issues": 15,
        "members": 5,
        "sprints": 3
      }
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

---

### Issues

#### GET `/api/v1/issues`

List issues with filtering, sorting, and pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `projectId` | string | - | Filter by project ID |
| `status` | string | - | Filter by status (`BACKLOG`, `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED`) |
| `priority` | string | - | Filter by priority (`URGENT`, `HIGH`, `MEDIUM`, `LOW`, `NONE`) |
| `assigneeId` | string | - | Filter by assignee user ID |
| `sprintId` | string | - | Filter by sprint ID |
| `label` | string | - | Filter by label |
| `search` | string | - | Search in title and description |
| `page` | integer | `1` | Page number (min: 1) |
| `limit` | integer | `50` | Items per page (1-100) |
| `orderBy` | string | `createdAt` | Sort field: `createdAt`, `updatedAt`, `priority`, `order`, `title` |
| `orderDirection` | string | `desc` | Sort direction: `asc` or `desc` |

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Fix login bug",
      "description": "Users cannot log in with SSO",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "labels": ["bug", "auth"],
      "customFields": {},
      "dueDate": "2026-07-01T00:00:00.000Z",
      "sprintId": "uuid",
      "projectId": "uuid",
      "order": 1,
      "createdAt": "2026-06-22T10:00:00.000Z",
      "updatedAt": "2026-06-22T10:00:00.000Z",
      "assignee": {
        "id": "uuid",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "avatar": null
      },
      "reporter": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "avatar": null
      },
      "project": {
        "id": "uuid",
        "name": "My Project",
        "key": "MP"
      },
      "sprint": {
        "id": "uuid",
        "name": "Sprint 1",
        "status": "active"
      }
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 50,
    "totalPages": 2
  }
}
```

---

#### POST `/api/v1/issues`

Create a new issue.

**Request Body:**

```json
{
  "title": "Fix login bug",
  "description": "Users cannot log in with SSO",
  "projectId": "uuid",
  "priority": "high",
  "assigneeId": "uuid",
  "labels": ["bug", "auth"],
  "dueDate": "2026-07-01T00:00:00.000Z",
  "sprintId": "uuid"
}
```

| Field | Required | Type | Description |
|---|---|---|---|
| `title` | Yes | string | Issue title |
| `description` | No | string | Issue description |
| `projectId` | Yes | string | Project UUID |
| `priority` | No | string | `urgent`, `high`, `medium`, `low`, `none` (default: `none`) |
| `assigneeId` | No | string | Assignee user UUID |
| `labels` | No | string[] | Array of label strings |
| `dueDate` | No | string | ISO 8601 datetime |
| `sprintId` | No | string | Sprint UUID |

**Response (201):**

```json
{
  "data": {
    "id": "uuid",
    "title": "Fix login bug",
    "status": "BACKLOG",
    "priority": "HIGH",
    "labels": ["bug", "auth"],
    "projectId": "uuid",
    "reporterId": "uuid",
    "assigneeId": "uuid",
    "order": 5,
    "createdAt": "2026-06-22T10:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error | When |
|---|---|---|
| `400` | Bad request | Missing `title` or `projectId` |
| `401` | Unauthorized | Missing or invalid access token |
| `404` | Not found | Project does not exist |

---

### Sprints

#### GET `/api/v1/sprints`

List sprints with pagination and filtering.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `projectId` | string | - | Filter by project ID |
| `status` | string | - | Filter by status (`PLANNING`, `ACTIVE`, `COMPLETED`) |
| `page` | integer | `1` | Page number |
| `limit` | integer | `50` | Items per page (1-100) |

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Sprint 1",
      "description": "First sprint",
      "startDate": "2026-06-22T00:00:00.000Z",
      "endDate": "2026-07-06T00:00:00.000Z",
      "goal": "Ship v1.0",
      "status": "ACTIVE",
      "projectId": "uuid",
      "timeProgress": 0.45,
      "isOverdue": false,
      "project": { "id": "uuid", "name": "My Project", "key": "MP" },
      "_count": { "issues": 12 }
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

**Computed Fields:**

| Field | Type | Description |
|---|---|---|
| `timeProgress` | float | Progress ratio (0-1) based on start/end dates |
| `isOverdue` | boolean | `true` if current date exceeds `endDate` and status is not `COMPLETED` |

---

### Export

#### GET `/api/export/[projectId]`

Export all data for a project (issues, sprints, views, etc.).

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `format` | string | `json` | `json` for inline response, `download` for file attachment |

**Response (200, format=json):**

```json
{
  "data": {
    "project": { },
    "issues": [],
    "sprints": [],
    "views": [],
    "members": []
  }
}
```

**Response (200, format=download):**

Returns a JSON file attachment (`mini-linear-export.json`) with `Content-Disposition: attachment`.

---

## tRPC API

All tRPC endpoints are accessible at `/api/trpc`. The tRPC handler accepts both `GET` and `POST` requests.

### Calling tRPC

**HTTP Query (GET):**

```
GET /api/trpc/issue.list?input={"projectId":"uuid","limit":10}
```

**HTTP Mutation (POST):**

```
POST /api/trpc/issue.create
Content-Type: application/json

{"json":{"title":"New issue","projectId":"uuid"}}
```

**Batch requests:**

```
POST /api/trpc/issue.list,issue.getById
Content-Type: application/json

{"0":{"json":{"projectId":"uuid"}},"1":{"json":{"id":"uuid"}}}
```

### Context

Every tRPC request extracts the user from the JWT token (via `Authorization` header or `access-token` cookie). Procedures marked as `protectedProcedure` require authentication; `publicProcedure` does not.

---

### Issue Router (`issue.*`)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `issue.create` | mutation | public | Create an issue |
| `issue.getById` | query | public | Get issue by ID with full details |
| `issue.update` | mutation | public | Update an issue |
| `issue.delete` | mutation | public | Delete an issue |
| `issue.list` | query | public | List issues with cursor pagination |
| `issue.bulkUpdate` | mutation | public | Bulk update multiple issues |
| `issue.bulkDelete` | mutation | public | Bulk delete multiple issues |
| `issue.search` | query | public | Full-text search issues |
| `issue.reorder` | mutation | public | Reorder issues within a project |
| `issue.getSubtasks` | query | public | Get subtasks of an issue |
| `issue.addRelation` | mutation | public | Add a relation between two issues |
| `issue.removeRelation` | mutation | public | Remove a relation between two issues |
| `issue.getValidTransitions` | query | public | Get valid status transitions for an issue |
| `issue.getTransitiveRelations` | query | public | Get transitive dependency chain |

#### `issue.create`

**Input:**

```typescript
{
  title: string;           // 1-500 chars, required
  description?: string;
  projectId: string;       // required
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  assigneeId?: string;
  labels?: string[];       // default: []
  dueDate?: string;        // ISO 8601 datetime
  parentId?: string;       // subtask parent
  sprintId?: string;
  customFields?: Record<string, unknown>;
}
```

**Response:** Created issue object with `status: "BACKLOG"` and auto-incremented `order`.

---

#### `issue.getById`

**Input:** `{ id: string }`

**Response:** Full issue object including:
- `assignee`, `reporter`, `project`, `sprint` - related entities
- `comments` - all comments with author info
- `children` - subtasks
- `parent` - parent issue (if subtask)
- `relations` - `{ blocks: Issue[], blockedBy: Issue[], relatesTo: Issue[] }`
- `labels` - parsed JSON array
- `customFields` - parsed JSON object

---

#### `issue.update`

**Input:**

```typescript
{
  id: string;
  title?: string;          // 1-500 chars
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: string | null;
  labels?: string[];
  dueDate?: string | null;
  sprintId?: string | null;
  customFields?: Record<string, unknown>;
}
```

**Notes:** Status changes are validated through the state machine. Invalid transitions return `400 BAD_REQUEST`.

---

#### `issue.delete`

**Input:** `{ id: string }`

**Behavior:** Deletes the issue, its child issues, and all related `IssueRelation` records.

---

#### `issue.list`

**Input:**

```typescript
{
  projectId?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: string;
  sprintId?: string;
  labels?: string[];
  parentId?: string;
  limit?: number;          // 1-200, default: 50
  cursor?: string;         // cursor-based pagination
  orderBy?: "createdAt" | "updatedAt" | "priority" | "order" | "title";
  orderDirection?: "asc" | "desc";
}
```

**Response:** `{ items: Issue[]; nextCursor?: string; }`

---

#### `issue.bulkUpdate`

**Input:**

```typescript
{
  ids: string[];           // 1-100 issue IDs
  updates: {
    status?: IssueStatus;
    priority?: IssuePriority;
    assigneeId?: string | null;
    sprintId?: string | null;
    labels?: string[];
  }
}
```

---

#### `issue.bulkDelete`

**Input:** `{ ids: string[] }` - 1-100 issue IDs

**Behavior:** Deletes issues, child issues, and relations.

---

#### `issue.search`

**Input:**

```typescript
{
  query: string;           // min 1 char
  projectId?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: string;
  limit?: number;          // 1-100, default: 20
  offset?: number;         // default: 0
}
```

**Response:** Ranked search results with relevance scoring, snippets, and match highlighting.

---

#### `issue.reorder`

**Input:**

```typescript
{
  projectId: string;
  ids: string[];
  targetIndex: number;
  status?: IssueStatus;
}
```

---

#### `issue.getSubtasks`

**Input:** `{ issueId: string }`

**Response:** Array of child issues ordered by `order`.

---

#### `issue.addRelation`

**Input:**

```typescript
{
  fromIssueId: string;
  toIssueId: string;
  type: "blocks" | "blocked_by" | "relates_to";
}
```

**Behavior:**
- Cannot create self-references
- `blocks` relations checked for circular dependencies
- Duplicate relations return `409 CONFLICT`

---

#### `issue.removeRelation`

**Input:** `{ fromIssueId: string; toIssueId: string; type: RelationType }`

---

#### `issue.getValidTransitions`

**Input:** `{ issueId: string }`

**Response:** Array of valid `{ from, to, label }` transitions from the current status.

---

#### `issue.getTransitiveRelations`

**Input:** `{ issueId: string; type: "blocks" | "blocked_by" }`

**Response:** Transitive chain of related issues (max depth: 10).

---

### Issue Batch Router (`issueBatch.*`)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `issueBatch.bulkStatusChange` | mutation | public | Change status of up to 500 issues |
| `issueBatch.bulkAssign` | mutation | public | Assign/unassign up to 500 issues |
| `issueBatch.bulkAddLabels` | mutation | public | Add labels to up to 500 issues |
| `issueBatch.bulkRemoveLabels` | mutation | public | Remove labels from up to 500 issues |
| `issueBatch.bulkDelete` | mutation | public | Delete up to 500 issues |
| `issueBatch.importFromCsv` | mutation | public | Import issues from CSV |

#### `issueBatch.bulkStatusChange`

**Input:** `{ ids: string[]; status: IssueStatus }`

Validates each status transition through the state machine. Returns count of successfully updated issues and any errors.

---

#### `issueBatch.bulkAssign`

**Input:** `{ ids: string[]; assigneeId: string | null }`

Use `null` to unassign.

---

#### `issueBatch.bulkAddLabels`

**Input:** `{ ids: string[]; labels: string[] }`

Merges new labels with existing labels (deduped).

---

#### `issueBatch.bulkRemoveLabels`

**Input:** `{ ids: string[]; labels: string[] }`

---

#### `issueBatch.bulkDelete`

**Input:** `{ ids: string[] }`

Deletes child issues and relations before deleting the issues themselves.

---

#### `issueBatch.importFromCsv`

**Input:**

```typescript
{
  projectId: string;
  csvContent: string;
  assigneeId?: string;     // optional default assignee
}
```

**CSV Format:**

```csv
title,description,status,priority,labels,assignee_id,due_date
"Fix login bug","Users cannot log in","backlog","high","bug,auth","","2026-07-01"
"Add dark mode","UI feature","todo","medium","feature","",""
```

**Required columns:** `title`
**Optional:** `description`, `status`, `priority`, `labels` (comma-separated), `assignee_id`, `due_date`

**Response:**

```typescript
{
  imported: number;
  errors: Array<{ row: number; error: string }>;
  total: number;
}
```

---

### Sprint Router (`sprint.*`)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `sprint.create` | mutation | **protected** | Create a new sprint |
| `sprint.getById` | query | public | Get sprint with issues and progress stats |
| `sprint.update` | mutation | **protected** | Update sprint details |
| `sprint.delete` | mutation | **protected** | Delete a sprint |
| `sprint.list` | query | public | List sprints for a project |
| `sprint.start` | mutation | **protected** | Start a sprint (planning to active) |
| `sprint.complete` | mutation | **protected** | Complete a sprint (active to completed) |
| `sprint.addIssues` | mutation | **protected** | Add issues to a sprint |
| `sprint.removeIssues` | mutation | **protected** | Remove issues from a sprint |
| `sprint.reorderIssues` | mutation | **protected** | Reorder issues within a sprint |

#### `sprint.create`

**Input:**

```typescript
{
  name: string;            // 1-100 chars
  description?: string;    // max 500 chars
  startDate: string;       // ISO date
  endDate: string;         // ISO date
  goal?: string;           // max 500 chars
  projectId: string;
}
```

**Validation:**
- `endDate` must be after `startDate`
- Project must exist
- Sprint dates cannot overlap with another active sprint

---

#### `sprint.getById`

**Input:** `{ id: string }`

**Response:** Sprint with issues plus computed stats:

```typescript
{
  id: string;
  name: string;
  issues: Issue[];
  completedCount: number;
  inProgressCount: number;
  todoCount: number;
  timeProgress: number;      // 0-1
  isOverdue: boolean;
  burndownData: Array<{ date: string; ideal: number; actual: number }>;
}
```

---

#### `sprint.start`

**Input:** `{ id: string }`

Validates sprint is in `planning` status with valid dates. Transitions to `active`.

---

#### `sprint.complete`

**Input:** `{ id: string }`

Validates sprint is `active`. Moves incomplete issues back to backlog. Transitions to `completed`.

---

#### `sprint.addIssues`

**Input:** `{ sprintId: string; issueIds: string[] }`

**Validation:**
- Sprint must not be completed
- All issues must belong to the same project
- Issues already in sprint are rejected

---

#### `sprint.removeIssues`

**Input:** `{ sprintId: string; issueIds: string[] }`

Sets `sprintId` to `null` and resets `order` to `0` for each issue.

---

#### `sprint.reorderIssues`

**Input:** `{ sprintId: string; issueIds: string[] }`

Updates `order` field based on array index.

---

### Notification Router (`notification.*`)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `notification.list` | query | **protected** | List user notifications |
| `notification.markRead` | mutation | **protected** | Mark single notification as read |
| `notification.markAllRead` | mutation | **protected** | Mark all notifications as read |
| `notification.getUnreadCount` | query | **protected** | Get count of unread notifications |

#### `notification.list`

**Input (optional):**

```typescript
{
  limit?: number;          // 1-100, default: 50
  cursor?: string;
  unreadOnly?: boolean;    // default: false
}
```

**Response:** `{ notifications: Notification[]; nextCursor?: string }`

**Ordering:** Unread first, then by `createdAt` descending.

---

#### `notification.markRead`

**Input:** `{ id: string }`

Marks the notification as read. Validates ownership.

---

#### `notification.markAllRead`

No input required. **Response:** `{ count: number }`

---

#### `notification.getUnreadCount`

No input required. **Response:** `{ count: number }`

---

### Activity Router (`activity.*`)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `activity.list` | query | **protected** | List activity for a project |
| `activity.getByIssue` | query | **protected** | List activity for a specific issue |

#### `activity.list`

**Input:** `{ projectId: string; limit?: number; cursor?: string }`

**Response:**

```typescript
{
  activities: Array<{
    id: string;
    action: string;        // CREATE, UPDATE, DELETE, ARCHIVE, ASSIGN, COMMENT
    entity: string;        // Issue, Sprint, Project, Comment
    entityId: string;
    message: string;
    details: Record<string, unknown>;
    user: { id: string; name: string; email: string };
    createdAt: string;
  }>;
  nextCursor?: string;
}
```

---

#### `activity.getByIssue`

**Input:** `{ issueId: string; limit?: number; cursor?: string }`

---

### Integration Router (`integration.*`)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `integration.getGitHubAuthUrl` | query | **protected** | Get GitHub OAuth URL |
| `integration.connectGitHub` | mutation | **protected** | Connect GitHub account |
| `integration.getGitLabAuthUrl` | query | **protected** | Get GitLab OAuth URL |
| `integration.connectGitLab` | mutation | **protected** | Connect GitLab account |
| `integration.listRepos` | query | **protected** | List repos from connected provider |
| `integration.syncNow` | mutation | **protected** | Sync issues from external repo |
| `integration.linkGitHubPR` | mutation | **protected** | Link a GitHub PR to an issue |
| `integration.linkGitLabMR` | mutation | **protected** | Link a GitLab MR to an issue |
| `integration.getLinkedPRs` | query | **protected** | Get PRs linked to an issue |
| `integration.disconnect` | mutation | **protected** | Disconnect an integration |

#### `integration.getGitHubAuthUrl`

No input. **Response:** `{ url: string; state: string }`

---

#### `integration.connectGitHub`

**Input:**

```typescript
{
  code: string;          // OAuth authorization code
  projectId: string;     // project to link
  state?: string;        // CSRF state token
}
```

Exchanges code for token, fetches GitHub user, creates or updates Integration record.

---

#### `integration.listRepos`

**Input:** `{ integrationId: string; page?: number; perPage?: number }`

**Response:** Array of repositories/projects from the connected provider.

---

#### `integration.syncNow`

**Input:**

```typescript
{
  integrationId: string;
  repoOwner?: string;        // required for GitHub
  repoName?: string;         // required for GitHub
  gitlabProjectId?: number;  // required for GitLab
}
```

Fetches issues from the external repo and creates matching issues in Mini Linear.

---

#### `integration.linkGitHubPR`

**Input:** `{ integrationId: string; repoOwner: string; repoName: string; prNumber: number; projectId: string }`

---

#### `integration.linkGitLabMR`

**Input:** `{ integrationId: string; gitlabProjectId: number; mrIid: number; projectId: string }`

---

#### `integration.getLinkedPRs`

**Input:** `{ integrationId: string; repoOwner: string; repoName: string; issueId: string }`

---

#### `integration.disconnect`

**Input:** `{ integrationId: string }`

**Response:** `{ success: true }`

---

### Webhook Router (`webhook.*`)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `webhook.create` | mutation | **protected** | Create a webhook |
| `webhook.getById` | query | **protected** | Get webhook by ID |
| `webhook.list` | query | **protected** | List webhooks for a project |
| `webhook.update` | mutation | **protected** | Update a webhook |
| `webhook.delete` | mutation | **protected** | Delete a webhook |
| `webhook.toggle` | mutation | **protected** | Toggle webhook active/inactive |
| `webhook.test` | mutation | **protected** | Send a test ping |
| `webhook.getLogs` | query | **protected** | Get delivery logs |
| `webhook.getEventTypes` | query | **protected** | List valid event types |

#### `webhook.create`

**Input:**

```typescript
{
  projectId: string;
  url: string;             // valid URL
  secret?: string;         // 16-256 chars, auto-generated if omitted
  events: WebhookEventType[];
}
```

---

#### `webhook.list`

**Input:** `{ projectId: string }`

---

#### `webhook.update`

**Input:**

```typescript
{
  id: string;
  url?: string;
  secret?: string;
  events?: WebhookEventType[];
  active?: boolean;
}
```

---

#### `webhook.toggle`

**Input:** `{ id: string }`

Flips the `active` boolean.

---

#### `webhook.test`

**Input:** `{ webhookId: string }`

Sends a `PROJECT_UPDATED` test ping to the webhook URL.

---

#### `webhook.getLogs`

**Input:**

```typescript
{
  webhookId: string;
  limit?: number;          // 1-100, default: 50
  offset?: number;         // default: 0
  status?: "pending" | "success" | "failed";
}
```

---

#### `webhook.getEventTypes`

No input. Returns all valid webhook event types.

---

### View Router (`view.*`)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `view.create` | mutation | public | Create a view |
| `view.getById` | query | public | Get view with computed data |
| `view.update` | mutation | public | Update view name/filters |
| `view.delete` | mutation | public | Delete a view |
| `view.list` | query | public | List views for a project |
| `view.getShared` | query | public | Get shared view by token (no auth) |
| `view.toggleShare` | mutation | public | Toggle view sharing |

#### `view.create`

**Input:**

```typescript
{
  name: string;            // 1-200 chars
  type: "BOARD" | "LIST" | "TIMELINE";
  filters?: ViewFilters;
  projectId: string;
}
```

---

#### `view.getById`

**Input:**

```typescript
{
  id: string;
  page?: number;
  pageSize?: number;       // 1-100
  timelineGranularity?: "week" | "month";
}
```

**Response:** View with `viewData` computed based on type:
- `BOARD` - Kanban columns
- `LIST` - Flat list with pagination
- `TIMELINE` - Gantt-style timeline

**Access control:** Owner, shared views, or project members.

---

#### `view.update`

**Input:** `{ id: string; name?: string; filters?: ViewFilters }`

---

#### `view.delete`

**Input:** `{ id: string }`

---

#### `view.list`

**Input:** `{ projectId: string; page?: number; pageSize?: number }`

---

#### `view.getShared`

**Input:**

```typescript
{
  token: string;           // view ID used as share token
  page?: number;
  pageSize?: number;
  timelineGranularity?: "week" | "month";
}
```

No authentication required. Only returns views where `shared = true`.

---

#### `view.toggleShare`

**Input:** `{ id: string }`

**Response:**

```typescript
{
  ...view;
  shareToken: string | null;
  shareUrl: string | null;   // "/shared/{viewId}" when shared
}
```

---

## Data Models

### User

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | string | Unique email address |
| `name` | string | Display name |
| `password` | string | Bcrypt-hashed password |
| `avatar` | string? | Avatar URL |
| `role` | string | System role (default: `MEMBER`) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

### Project

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | string | Project name |
| `description` | string? | Project description |
| `key` | string | Unique project key (e.g., `MP`) |
| `status` | string | `ACTIVE` (default) |
| `ownerId` | string | FK to User |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

### ProjectMember

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `projectId` | string | FK to Project |
| `userId` | string | FK to User |
| `role` | string | `MEMBER` (default), `ADMIN`, etc. |

**Unique constraint:** `(projectId, userId)`

### Issue

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `title` | string | Issue title |
| `description` | string? | Markdown description |
| `status` | string | `BACKLOG` (default) |
| `priority` | string | `NONE` (default) |
| `labels` | string | JSON array string, default `[]` |
| `assigneeId` | string? | FK to User |
| `reporterId` | string | FK to User |
| `projectId` | string | FK to Project |
| `sprintId` | string? | FK to Sprint |
| `dueDate` | DateTime? | Due date |
| `parentId` | string? | FK to Issue (self-referential for subtasks) |
| `order` | float | Sort order (default: 0) |
| `customFields` | string | JSON object string, default `{}` |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

### IssueRelation

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `fromIssueId` | string | FK to Issue |
| `toIssueId` | string | FK to Issue |
| `type` | string | `BLOCKS`, `BLOCKED_BY`, `RELATES_TO` |

**Unique constraint:** `(fromIssueId, toIssueId, type)`

### Sprint

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | string | Sprint name |
| `description` | string? | Sprint description |
| `startDate` | DateTime | Sprint start |
| `endDate` | DateTime | Sprint end |
| `goal` | string? | Sprint goal |
| `status` | string | `PLANNED` (default) |
| `projectId` | string | FK to Project |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

### Comment

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `content` | string | Comment text |
| `authorId` | string | FK to User |
| `issueId` | string | FK to Issue |
| `parentId` | string? | FK to Comment (threaded replies) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

### AuditLog

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `action` | string | CREATE, UPDATE, DELETE, etc. |
| `entity` | string | Issue, Sprint, Project, Comment |
| `entityId` | string | Entity ID |
| `userId` | string | FK to User |
| `details` | string | JSON details string |
| `createdAt` | DateTime | Creation timestamp |

### Notification

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `type` | string | Notification type |
| `message` | string | Notification message |
| `userId` | string | FK to User |
| `read` | boolean | Default: `false` |
| `link` | string? | Deep link |
| `createdAt` | DateTime | Creation timestamp |

### View

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key (also used as share token) |
| `name` | string | View name |
| `type` | string | `BOARD`, `LIST`, or `TIMELINE` |
| `filters` | string | JSON filters string |
| `projectId` | string | FK to Project |
| `userId` | string | FK to User (owner) |
| `shared` | boolean | Default: `false` |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

---

## Enums

### Issue Status

| Value | Category | Color |
|---|---|---|
| `backlog` | todo | `#94a3b8` |
| `todo` | todo | `#f59e0b` |
| `in_progress` | in_progress | `#3b82f6` |
| `in_review` | in_progress | `#8b5cf6` |
| `done` | done | `#22c55e` |
| `cancelled` | done | `#6b7280` |

### Issue Priority

`urgent`, `high`, `medium`, `low`, `none`

### Relation Types

`BLOCKS`, `BLOCKED_BY`, `RELATES_TO`

### Sprint Status

`planning`, `active`, `completed`

---

## Webhooks

### Event Types

| Event | Trigger |
|---|---|
| `ISSUE_CREATED` | New issue created |
| `ISSUE_UPDATED` | Issue fields updated |
| `ISSUE_DELETED` | Issue deleted |
| `ISSUE_STATUS_CHANGED` | Issue status transitioned |
| `ISSUE_ASSIGNED` | Issue assigned/unassigned |
| `COMMENT_CREATED` | New comment added |
| `SPRINT_STARTED` | Sprint started |
| `SPRINT_COMPLETED` | Sprint completed |
| `PROJECT_UPDATED` | Project settings updated |

### Webhook Payload

```json
{
  "event": "ISSUE_CREATED",
  "timestamp": "2026-06-22T10:00:00.000Z",
  "projectId": "uuid",
  "data": {
    "issue": { }
  }
}
```

### Signature Verification

Each webhook delivery includes an `X-Webhook-Signature` header containing an HMAC-SHA256 signature of the request body, computed using the webhook's secret.

```javascript
const { createHmac, timingSafeEqual } = require("crypto");

function verifyWebhookSignature(payload, signature, secret) {
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Delivery Configuration

| Setting | Value |
|---|---|
| Timeout | 10 seconds |
| Max retries | 3 |
| Retry strategy | Exponential backoff |

---

## Error Handling

### REST API Errors

```json
{
  "error": "Error category",
  "message": "Human-readable description",
  "details": { }
}
```

| Status | Category | Description |
|---|---|---|
| `400` | Validation error | Invalid input, missing required fields |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not found | Resource does not exist |
| `409` | Conflict | Duplicate resource |
| `500` | Internal server error | Unexpected server failure |

### tRPC Errors

```json
{
  "message": "You must be logged in to access this resource",
  "code": "UNAUTHORIZED",
  "data": {
    "zodError": "..."
  }
}
```

| tRPC Code | HTTP Equivalent | Description |
|---|---|---|
| `BAD_REQUEST` | 400 | Invalid input or business rule violation |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected error |

### State Machine Errors

Invalid issue status transitions return `400 BAD_REQUEST` with details about valid transitions from the current status.

---

## Rate Limiting

Rate limiting is not currently implemented at the application level. For production, configure rate limiting at the reverse proxy layer.

**Suggested limits for production:**

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/auth/register` | 5 requests | 1 hour |
| `POST /api/auth/refresh` | 30 requests | 1 minute |
| `/api/trpc/*` (mutations) | 100 requests | 1 minute |
| `/api/trpc/*` (queries) | 300 requests | 1 minute |
| `/api/v1/*` | 200 requests | 1 minute |

---

## Database

The application uses **SQLite** via Prisma ORM. The database file is located at `prisma/dev.db` in development.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |
| `JWT_SECRET` | (dev secret) | Access token signing secret |
| `JWT_REFRESH_SECRET` | (dev secret) | Refresh token signing secret |
| `JWT_EXPIRES_IN` | `7d` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Refresh token lifetime |
| `NEXTAUTH_SECRET` | - | NextAuth.js secret |
| `GITHUB_CLIENT_ID` | - | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | - | GitHub OAuth client secret |
| `GITLAB_CLIENT_ID` | - | GitLab OAuth client ID |
| `GITLAB_CLIENT_SECRET` | - | GitLab OAuth client secret |
