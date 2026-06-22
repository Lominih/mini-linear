"use client";

import { useCallback, useMemo } from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  pages.push(1);

  if (current > 3) {
    pages.push("...");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("...");
  }

  pages.push(total);

  return pages;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const pages = useMemo(
    () => getPageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      action: "prev" | "next" | "page",
      page?: number
    ) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (action === "prev") onPageChange(currentPage - 1);
        else if (action === "next") onPageChange(currentPage + 1);
        else if (page !== undefined) onPageChange(page);
      }
    },
    [currentPage, onPageChange]
  );

  if (totalPages <= 1) return null;

  return (
    <nav
      className="flex items-center justify-center gap-1"
      role="navigation"
      aria-label="Pagination"
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        onKeyDown={(e) => handleKeyDown(e, "prev")}
        disabled={currentPage <= 1}
        className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-md
          text-foreground hover:bg-muted transition-colors
          disabled:pointer-events-none disabled:opacity-50"
        aria-label="Previous page"
      >
        Previous
      </button>

      {pages.map((page, index) => {
        if (page === "...") {
          return (
            <span
              key={`ellipsis-${index}`}
              className="inline-flex items-center justify-center h-8 w-8 text-sm text-muted-foreground"
              aria-hidden="true"
            >
              …
            </span>
          );
        }

        const isActive = page === currentPage;

        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            onKeyDown={(e) => handleKeyDown(e, "page", page)}
            disabled={isActive}
            className={`inline-flex items-center justify-center h-8 min-w-[2rem] px-2 text-sm font-medium rounded-md
              transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }
              disabled:pointer-events-none`}
            aria-label={`Page ${page}`}
            aria-current={isActive ? "page" : undefined}
          >
            {page}
          </button>
        );
      })}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        onKeyDown={(e) => handleKeyDown(e, "next")}
        disabled={currentPage >= totalPages}
        className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-md
          text-foreground hover:bg-muted transition-colors
          disabled:pointer-events-none disabled:opacity-50"
        aria-label="Next page"
      >
        Next
      </button>

      <span className="ml-2 text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
    </nav>
  );
}
