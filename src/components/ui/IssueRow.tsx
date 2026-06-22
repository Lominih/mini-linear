import { Avatar } from "./Avatar";
import { PriorityBadge, StatusBadge } from "./Badge";

interface IssueRowProps {
  id: string;
  identifier?: string;
  title: string;
  status: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";
  priority: "urgent" | "high" | "medium" | "low" | "none";
  assignee?: {
    name: string;
    avatar?: string | null;
  } | null;
  labels?: string[];
  dueDate?: string | null;
  onClick?: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function IssueRow({
  identifier,
  title,
  status,
  priority,
  assignee,
  labels,
  dueDate,
  onClick,
}: IssueRowProps) {
  const isOverdue =
    dueDate && new Date(dueDate) < new Date() && status !== "done" && status !== "cancelled";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors cursor-pointer"
    >
      <StatusBadge status={status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {identifier && (
            <span className="text-xs text-muted-foreground font-mono shrink-0">{identifier}</span>
          )}
          <span className="text-sm font-medium text-foreground truncate">{title}</span>
        </div>
        {labels && labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {labels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
      <PriorityBadge priority={priority} />
      {dueDate && (
        <span
          className={`text-xs shrink-0 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}
        >
          {formatDate(dueDate)}
        </span>
      )}
      {assignee && (
        <Avatar name={assignee.name} src={assignee.avatar} size="sm" />
      )}
    </div>
  );
}
