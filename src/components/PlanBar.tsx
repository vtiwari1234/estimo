import { TRIAL_DAYS } from "../../shared/plan";
import type { RoomView } from "../../shared/protocol";
import { EDITION } from "../brand";

function day(ms: number | null | undefined): string {
  return ms ? new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
}

/** Paid site only: shows the room's plan, and the trial button on free rooms. */
export function PlanBar({ room }: { room: RoomView }) {
  if (EDITION !== "pro") return null;
  const plan = room.plan;
  const accountLink = `/account?room=${encodeURIComponent(room.id)}`;

  if (room.pro && plan) {
    const detail =
      plan.status === "on_trial"
        ? `Free trial until ${day(plan.trialEndsAt)}`
        : plan.status === "cancelled"
          ? `Cancelled · works until ${day(plan.endsAt)}`
          : plan.status === "past_due"
            ? "Payment failed · the owner should update their card"
            : `Renews ${day(plan.renewsAt)}`;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2" data-testid="plan-bar">
        <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-bg">Pro</span>
        <span>{detail}</span>
        <a href="/account" className="text-brand hover:underline">
          Manage
        </a>
      </div>
    );
  }

  const voters = Object.values(room.participants).filter((p) => p.role === "voter" && room.online.includes(p.id)).length;
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm"
      data-testid="plan-bar"
    >
      <p className="text-ink-2">
        <strong className="text-ink">Free room</strong> · {voters} of {room.voterLimit} voters. Add your whole team with Pro.
      </p>
      <a href={accountLink} className="rounded-full bg-ink px-4 py-1.5 font-semibold text-bg hover:opacity-90">
        Try Pro free for {TRIAL_DAYS} days
      </a>
    </div>
  );
}
