"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Unhandled global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
          <div className="rounded-full bg-destructive/10 p-4">
            <svg
              className="h-10 w-10 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            Application Error
          </h1>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            A critical error occurred that prevented the application from
            rendering. Try reloading the page.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/60 font-mono">
              Error ID: {error.digest}
            </p>
          )}
          <details className="w-full max-w-md rounded-lg border border-border bg-muted/50 p-4">
            <summary className="text-sm font-medium text-foreground cursor-pointer">
              Error Details
            </summary>
            <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
          <button
            onClick={reset}
            className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-lg
              bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              transition-colors"
          >
            Reload Page
          </button>
        </div>
      </body>
    </html>
  );
}
