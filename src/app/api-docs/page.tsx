import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Documentation - Mini Linear",
  description: "REST API documentation for Mini Linear project management",
};

const API_BASE = "/api/v1";

const endpoints = [
  {
    method: "GET",
    path: ${API_BASE}/issues,
    description: "List all issues with filtering, pagination, and sorting",
    params: [
      { name: "projectId", type: "string", required: false, description: "Filter by project ID" },
      { name: "status", type: "string", required: false, description: "Filter by status: backlog, todo, in_progress, in_review, done, cancelled" },
      { name: "priority", type: "string", required: false, description: "Filter by priority: urgent, high, medium, low, none" },
      { name: "assigneeId", type: "string", required: false, description: "Filter by assignee user ID" },
      { name: "sprintId", type: "string", required: false, description: "Filter by sprint ID" },
      { name: "label", type: "string", required: false, description: "Filter by label name" },
      { name: "search", type: "string", required: false, description: "Search in title and description" },
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 50, max: 100)" },
      { name: "orderBy", type: "string", required: false, description: "Sort field: createdAt, updatedAt, priority, order, title" },
      { name: "orderDirection", type: "string", required: false, description: "Sort direction: asc, desc (default: desc)" },
    ],
    body: null,
  },
  {
    method: "POST",
    path: ${API_BASE}/issues,
    description: "Create a new issue",
    params: null,
    body: [
      { name: "title", type: "string", required: true, description: "Issue title" },
      { name: "projectId", type: "string", required: true, description: "Project ID" },
      { name: "description", type: "string", required: false, description: "Issue description" },
      { name: "priority", type: "string", required: false, description: "Priority level" },
      { name: "assigneeId", type: "string", required: false, description: "Assignee user ID" },
      { name: "labels", type: "string[]", required: false, description: "Array of label strings" },
      { name: "dueDate", type: "string", required: false, description: "ISO 8601 date string" },
      { name: "sprintId", type: "string", required: false, description: "Sprint ID to assign" },
    ],
  },
  {
    method: "GET",
    path: ${API_BASE}/issues/[id],
    description: "Get a single issue with all relations (comments, sub-issues, relations)",
    params: null,
    body: null,
  },
  {
    method: "PUT",
    path: ${API_BASE}/issues/[id],
    description: "Update an existing issue",
    params: null,
    body: [
      { name: "title", type: "string", required: false, description: "Issue title" },
      { name: "description", type: "string", required: false, description: "Issue description" },
      { name: "status", type: "string", required: false, description: "New status" },
      { name: "priority", type: "string", required: false, description: "New priority" },
      { name: "assigneeId", type: "string|null", required: false, description: "New assignee (null to unassign)" },
      { name: "labels", type: "string[]", required: false, description: "Replacement labels array" },
      { name: "dueDate", type: "string|null", required: false, description: "New due date (null to remove)" },
      { name: "sprintId", type: "string|null", required: false, description: "New sprint (null to remove)" },
    ],
  },
  {
    method: "DELETE",
    path: ${API_BASE}/issues/[id],
    description: "Delete an issue and all its relations",
    params: null,
    body: null,
  },
  {
    method: "GET",
    path: ${API_BASE}/projects,
    description: "List all projects with issue/member/sprint counts",
    params: [
      { name: "status", type: "string", required: false, description: "Filter by status: active, archived, planning, on_hold" },
      { name: "search", type: "string", required: false, description: "Search in name, description, key" },
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 50, max: 100)" },
    ],
    body: null,
  },
  {
    method: "GET",
    path: ${API_BASE}/sprints,
    description: "List all sprints with progress stats",
    params: [
      { name: "projectId", type: "string", required: false, description: "Filter by project ID" },
      { name: "status", type: "string", required: false, description: "Filter by status: planned, active, completed, cancelled" },
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 50, max: 100)" },
    ],
    body: null,
  },
  {
    method: "GET",
    path: "/api/export/[projectId]",
    description: "Export all project data (issues, sprints, members) as JSON",
    params: null,
    body: null,
  },
];

const methodColors: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-800",
  POST: "bg-blue-100 text-blue-800",
  PUT: "bg-amber-100 text-amber-800",
  DELETE: "bg-red-100 text-red-800",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span className={inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-bold }>
      {method}
    </span>
  );
}

function EndpointCard({ endpoint }: { endpoint: (typeof endpoints)[number] }) {
  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <MethodBadge method={endpoint.method} />
        <code className="text-sm font-mono text-gray-800">{endpoint.path}</code>
      </div>
      <p className="text-gray-600 text-sm mb-4">{endpoint.description}</p>

      {endpoint.params && endpoint.params.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Query Parameters</h4>
          <div className="space-y-1">
            {endpoint.params.map((p) => (
              <div key={p.name} className="flex items-start gap-2 text-sm">
                <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 shrink-0">{p.name}</code>
                <span className="text-gray-400 text-xs">{p.type}</span>
                {p.required && <span className="text-red-500 text-xs font-medium">required</span>}
                <span className="text-gray-500 text-xs">{p.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {endpoint.body && endpoint.body.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Request Body (JSON)</h4>
          <div className="space-y-1">
            {endpoint.body.map((p) => (
              <div key={p.name} className="flex items-start gap-2 text-sm">
                <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 shrink-0">{p.name}</code>
                <span className="text-gray-400 text-xs">{p.type}</span>
                {p.required && <span className="text-red-500 text-xs font-medium">required</span>}
                <span className="text-gray-500 text-xs">{p.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mini Linear API</h1>
          <p className="text-gray-600">
            REST API for issues, projects, sprints, and exports. All endpoints require Bearer token authentication.
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <strong>Authentication:</strong> Include an <code>Authorization: Bearer &lt;token&gt;</code> header
            or set an <code>access-token</code> cookie with a valid JWT.
          </div>
        </div>

        <div className="space-y-4">
          {endpoints.map((ep, i) => (
            <EndpointCard key={${ep.method}--} endpoint={ep} />
          ))}
        </div>

        <div className="mt-12 p-6 bg-white border border-gray-200 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Response Format</h2>
          <p className="text-sm text-gray-600 mb-3">
            All list endpoints return a paginated response with <code>data</code> and <code>meta</code> fields:
          </p>
          <pre className="bg-gray-50 p-4 rounded text-xs font-mono text-gray-700 overflow-x-auto">{{
  "data": [...],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}}</pre>
          <p className="text-sm text-gray-600 mt-3">
            Single-item endpoints return <code>{{ "data": { ... } }}</code>.
            Errors return <code>{{ "error": "message" }}</code> with an appropriate HTTP status code.
          </p>
        </div>

        <div className="mt-6 text-center text-xs text-gray-400">
          Mini Linear API v1
        </div>
      </div>
    </div>
  );
}
