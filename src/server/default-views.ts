import { type PrismaClient } from "@/generated/prisma/client";

// 鈹€鈹€鈹€ Default View Definitions 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

interface DefaultViewDef {
  name: string;
  type: "BOARD" | "LIST" | "TIMELINE";
  filters: Record<string, unknown>;
  shared: boolean;
}

const DEFAULT_VIEWS: DefaultViewDef[] = [
  {
    name: "All Issues",
    type: "LIST",
    filters: {
      groups: [],
      sort: [{ field: "createdAt", direction: "desc" }],
    },
    shared: false,
  },
  {
    name: "Board",
    type: "BOARD",
    filters: {
      groups: [],
      sort: [{ field: "order", direction: "asc" }],
    },
    shared: false,
  },
  {
    name: "My Issues",
    type: "LIST",
    filters: {
      groups: [
        {
          logic: "and",
          filters: [
            {
              field: "assigneeId",
              operator: "equals",
              value: "__currentUserId__",
            },
          ],
        },
      ],
      sort: [{ field: "priority", direction: "asc" }],
    },
    shared: false,
  },
];

// 鈹€鈹€鈹€ Create Default Views 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export async function createDefaultViews(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
): Promise<void> {
  const viewData = DEFAULT_VIEWS.map((def) => {
    const filters = JSON.parse(JSON.stringify(def.filters));
    replaceUserIdPlaceholder(filters, userId);

    return {
      name: def.name,
      type: def.type,
      filters: JSON.stringify(filters),
      projectId,
      userId,
      shared: def.shared,
    };
  });

  await prisma.view.createMany({
    data: viewData,
  });
}

function replaceUserIdPlaceholder(
  obj: Record<string, unknown>,
  userId: string,
): void {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "string" && val === "__currentUserId__") {
      obj[key] = userId;
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === "object" && item !== null) {
          replaceUserIdPlaceholder(item as Record<string, unknown>, userId);
        }
      }
    } else if (typeof val === "object" && val !== null) {
      replaceUserIdPlaceholder(val as Record<string, unknown>, userId);
    }
  }
}

export default createDefaultViews;

