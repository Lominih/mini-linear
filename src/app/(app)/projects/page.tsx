"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success",
  ARCHIVED: "bg-muted text-muted-foreground",
  PLANNING: "bg-warning/10 text-warning",
  ON_HOLD: "bg-destructive/10 text-destructive",
};

interface ProjectInfo {
  id: string;
  name: string;
  key: string;
  status: string;
  issueCount: number;
}

export default function ProjectsPage() {
  const { data: issuesData, isLoading } = trpc.issue.list.useQuery({
    limit: 200,
  });

  const items = issuesData?.items || [];

  const projectMap = new Map<string, ProjectInfo>();

  items.forEach((issue: { projectId: string }) => {
    if (!projectMap.has(issue.projectId)) {
      projectMap.set(issue.projectId, {
        id: issue.projectId,
        name: issue.projectId,
        key: issue.projectId.slice(0, 4).toUpperCase(),
        status: "ACTIVE",
        issueCount: 0,
      });
    }
    projectMap.get(issue.projectId)!.issueCount++;
  });

  const projectList = Array.from(projectMap.values());

  return (
    <DashboardLayout
      title="Projects"
      description="Manage your team's projects"
      actions={
        <Button size="sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Project
        </Button>
      }
    >
      {isLoading ? (
        <PageSpinner />
      ) : projectList.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start organizing work."
          action={<Button>Create Project</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectList.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {project.key.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <CardTitle className="text-base">{project.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {project.key}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[project.status]}`}
                    >
                      {project.status.replace("_", " ")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {project.issueCount} issue{project.issueCount !== 1 ? "s" : ""}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
