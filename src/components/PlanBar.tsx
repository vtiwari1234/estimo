import { useState } from "react";
import { PRICES, TRIAL_DAYS, type Interval } from "../../shared/plan";
import type { RoomView } from "../../shared/protocol";
import { EDITION } from "../brand";
import { Modal } from "./Modal";

function day(ms: number | null | undefined): string {
  return ms ? new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
}

/** Paid site only: shows the room's plan, and the trial / upgrade button on free rooms. */
export function PlanBar({ room, isHost }: { room: RoomView; isHost: boolean }) {
  const [open, setOpen] = useState(false);
  if (EDITION !== "pro") return null;
  const plan = room.plan;

  if (room.pro && plan) {
    const detail =
      plan.status === "on_trial"
        ? `Free trial until ${day(plan.trialEndsAt)}`
        : plan.status === "cancelled"
          ? `Cancelled · works until ${day(plan.endsAt)}`
          : plan.status === "past_due"
            ? "Payment failed · please update your card"
            : `Renews ${day(plan.renewsAt)}`;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2" data-testid="plan-bar">
        <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-bg">Pro</span>
        <span>{detail}</span>
        {isHost && plan.portalUrl && (
          <a href={plan.portalUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
            Manage billing ↗
          </a>
        )}
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
      <button onClick={() => setOpen(true)} className="rounded-full bg-ink px-4 py-1.5 font-semibold text-bg hover:opacity-90">
        Try Pro free for {TRIAL_DAYS} days
      </button>
      {open && <UpgradeDialog roomId={room.id} onClose={() => setOpen(false)} />}
    </div>
  );
}

export function UpgradeDialog({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const [interval, setPeriod] = useState<Interval>("yearly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, interval }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't start checkout.");
      location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout.");
      setBusy(false);
    }
  };

  return (
    <Modal title="Go Pro" onClose={onClose}>
      <p className="text-sm text-ink-2">
        Unlimited voters in <span className="font-mono">/{roomId}</span>. Free for {TRIAL_DAYS} days, then billed to the card you
        enter. Cancel any time before the trial ends and you won't be charged. We email you 3 days before.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Billing period">
        {(["monthly", "yearly"] as const).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={interval === k}
            onClick={() => setPeriod(k)}
            className={`rounded-2xl border-[1.5px] px-3 py-3 text-left ${interval === k ? "border-ink" : "border-line"}`}
          >
            <span className="block font-semibold">{PRICES[k].label}</span>
            <span className="text-xs text-ink-3">{k === "yearly" ? "Save 25%" : "Cancel any time"}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-brand">{error}</p>}
      <button
        onClick={start}
        disabled={busy}
        className="mt-5 w-full rounded-full bg-ink px-5 py-3 font-semibold text-bg hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Opening checkout…" : `Start ${TRIAL_DAYS}-day free trial`}
      </button>
      <p className="mt-3 text-center text-xs text-ink-3">
        Secure checkout by Lemon Squeezy. See <a href="/pricing" className="underline">pricing</a> and{" "}
        <a href="/refunds" className="underline">refunds</a>.
      </p>
    </Modal>
  );
}
