import { Avatar } from "./Avatar";
import { PriorityBadge, StatusBadge } from "./Badge";

interface KanbanCardProps {
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
  onClick?: () => void;
}

export function KanbanCard({
  identifier,
  title,
  status,
  priority,
  assignee,
  labels,
  onClick,
}: KanbanCardProps) {
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
      className="rounded-lg border border-border bg-background p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {identifier && (
            <span className="text-xs text-muted-foreground font-mono">{identifier}</span>
          )}
          <h4 className="text-sm font-medium text-foreground line-clamp-2 mt-0.5">{title}</h4>
        </div>
        <PriorityBadge priority={priority} />
      </div>
      {labels && labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
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
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
        <StatusBadge status={status} />
        {assignee && (
          <Avatar
            name={assignee.name}
            src={assignee.avatar}
            size="sm"
          />
        )}
      </div>
    </div>
  );
}
