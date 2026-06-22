"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageSpinner } from "@/components/ui/Spinner";

export default function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: issuesData, isLoading } = trpc.issue.list.useQuery({
    projectId: id,
    limit: 200,
  });

  const items = issuesData?.items || [];

  const statusCounts = items.reduce(
    (acc: Record<string, number>, issue: { status: string }) => {
      acc[issue.status] = (acc[issue.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalIssues = items.length;
  const doneCount = (statusCounts["done"] || 0) + (statusCounts["cancelled"] || 0);
  const progress = totalIssues > 0 ? Math.round((doneCount / totalIssues) * 100) : 0;

  return (
    <DashboardLayout
      title="Project Overview"
      description={`Project ${id}`}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/projects/${id}/board`}>
            <Button variant="secondary" size="sm">Board</Button>
          </Link>
          <Link href={`/projects/${id}/list`}>
            <Button variant="secondary" size="sm">List</Button>
          </Link>
          <Link href={`/projects/${id}/sprints`}>
            <Button variant="secondary" size="sm">Sprints</Button>
          </Link>
        </div>
      }
    >
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium text-foreground">{progress}%</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {doneCount} of {totalIssues} issues completed
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { key: "backlog", label: "Backlog", color: "text-muted-foreground" },
              { key: "todo", label: "Todo", color: "text-info" },
              { key: "in_progress", label: "In Progress", color: "text-warning" },
              { key: "in_review", label: "In Review", color: "text-primary" },
              { key: "done", label: "Done", color: "text-success" },
              { key: "cancelled", label: "Cancelled", color: "text-destructive" },
            ].map((status) => (
              <Card key={status.key}>
                <CardContent className="p-4 text-center">
                  <div className={`text-2xl font-bold ${status.color}`}>
                    {statusCounts[status.key] || 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{status.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
