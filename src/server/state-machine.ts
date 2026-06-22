// State machine for issue workflow management
// Uses lowercase string status values matching Prisma enum defaults

export type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "cancelled";

export type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";

export interface StateTransition {
  from: IssueStatus;
  to: IssueStatus;
  label: string;
}

export interface WorkflowState {
  name: string;
  status: IssueStatus;
  category: "todo" | "in_progress" | "done";
  color: string;
  position: number;
}

export interface WorkflowConfig {
  states: WorkflowState[];
  transitions: StateTransition[];
}

export const DEFAULT_WORKFLOW: WorkflowConfig = {
  states: [
    { name: "Backlog", status: "backlog", category: "todo", color: "#94a3b8", position: 0 },
    { name: "Todo", status: "todo", category: "todo", color: "#f59e0b", position: 1 },
    { name: "In Progress", status: "in_progress", category: "in_progress", color: "#3b82f6", position: 2 },
    { name: "In Review", status: "in_review", category: "in_progress", color: "#8b5cf6", position: 3 },
    { name: "Done", status: "done", category: "done", color: "#22c55e", position: 4 },
    { name: "Cancelled", status: "cancelled", category: "done", color: "#6b7280", position: 5 },
  ],
  transitions: [
    { from: "backlog", to: "todo", label: "Start" },
    { from: "backlog", to: "cancelled", label: "Cancel" },

    { from: "todo", to: "in_progress", label: "Begin Work" },
    { from: "todo", to: "backlog", label: "Deprioritize" },
    { from: "todo", to: "cancelled", label: "Cancel" },

    { from: "in_progress", to: "in_review", label: "Submit for Review" },
    { from: "in_progress", to: "done", label: "Mark Complete" },
    { from: "in_progress", to: "todo", label: "Pause" },
    { from: "in_progress", to: "cancelled", label: "Cancel" },

    { from: "in_review", to: "in_progress", label: "Request Changes" },
    { from: "in_review", to: "done", label: "Approve" },
    { from: "in_review", to: "cancelled", label: "Cancel" },

    { from: "done", to: "in_progress", label: "Reopen" },
    { from: "done", to: "todo", label: "Reopen to Todo" },

    { from: "cancelled", to: "backlog", label: "Restore" },
    { from: "cancelled", to: "todo", label: "Restore to Todo" },
  ],
};

const MAX_WORKFLOW_ENTRIES = 500;

const workflowRegistry = new Map<string, { config: WorkflowConfig; lastAccess: number }>();

function evictOldestIfNeeded(): void {
  if (workflowRegistry.size <= MAX_WORKFLOW_ENTRIES) return;

  const entries = [...workflowRegistry.entries()]
    .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

  const toRemove = entries.slice(0, workflowRegistry.size - MAX_WORKFLOW_ENTRIES);
  for (const [key] of toRemove) {
    workflowRegistry.delete(key);
  }
}

export function getWorkflow(projectId: string): WorkflowConfig {
  const entry = workflowRegistry.get(projectId);
  if (entry) {
    entry.lastAccess = Date.now();
    return entry.config;
  }
  return DEFAULT_WORKFLOW;
}

export function setWorkflow(projectId: string, config: WorkflowConfig): void {
  workflowRegistry.set(projectId, { config, lastAccess: Date.now() });
  evictOldestIfNeeded();
}

export function canTransition(
  currentStatus: IssueStatus,
  targetStatus: IssueStatus,
  projectId?: string
): boolean {
  const workflow = projectId ? getWorkflow(projectId) : DEFAULT_WORKFLOW;
  return workflow.transitions.some(
    (t) => t.from === currentStatus && t.to === targetStatus
  );
}

export function getValidTransitions(
  currentStatus: IssueStatus,
  projectId?: string
): StateTransition[] {
  const workflow = projectId ? getWorkflow(projectId) : DEFAULT_WORKFLOW;
  return workflow.transitions.filter((t) => t.from === currentStatus);
}

export function validateTransition(
  currentStatus: IssueStatus,
  targetStatus: IssueStatus,
  projectId?: string
): { valid: boolean; error?: string } {
  if (currentStatus === targetStatus) {
    return { valid: false, error: "Issue is already in that status" };
  }

  if (!canTransition(currentStatus, targetStatus, projectId)) {
    return {
      valid: false,
      error: `Cannot transition from "${currentStatus}" to "${targetStatus}". Valid transitions: ${getValidTransitions(currentStatus, projectId).map((t) => t.to).join(", ")}`,
    };
  }

  return { valid: true };
}

export interface StateChangeResult {
  newStatus: IssueStatus;
  autoFields: Record<string, unknown>;
}

export function processStateChange(
  currentStatus: IssueStatus,
  targetStatus: IssueStatus,
  projectId?: string
): StateChangeResult {
  const validation = validateTransition(currentStatus, targetStatus, projectId);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const autoFields: Record<string, unknown> = {};

  return {
    newStatus: targetStatus,
    autoFields,
  };
}

export function getStatusCategory(status: IssueStatus): "todo" | "in_progress" | "done" {
  const state = DEFAULT_WORKFLOW.states.find((s) => s.status === status);
  return state?.category ?? "todo";
}

export function isTerminalStatus(status: IssueStatus): boolean {
  return status === "done" || status === "cancelled";
}
