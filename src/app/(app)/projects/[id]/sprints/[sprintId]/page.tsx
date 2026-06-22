"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { IssueRow } from "@/components/ui/IssueRow";
import { Badge } from "@/components/ui/Badge";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

const sprintStatusStyles: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-success/10 text-success",
  completed: "bg-info/10 text-info",
  cancelled: "bg-destructive/10 text-destructive",
};

const sprintStatusLabels: Record<string, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function SprintDetailPage({
  params,
}: {
  params: Promise<{ id: string; sprintId: string }>;
}) {
  const { id, sprintId } = use(params);
  const { data: sprint, isLoading } = trpc.sprint.getById.useQuery({ id: sprintId });

  const progress = sprint
    ? Math.round(
        ((sprint as { completedCount?: number }).completedCount || 0) /
          Math.max((sprint as { issueCount?: number }).issueCount || 1, 1) *
          100
      )
    : 0;

  return (
    <DashboardLayout
      title={(sprint as { name?: string })?.name || "Sprint Detail"}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/projects/${id}/sprints`}>
            <Button variant="ghost" size="sm">Back to Sprints</Button>
          </Link>
          <Link href={`/projects/${id}/board`}>
            <Button variant="ghost" size="sm">Board</Button>
          </Link>
        </div>
      }
    >
      {isLoading ? (
        <PageSpinner />
      ) : !sprint ? (
        <EmptyState title="Sprint not found" />
      ) : (
        <div className="space-y-6">
          {/* Sprint info */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">{(sprint as { name: string }).name}</h2>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sprintStatusStyles[(sprint as { status: string }).status]}`}
                    >
                      {sprintStatusLabels[(sprint as { status: string }).status]}
                    </span>
                  </div>
                  {(sprint as { description?: string }).description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {(sprint as { description: string }).description}
                    </p>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {(sprint as { startDate: string }).startDate &&
                    new Date((sprint as { startDate: string }).startDate).toLocaleDateString()}{" "}
                  ¡ª{" "}
                  {(sprint as { endDate: string }).endDate &&
                    new Date((sprint as { endDate: string }).endDate).toLocaleDateString()}
                </div>
              </div>

              {(sprint as { goal?: string }).goal && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50">
                  <span className="text-xs font-medium text-muted-foreground">Goal</span>
                  <p className="text-sm text-foreground mt-0.5">
                    {(sprint as { goal: string }).goal}
                  </p>
                </div>
              )}

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Progress</span>
                  <span className="text-sm font-medium">{progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sprint issues */}
          <Card>
            <CardHeader>
              <CardTitle>
                Sprint Issues ({(sprint as { issues?: unknown[] })?.issues?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(sprint as { issues?: Array<{
                id: string;
                identifier?: string;
                title: string;
                status: string;
                priority: string;
                labels?: string | null;
                assignee?: { name: string; avatar?: string | null } | null;
                dueDate?: string | null;
              }> })?.issues && (sprint as { issues: unknown[] }).issues.length > 0 ? (
                <div className="divide-y divide-border">
                  {(sprint as { issues: Array<{
                    id: string;
                    identifier?: string;
                    title: string;
                    status: string;
                    priority: string;
                    labels?: string | null;
                    assignee?: { name: string; avatar?: string | null } | null;
                    dueDate?: string | null;
                  }> }).issues.map((issue) => {
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
              ) : (
                <EmptyState
                  title="No issues in this sprint"
                  description="Add issues from the backlog to this sprint."
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
