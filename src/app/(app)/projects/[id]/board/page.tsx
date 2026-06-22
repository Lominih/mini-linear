"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { KanbanCard } from "@/components/ui/KanbanCard";
import { PageSpinner } from "@/components/ui/Spinner";

const COLUMNS = [
  { status: "backlog" as const, label: "Backlog", color: "bg-muted" },
  { status: "todo" as const, label: "Todo", color: "bg-info/20" },
  { status: "in_progress" as const, label: "In Progress", color: "bg-warning/20" },
  { status: "in_review" as const, label: "In Review", color: "bg-primary/20" },
  { status: "done" as const, label: "Done", color: "bg-success/20" },
];

export default function BoardPage({
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

  const issuesByStatus = COLUMNS.map((col) => ({
    ...col,
    issues: items.filter((issue: { status: string }) => issue.status === col.status),
  }));

  return (
    <DashboardLayout
      title="Board"
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/projects/${id}/list`}>
            <Button variant="ghost" size="sm">List View</Button>
          </Link>
          <Link href={`/projects/${id}/sprints`}>
            <Button variant="ghost" size="sm">Sprints</Button>
          </Link>
          <Button size="sm">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Issue
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
          {issuesByStatus.map((col) => (
            <div key={col.status} className="flex-shrink-0 w-72 flex flex-col">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                <h3 className="text-sm font-medium text-foreground">{col.label}</h3>
                <span className="text-xs text-muted-foreground">{col.issues.length}</span>
              </div>
              <div className="flex-1 rounded-lg bg-muted/30 p-2 space-y-2 min-h-[200px]">
                {col.issues.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                    No issues
                  </div>
                ) : (
                  col.issues.map((issue: {
                    id: string;
                    identifier?: string;
                    title: string;
                    status: string;
                    priority: string;
                    labels?: string | null;
                    assignee?: { name: string; avatar?: string | null } | null;
                  }) => {
                    const labels = issue.labels ? JSON.parse(issue.labels) : [];
                    return (
                      <KanbanCard
                        key={issue.id}
                        id={issue.id}
                        identifier={issue.identifier}
                        title={issue.title}
                        status={issue.status as "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled"}
                        priority={issue.priority as "urgent" | "high" | "medium" | "low" | "none"}
                        assignee={issue.assignee}
                        labels={labels}
                      />
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
