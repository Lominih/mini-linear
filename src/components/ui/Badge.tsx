import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "primary" | "secondary" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
};

export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";

const statusColors: Record<IssueStatus, string> = {
  backlog: "bg-muted text-muted-foreground",
  todo: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  in_review: "bg-primary/10 text-primary",
  done: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  cancelled: "Cancelled",
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: IssueStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[status]} ${className}`}
    >
      {statusLabels[status]}
    </span>
  );
}

type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";

const priorityColors: Record<IssuePriority, string> = {
  urgent: "bg-destructive/10 text-destructive",
  high: "bg-warning/10 text-warning",
  medium: "bg-info/10 text-info",
  low: "bg-muted text-muted-foreground",
  none: "bg-muted text-muted-foreground",
};

const priorityLabels: Record<IssuePriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

export function PriorityBadge({
  priority,
  className = "",
}: {
  priority: IssuePriority;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColors[priority]} ${className}`}
    >
      {priorityLabels[priority]}
    </span>
  );
}
