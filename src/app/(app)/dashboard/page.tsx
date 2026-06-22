"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { IssueRow } from "@/components/ui/IssueRow";

export default function DashboardPage() {
  const { data: recentIssuesData, isLoading: issuesLoading } =
    trpc.issue.list.useQuery({
      limit: 10,
      orderBy: "updatedAt",
      orderDirection: "desc",
    });

  const { data: statsData, isLoading: statsLoading } = trpc.issue.list.useQuery({
    limit: 200,
  });

  const isLoading = issuesLoading || statsLoading;
  const recentIssues = recentIssuesData?.items || [];
  const statsItems = statsData?.items || [];

  const statusCounts = statsItems.reduce(
    (acc: Record<string, number>, issue: { status: string }) => {
      acc[issue.status] = (acc[issue.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <DashboardLayout
      title="Dashboard"
      description="Welcome back! Here's an overview of your work."
    >
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsItems.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  In Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">
                  {statusCounts["in_progress"] || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {statusCounts["done"] || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Backlog
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">
                  {statusCounts["backlog"] || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Issues</CardTitle>
              <Link href="/my-issues">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentIssues.length > 0 ? (
                <div className="divide-y divide-border">
                  {recentIssues.map(
                    (issue: {
                      id: string;
                      identifier?: string;
                      title: string;
                      status: string;
                      priority: string;
                      labels?: string | null;
                      assignee?: { name: string; avatar?: string | null } | null;
                    }) => {
                      const labels = issue.labels
                        ? JSON.parse(issue.labels)
                        : [];
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
                        />
                      );
                    }
                  )}
                </div>
              ) : (
                <EmptyState
                  title="No issues yet"
                  description="Create your first issue to get started."
                  action={
                    <Link href="/projects">
                      <Button size="sm">Go to Projects</Button>
                    </Link>
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
