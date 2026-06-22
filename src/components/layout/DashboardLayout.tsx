"use client";

import type { ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export function DashboardLayout({
  children,
  title,
  description,
  actions,
}: DashboardLayoutProps) {
  return (
    <div className="flex flex-col h-full">
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-border px-4 md:px-6 py-4">
          <div>
            {title && (
              <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            )}
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
    </div>
  );
}
