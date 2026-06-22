import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { Badge } from "./Badge";

interface SprintCardProps {
  id: string;
  name: string;
  description?: string | null;
  status: "planned" | "active" | "completed" | "cancelled";
  startDate: string;
  endDate: string;
  goal?: string | null;
  issueCount?: number;
  completedCount?: number;
  onClick?: () => void;
}

const sprintStatusStyles: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-success/10 text-success",
  completed: "bg-info/10 text-info",
  cancelled: "bg-destructive/10 text-destructive",
};

const sprintStatusLabels: Record<string, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function SprintCard({
  name,
  description,
  status,
  startDate,
  endDate,
  goal,
  issueCount = 0,
  completedCount = 0,
  onClick,
}: SprintCardProps) {
  const progress = issueCount > 0 ? Math.round((completedCount / issueCount) * 100) : 0;

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${onClick ? "" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{name}</CardTitle>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sprintStatusStyles[status]}`}
          >
            {sprintStatusLabels[status]}
          </span>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        {goal && (
          <p className="text-sm text-foreground mb-3">
            <span className="text-muted-foreground">Goal:</span> {goal}
          </p>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <span>
            {formatDate(startDate)} — {formatDate(endDate)}
          </span>
          <span>
            {completedCount}/{issueCount} issues
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{progress}% complete</p>
      </CardContent>
    </Card>
  );
}
