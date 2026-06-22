import { prisma } from "@/server/prisma";
import { createHmac, timingSafeEqual } from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export type WebhookEventType =
  | "ISSUE_CREATED"
  | "ISSUE_UPDATED"
  | "ISSUE_DELETED"
  | "ISSUE_STATUS_CHANGED"
  | "ISSUE_ASSIGNED"
  | "COMMENT_CREATED"
  | "SPRINT_STARTED"
  | "SPRINT_COMPLETED"
  | "PROJECT_UPDATED";

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  projectId: string;
  data: Record<string, unknown>;
}

export interface WebhookDeliveryResult {
  webhookId: string;
  success: boolean;
  status: number;
  response: string;
  duration: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_RETRY_ATTEMPTS = 3;
const VALID_EVENTS: WebhookEventType[] = [
  "ISSUE_CREATED",
  "ISSUE_UPDATED",
  "ISSUE_DELETED",
  "ISSUE_STATUS_CHANGED",
  "ISSUE_ASSIGNED",
  "COMMENT_CREATED",
  "SPRINT_STARTED",
  "SPRINT_COMPLETED",
  "PROJECT_UPDATED",
];

// ─── Webhook Registration ────────────────────────────────────────────────────

/**
 * Register a new webhook for a project.
 */
export async function registerWebhook(params: {
  projectId: string;
  url: string;
  secret?: string;
  events: WebhookEventType[];
}) {
  const webhook = await prisma.webhook.create({
    data: {
      projectId: params.projectId,
      url: params.url,
      secret: params.secret ?? generateSecret(),
      events: JSON.stringify(params.events),
      active: true,
    },
  });

  return webhook;
}

/**
 * Update an existing webhook.
 */
export async function updateWebhook(
  webhookId: string,
  updates: {
    url?: string;
    secret?: string;
    events?: WebhookEventType[];
    active?: boolean;
  },
) {
  const data: Record<string, unknown> = {};
  if (updates.url !== undefined) data.url = updates.url;
  if (updates.secret !== undefined) data.secret = updates.secret;
  if (updates.events !== undefined) data.events = JSON.stringify(updates.events);
  if (updates.active !== undefined) data.active = updates.active;

  return prisma.webhook.update({
    where: { id: webhookId },
    data,
  });
}

/**
 * Delete a webhook and its logs.
 */
export async function deleteWebhook(webhookId: string) {
  await prisma.webhookLog.deleteMany({ where: { webhookId } });
  await prisma.webhook.delete({ where: { id: webhookId } });
}

// ─── Webhook Dispatch ────────────────────────────────────────────────────────

/**
 * Dispatch a webhook event to all active webhooks registered for a project.
 */
export async function dispatchWebhook(
  event: WebhookEventType,
  projectId: string,
  data: Record<string, unknown>,
): Promise<WebhookDeliveryResult[]> {
  // Find all active webhooks for this project that listen to this event
  const webhooks = await prisma.webhook.findMany({
    where: {
      projectId,
      active: true,
    },
  });

  const matchingWebhooks = webhooks.filter((wh) => {
    const events = parseEvents(wh.events);
    return events.includes(event) || events.includes("*" as WebhookEventType);
  });

  if (matchingWebhooks.length === 0) return [];

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    projectId,
    data,
  };

  const results: WebhookDeliveryResult[] = [];

  // Dispatch to all matching webhooks concurrently
  const deliveries = matchingWebhooks.map(async (webhook) => {
    const result = await deliverWebhook(webhook, payload);
    results.push(result);
  });

  await Promise.allSettled(deliveries);
  return results;
}

/**
 * Deliver a single webhook payload.
 */
async function deliverWebhook(
  webhook: { id: string; url: string; secret: string },
  payload: WebhookPayload,
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();
  const body = JSON.stringify(payload);
  const signature = signPayload(body, webhook.secret);

  let status = 0;
  let response = "";
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": payload.event,
        "X-Webhook-Signature": signature,
        "X-Webhook-Delivery": crypto.randomUUID(),
        "User-Agent": "MiniLinear-Webhook/1.0",
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    status = res.status;
    response = await res.text().catch(() => "");
    success = res.ok;
  } catch (err) {
    status = 0;
    response = err instanceof Error ? err.message : "Unknown delivery error";
    success = false;
  }

  const duration = Date.now() - startTime;

  // Log the delivery
  await logWebhookDelivery(webhook.id, payload.event, body, {
    status: success ? "success" : "failed",
    response,
    duration,
  });

  return {
    webhookId: webhook.id,
    success,
    status,
    response,
    duration,
  };
}

// ─── Webhook Logging ─────────────────────────────────────────────────────────

/**
 * Log a webhook delivery attempt.
 */
export async function logWebhookDelivery(
  webhookId: string,
  event: string,
  payload: string,
  result: { status: string; response: string; duration: number },
) {
  try {
    await prisma.webhookLog.create({
      data: {
        webhookId,
        event,
        payload,
        status: result.status,
        response: result.response.slice(0, 10000), // Truncate large responses
        duration: result.duration,
      },
    });
  } catch (error) {
    console.error("Failed to log webhook delivery:", error);
  }
}

/**
 * Get webhook delivery logs for a webhook.
 */
export async function getWebhookLogs(
  webhookId: string,
  options?: { limit?: number; offset?: number; status?: string },
) {
  const where: Record<string, unknown> = { webhookId };
  if (options?.status) where.status = options.status;

  const [logs, total] = await Promise.all([
    prisma.webhookLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    }),
    prisma.webhookLog.count({ where }),
  ]);

  return { logs, total };
}

// ─── Signature Verification ──────────────────────────────────────────────────

/**
 * Generate HMAC-SHA256 signature for a webhook payload.
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify a webhook signature.
 */
export function verifySignature(payload: string, secret: string, signature: string): boolean {
  const expected = signPayload(payload, secret);
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (sigBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(sigBuffer, expectedBuffer);
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure webhook secret.
 */
function generateSecret(): string {
  return createHmac("sha256", "webhook-secret")
    .update(crypto.randomUUID())
    .digest("hex");
}

/**
 * Parse events JSON string into an array.
 */
function parseEvents(raw: string): WebhookEventType[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

/**
 * Get all valid webhook event types.
 */
export function getValidWebhookEvents(): WebhookEventType[] {
  return [...VALID_EVENTS];
}
