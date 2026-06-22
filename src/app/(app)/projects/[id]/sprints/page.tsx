"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { SprintCard } from "@/components/ui/SprintCard";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

export default function SprintsPage({
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

  const sprintMap = new Map<string, {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    goal?: string;
    issueCount: number;
    completedCount: number;
  }>();

  items.forEach((issue: {
    sprintId?: string | null;
    sprint?: { id: string; name: string; status: string; startDate: string; endDate: string; goal?: string | null } | null;
    status: string;
  }) => {
    if (issue.sprint) {
      const sprint = issue.sprint;
      if (!sprintMap.has(sprint.id)) {
        sprintMap.set(sprint.id, {
          id: sprint.id,
          name: sprint.name,
          status: sprint.status,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          goal: sprint.goal || undefined,
          issueCount: 0,
          completedCount: 0,
        });
      }
      const entry = sprintMap.get(sprint.id)!;
      entry.issueCount++;
      if (issue.status === "done" || issue.status === "cancelled") {
        entry.completedCount++;
      }
    }
  });

  const sprints = Array.from(sprintMap.values());

  return (
    <DashboardLayout
      title="Sprints"
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/projects/${id}/board`}>
            <Button variant="ghost" size="sm">Board</Button>
          </Link>
          <Button size="sm">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Sprint
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <PageSpinner />
      ) : sprints.length === 0 ? (
        <EmptyState
          title="No sprints"
          description="Create your first sprint to start planning work."
          action={<Button>Create Sprint</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sprints.map((sprint) => (
            <Link key={sprint.id} href={`/projects/${id}/sprints/${sprint.id}`}>
              <SprintCard
                id={sprint.id}
                name={sprint.name}
                status={sprint.status as "planned" | "active" | "completed" | "cancelled"}
                startDate={sprint.startDate}
                endDate={sprint.endDate}
                goal={sprint.goal}
                issueCount={sprint.issueCount}
                completedCount={sprint.completedCount}
              />
            </Link>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
