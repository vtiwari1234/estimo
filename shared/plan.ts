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
  updatedAt: number;
}

/** Voters allowed at once in a free room on the paid site. */
export const FREE_VOTER_LIMIT = 4;

/** Rooms one subscription can make Pro. The owner can swap them any time. */
export const MAX_PRO_ROOMS = 3;

/** Trial length offered at checkout, in days. */
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

function seconds(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value * 1000 : null;
}

/** A Stripe subscription object, as far as we read it. */
interface StripeSubscription {
  id?: unknown;
  customer?: unknown;
  status?: unknown;
  trial_end?: unknown;
  cancel_at?: unknown;
  cancel_at_period_end?: unknown;
  ended_at?: unknown;
  metadata?: { user_id?: unknown; room_id?: unknown };
  items?: { data?: { current_period_end?: unknown; price?: { recurring?: { interval?: unknown } } }[] };
}

/**
 * Reads a Stripe customer.subscription.* event into the paying account and
 * plan, plus the room checkout was started from (if any). Returns null for
 * events that aren't about a subscription tied to an account.
 */
export function planFromStripe(
  event: unknown,
): { userId: string; roomId: string | null; customerId: string | null; plan: Plan } | null {
  const e = event as { type?: unknown; created?: unknown; data?: { object?: StripeSubscription } };
  if (typeof e?.type !== "string" || !e.type.startsWith("customer.subscription.")) return null;
  const sub = e.data?.object;
  const userId = sub?.metadata?.user_id;
  if (!sub || typeof userId !== "string" || !userId) return null;
  const roomId = sub.metadata?.room_id;
  const item = sub.items?.data?.[0];
  const periodEnd = seconds(item?.current_period_end);
  const cancelAt = seconds(sub.cancel_at) ?? (sub.cancel_at_period_end === true ? periodEnd : null);

  let status: PlanStatus;
  switch (sub.status) {
    case "trialing":
      status = "on_trial";
      break;
    case "active":
      status = "active";
      break;
    case "past_due":
      status = "past_due";
      break;
    case "unpaid":
      status = "unpaid";
      break;
    case "paused":
      status = "paused";
      break;
    default: // canceled, incomplete, incomplete_expired
      status = "expired";
  }
  // Still running but set to stop: Pro keeps working until then.
  if ((status === "on_trial" || status === "active") && cancelAt !== null) status = "cancelled";

  return {
    userId,
    roomId: typeof roomId === "string" && roomId ? roomId : null,
    customerId: typeof sub.customer === "string" ? sub.customer : null,
    plan: {
      status,
      interval: item?.price?.recurring?.interval === "year" ? "yearly" : "monthly",
      trialEndsAt: status === "on_trial" || status === "cancelled" ? seconds(sub.trial_end) : null,
      renewsAt: status === "cancelled" || status === "expired" ? null : periodEnd,
      endsAt: status === "cancelled" ? cancelAt : seconds(sub.ended_at),
      subscriptionId: String(sub.id ?? ""),
      updatedAt: seconds(e.created) ?? Date.now(),
    },
  };
}
