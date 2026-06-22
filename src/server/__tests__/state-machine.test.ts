import { describe, it, expect, beforeEach } from "vitest";
import {
  canTransition,
  getValidTransitions,
  validateTransition,
  processStateChange,
  getStatusCategory,
  isTerminalStatus,
  getWorkflow,
  setWorkflow,
  DEFAULT_WORKFLOW,
  type IssueStatus,
  type WorkflowConfig,
} from "@/server/state-machine";

// ─── canTransition ───────────────────────────────────────────────────────────

describe("canTransition", () => {
  it("allows backlog → todo", () => {
    expect(canTransition("backlog", "todo")).toBe(true);
  });

  it("allows backlog → cancelled", () => {
    expect(canTransition("backlog", "cancelled")).toBe(true);
  });

  it("blocks backlog → done (direct)", () => {
    expect(canTransition("backlog", "done")).toBe(false);
  });

  it("blocks backlog → in_progress", () => {
    expect(canTransition("backlog", "in_progress")).toBe(false);
  });

  it("allows todo → in_progress", () => {
    expect(canTransition("todo", "in_progress")).toBe(true);
  });

  it("allows todo → backlog (deprioritize)", () => {
    expect(canTransition("todo", "backlog")).toBe(true);
  });

  it("allows in_progress → in_review", () => {
    expect(canTransition("in_progress", "in_review")).toBe(true);
  });

  it("allows in_progress → done", () => {
    expect(canTransition("in_progress", "done")).toBe(true);
  });

  it("allows in_review → in_progress (request changes)", () => {
    expect(canTransition("in_review", "in_progress")).toBe(true);
  });

  it("allows in_review → done (approve)", () => {
    expect(canTransition("in_review", "done")).toBe(true);
  });

  it("allows done → in_progress (reopen)", () => {
    expect(canTransition("done", "in_progress")).toBe(true);
  });

  it("allows done → todo (reopen to todo)", () => {
    expect(canTransition("done", "todo")).toBe(true);
  });

  it("allows cancelled → backlog (restore)", () => {
    expect(canTransition("cancelled", "backlog")).toBe(true);
  });

  it("allows cancelled → todo (restore to todo)", () => {
    expect(canTransition("cancelled", "todo")).toBe(true);
  });

  it("blocks done → backlog directly", () => {
    expect(canTransition("done", "backlog")).toBe(false);
  });

  it("blocks same-status transitions are not defined", () => {
    expect(canTransition("todo", "todo")).toBe(false);
  });
});

// ─── getValidTransitions ─────────────────────────────────────────────────────

describe("getValidTransitions", () => {
  it("returns 2 transitions from backlog", () => {
    const transitions = getValidTransitions("backlog");
    expect(transitions).toHaveLength(2);
    expect(transitions.map((t) => t.to)).toEqual(["todo", "cancelled"]);
  });

  it("returns 4 transitions from in_progress", () => {
    const transitions = getValidTransitions("in_progress");
    expect(transitions).toHaveLength(4);
    expect(transitions.map((t) => t.to)).toContain("in_review");
    expect(transitions.map((t) => t.to)).toContain("done");
    expect(transitions.map((t) => t.to)).toContain("todo");
    expect(transitions.map((t) => t.to)).toContain("cancelled");
  });

  it("returns 2 transitions from done", () => {
    const transitions = getValidTransitions("done");
    expect(transitions).toHaveLength(2);
    expect(transitions.map((t) => t.to)).toContain("in_progress");
    expect(transitions.map((t) => t.to)).toContain("todo");
  });

  it("returns 2 transitions from cancelled", () => {
    const transitions = getValidTransitions("cancelled");
    expect(transitions).toHaveLength(2);
  });
});

// ─── validateTransition ──────────────────────────────────────────────────────

describe("validateTransition", () => {
  it("rejects same-status transitions", () => {
    const result = validateTransition("todo", "todo");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("already in that status");
  });

  it("rejects invalid transitions with helpful message", () => {
    const result = validateTransition("backlog", "done");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Valid transitions");
  });

  it("accepts valid transitions", () => {
    const result = validateTransition("backlog", "todo");
    expect(result.valid).toBe(true);
  });
});

// ─── processStateChange ──────────────────────────────────────────────────────

describe("processStateChange", () => {
  it("returns new status on valid transition", () => {
    const result = processStateChange("backlog", "todo");
    expect(result.newStatus).toBe("todo");
    expect(result.autoFields).toBeDefined();
  });

  it("throws on invalid transition", () => {
    expect(() => processStateChange("backlog", "done")).toThrow(
      /Cannot transition/
    );
  });

  it("throws on same-status transition", () => {
    expect(() => processStateChange("todo", "todo")).toThrow(
      /already in that status/
    );
  });
});

// ─── getStatusCategory ───────────────────────────────────────────────────────

describe("getStatusCategory", () => {
  it("returns 'todo' for backlog", () => {
    expect(getStatusCategory("backlog")).toBe("todo");
  });

  it("returns 'todo' for todo", () => {
    expect(getStatusCategory("todo")).toBe("todo");
  });

  it("returns 'in_progress' for in_progress", () => {
    expect(getStatusCategory("in_progress")).toBe("in_progress");
  });

  it("returns 'in_progress' for in_review", () => {
    expect(getStatusCategory("in_review")).toBe("in_progress");
  });

  it("returns 'done' for done", () => {
    expect(getStatusCategory("done")).toBe("done");
  });

  it("returns 'done' for cancelled", () => {
    expect(getStatusCategory("cancelled")).toBe("done");
  });
});

// ─── isTerminalStatus ────────────────────────────────────────────────────────

describe("isTerminalStatus", () => {
  it("done is terminal", () => {
    expect(isTerminalStatus("done")).toBe(true);
  });

  it("cancelled is terminal", () => {
    expect(isTerminalStatus("cancelled")).toBe(true);
  });

  it("in_progress is not terminal", () => {
    expect(isTerminalStatus("in_progress")).toBe(false);
  });

  it("todo is not terminal", () => {
    expect(isTerminalStatus("todo")).toBe(false);
  });

  it("backlog is not terminal", () => {
    expect(isTerminalStatus("backlog")).toBe(false);
  });
});

// ─── Workflow Registry ───────────────────────────────────────────────────────

describe("Workflow Registry", () => {
  it("returns default workflow for unknown project", () => {
    const wf = getWorkflow("nonexistent-project");
    expect(wf).toBe(DEFAULT_WORKFLOW);
  });

  it("returns custom workflow for registered project", () => {
    const custom: WorkflowConfig = {
      states: [],
      transitions: [{ from: "backlog", to: "done", label: "Skip" }],
    };
    setWorkflow("custom-proj", custom);
    const wf = getWorkflow("custom-proj");
    expect(wf.transitions).toHaveLength(1);
    expect(wf.transitions[0].label).toBe("Skip");
  });

  it("canTransition uses custom workflow when projectId provided", () => {
    expect(canTransition("backlog", "done", "custom-proj")).toBe(true);
  });
});
