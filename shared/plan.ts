/** Billing state of one room on the paid site. Set by the payment webhook. */
export type PlanStatus = "on_trial" | "active" | "paused" | "past_due" | "unpaid" | "cancelled" | "expired";

export interface Plan {
  status: PlanStatus;
  /** "monthly" or "yearly". */
  interval: string;
  /** When the trial ends, if on trial (ms). */
  trialEndsAt: number | null;
  /** Next renewal (ms). */
  renewsAt: number | null;
  /** When a cancelled plan stops working (ms). */
  endsAt: number | null;
  /** Payment provider's subscription id, for support. */
  subscriptionId: string;
  /** Link to the provider's billing portal. Only sent to the host. */
  portalUrl: string | null;
  updatedAt: number;
}

/** Voters allowed at once in a free room on the paid site. */
export const FREE_VOTER_LIMIT = 4;

/** Trial length offered at checkout, in days. Configured on the product in the payment provider. */
export const TRIAL_DAYS = 14;

export const PRICES = {
  monthly: { amount: 4, label: "$4 / month" },
  yearly: { amount: 36, label: "$36 / year" },
} as const;
export type Interval = keyof typeof PRICES;

/** Whether a plan unlocks Pro features right now. */
export function isPro(plan: Plan | null | undefined, now: number): boolean {
  if (!plan) return false;
  switch (plan.status) {
    case "on_trial":
    case "active":
    case "past_due": // Card retries are running; keep the team working meanwhile.
      return true;
    case "cancelled":
      return plan.endsAt !== null && plan.endsAt > now;
    default:
      return false;
  }
}

function time(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

const STATUSES: PlanStatus[] = ["on_trial", "active", "paused", "past_due", "unpaid", "cancelled", "expired"];

/**
 * Reads a Lemon Squeezy subscription webhook body into a room id and plan.
 * Returns null for events that aren't about a subscription tied to a room.
 */
export function planFromWebhook(body: unknown, now: number): { roomId: string; plan: Plan } | null {
  const b = body as {
    meta?: { event_name?: string; custom_data?: { room_id?: unknown } };
    data?: { type?: string; id?: unknown; attributes?: Record<string, unknown> };
  };
  if (!b?.meta?.event_name?.startsWith("subscription_") || b.data?.type !== "subscriptions") return null;
  const roomId = b.meta.custom_data?.room_id;
  const a = b.data.attributes ?? {};
  if (typeof roomId !== "string" || !roomId) return null;
  const status = STATUSES.includes(a.status as PlanStatus) ? (a.status as PlanStatus) : "expired";
  const urls = (a.urls ?? {}) as { customer_portal?: unknown };
  const variant = String(a.variant_name ?? "").toLowerCase();
  return {
    roomId,
    plan: {
      status,
      interval: variant.includes("year") ? "yearly" : "monthly",
      trialEndsAt: time(a.trial_ends_at),
      renewsAt: time(a.renews_at),
      endsAt: time(a.ends_at),
      subscriptionId: String(b.data.id ?? ""),
      portalUrl: typeof urls.customer_portal === "string" ? urls.customer_portal : null,
      updatedAt: now,
    },
  };
}
