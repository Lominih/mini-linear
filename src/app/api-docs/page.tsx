import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Documentation - Mini Linear",
  description: "REST API documentation for Mini Linear project management",
};

const API_BASE = "/api/v1";

const endpoints = [
  {
    method: "GET",
    path: `${API_BASE}/issues`,
    description: "List all issues with filtering, pagination, and sorting",
    params: [
      { name: "projectId", type: "string", required: false, description: "Filter by project ID" },
      { name: "status", type: "string", required: false, description: "Filter by status" },
      { name: "priority", type: "string", required: false, description: "Filter by priority" },
    ],
  },
  {
    method: "GET",
    path: `${API_BASE}/issues/[id]`,
    description: "Get a single issue by ID",
  },
  {
    method: "POST",
    path: `${API_BASE}/issues`,
    description: "Create a new issue",
  },
  {
    method: "PATCH",
    path: `${API_BASE}/issues/[id]`,
    description: "Update an issue",
  },
  {
    method: "DELETE",
    path: `${API_BASE}/issues/[id]`,
    description: "Delete an issue",
  },
  {
    method: "GET",
    path: `${API_BASE}/projects`,
    description: "List all projects",
  },
  {
    method: "POST",
    path: `${API_BASE}/projects`,
    description: "Create a new project",
  },
  {
    method: "GET",
    path: `${API_BASE}/projects/[id]`,
    description: "Get a single project by ID",
  },
  {
    method: "GET",
    path: `${API_BASE}/sprints`,
    description: "List all sprints",
  },
  {
    method: "POST",
    path: `${API_BASE}/sprints`,
    description: "Create a new sprint",
  },
];

export default function ApiDocsPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">API Documentation</h1>
      <p className="text-gray-600 mb-8">
        REST API endpoints for Mini Linear project management.
      </p>
      <div className="space-y-4">
        {endpoints.map((ep, i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                ep.method === "GET" ? "bg-green-100 text-green-800" :
                ep.method === "POST" ? "bg-blue-100 text-blue-800" :
                ep.method === "PATCH" ? "bg-yellow-100 text-yellow-800" :
                "bg-red-100 text-red-800"
              }`}>
                {ep.method}
              </span>
              <code className="text-sm font-mono">{ep.path}</code>
            </div>
            <p className="text-gray-700 text-sm">{ep.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}