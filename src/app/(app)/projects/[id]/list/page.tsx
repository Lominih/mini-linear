"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { IssueRow } from "@/components/ui/IssueRow";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: issuesData, isLoading } = trpc.issue.list.useQuery({
    projectId: id,
    limit: 200,
    orderBy: "order",
    orderDirection: "asc",
  });

  const items = issuesData?.items || [];

  return (
    <DashboardLayout
      title="Issues"
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/projects/${id}/board`}>
            <Button variant="ghost" size="sm">Board View</Button>
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
      ) : items.length === 0 ? (
        <EmptyState
          title="No issues"
          description="Create your first issue to get started."
          action={<Button>Create Issue</Button>}
        />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
            <span className="w-[120px]">Status</span>
            <span className="flex-1">Title</span>
            <span className="w-[80px]">Priority</span>
            <span className="w-[80px]">Due</span>
            <span className="w-8"> </span>
          </div>
          {items.map((issue: {
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
      )}
    </DashboardLayout>
  );
}
