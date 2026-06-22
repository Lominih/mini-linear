"use client";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppLayoutProps {
  children: React.ReactNode;
  projects?: Array<{ id: string; name: string; key: string }>;
  user?: {
    name: string;
    email: string;
    avatar?: string | null;
  };
}

export function AppLayout({ children, projects = [], user }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar projects={projects} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
