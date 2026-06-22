"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ErrorFallbackProps {
  error?: Error | null;
  onRetry?: () => void;
  title?: string;
  description?: string;
}

export function ErrorFallback({
  error,
  onRetry,
  title = "Something went wrong",
  description,
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const router = useRouter();

  const message =
    description ?? error?.message ?? "An unexpected error occurred.";
  const detail = error?.stack ?? error?.message;

  return (
    <Card className="max-w-md mx-auto mt-12">
      <CardContent className="p-8 flex flex-col items-center text-center">
        {/* Error icon */}
        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <svg
            className="h-6 w-6 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-1">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">{message}</p>

        {/* Details toggle */}
        {detail && (
          <div className="w-full mb-4">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              <svg
                className={`h-3 w-3 transition-transform ${showDetails ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 4.5l7.5 7.5-7.5 7.5"
                />
              </svg>
              {showDetails ? "Hide details" : "Show details"}
            </button>
            {showDetails && (
              <pre className="mt-2 w-full rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground text-left overflow-x-auto whitespace-pre-wrap">
                {detail}
              </pre>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {onRetry && (
            <Button variant="primary" size="sm" onClick={onRetry}>
              Try Again
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push("/")}
          >
            Go Home
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
