"use client";

import { AppLayout } from "@/components/layout/AppLayout";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout
      user={{
        name: "Demo User",
        email: "user@minilinear.dev",
      }}
      projects={[]}
    >
      {children}
    </AppLayout>
  );
}
