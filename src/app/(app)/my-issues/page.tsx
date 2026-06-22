"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { IssueRow } from "@/components/ui/IssueRow";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "in_progress", label: "In Progress" },
  { value: "todo", label: "Todo" },
  { value: "in_review", label: "In Review" },
  { value: "done", label: "Done" },
] as const;

export default function MyIssuesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: issuesData, isLoading } = trpc.issue.list.useQuery({
    limit: 100,
    orderBy: "updatedAt",
    orderDirection: "desc",
  });

  const items = issuesData?.items || [];

  const filteredIssues = items.filter((issue: { status: string }) => {
    if (statusFilter === "all") return true;
    return issue.status === statusFilter;
  });

  return (
    <DashboardLayout
      title="My Issues"
      description="Issues assigned to you across all projects"
    >
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-1 border-b border-border">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
                  ${statusFilter === filter.value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {filteredIssues.length === 0 ? (
            <EmptyState
              title="No issues"
              description={
                statusFilter === "all"
                  ? "You don't have any issues assigned yet."
                  : `No ${STATUS_FILTERS.find((f) => f.value === statusFilter)?.label.toLowerCase()} issues.`
              }
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {filteredIssues.map((issue: {
                    id: string;
                    identifier?: string;
                    title: string;
                    status: string;
                    priority: string;
                    labels?: string | null;
                    assignee?: { name: string; avatar?: string | null } | null;
                    dueDate?: string | null;
                  }) => {
                    const labels = issue.labels ? JSON.parse(issue.labels) : [];
                    return (
                      <IssueRow
                        key={issue.id}
                        id={issue.id}
                        identifier={issue.identifier}
                        title={issue.title}
                        status={issue.status as "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled"}
                        priority={issue.priority as "urgent" | "high" | "medium" | "low" | "none"}
                        assignee={issue.assignee}
                        labels={labels}
                        dueDate={issue.dueDate}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
