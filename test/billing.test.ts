import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FREE_VOTER_LIMIT, isPro, planFromStripe, type Plan } from "../shared/plan";
import { applyMessage, createRoom, toView } from "../shared/room";
import { signatureValid } from "../worker/billing";

const NOW = 1_700_000_000_000;
const LIMIT = { maxVoters: FREE_VOTER_LIMIT };

function roomWith(n: number) {
  const room = createRoom("team", NOW);
  const online = new Set<string>();
  const join = (id: string, role: "voter" | "spectator" = "voter") => {
    online.add(id);
    return applyMessage(room, id, { type: "join", id, name: id, color: "#123456", role }, NOW, online, LIMIT);
  };
  for (let i = 0; i < n; i++) join(`p${i}`);
  return { room, online, join };
}

describe("free voter limit", () => {
  it("seats the first four as voters and the fifth as a spectator, with a notice", () => {
    const { room, join } = roomWith(4);
    expect(Object.values(room.participants).every((p) => p.role === "voter")).toBe(true);
    const res = join("p4");
    expect(res.error).toMatch(/Free rooms allow 4 voters/);
    expect(room.participants.p4.role).toBe("spectator");
  });

  it("frees a seat when a voter goes offline", () => {
    const { room, online, join } = roomWith(4);
    online.delete("p0");
    join("p4");
    expect(room.participants.p4.role).toBe("voter");
  });

  it("refuses switching to voter when seats are full, but rejoining keeps your seat", () => {
    const { room, online, join } = roomWith(4);
    join("s", "spectator");
    const res = applyMessage(room, "s", { type: "profile", role: "voter" }, NOW, online, LIMIT);
    expect(res.error).toMatch(/4 voters/);
    expect(room.participants.s.role).toBe("spectator");
    expect(join("p0").error).toBeUndefined();
    expect(room.participants.p0.role).toBe("voter");
  });

  it("has no limit without a policy (free Estimo, or a Pro room)", () => {
    const room = createRoom("team", NOW);
    const online = new Set<string>();
    for (let i = 0; i < 8; i++) {
      online.add(`p${i}`);
      applyMessage(room, `p${i}`, { type: "join", id: `p${i}`, name: "x", color: "#123456", role: "voter" }, NOW, online);
    }
    expect(Object.values(room.participants).filter((p) => p.role === "voter")).toHaveLength(8);
  });
});

function plan(over: Partial<Plan>): Plan {
  return {
    status: "active",
    interval: "monthly",
    trialEndsAt: null,
    renewsAt: null,
    endsAt: null,
    subscriptionId: "1",
    updatedAt: NOW,
    ...over,
  };
}

describe("plans", () => {
  it("counts trials, active and past-due plans as Pro", () => {
    expect(isPro(plan({ status: "on_trial" }), NOW)).toBe(true);
    expect(isPro(plan({ status: "active" }), NOW)).toBe(true);
    expect(isPro(plan({ status: "past_due" }), NOW)).toBe(true);
    expect(isPro(plan({ status: "expired" }), NOW)).toBe(false);
    expect(isPro(null, NOW)).toBe(false);
  });

  it("keeps a cancelled plan until its end date", () => {
    expect(isPro(plan({ status: "cancelled", endsAt: NOW + 1000 }), NOW)).toBe(true);
    expect(isPro(plan({ status: "cancelled", endsAt: NOW - 1000 }), NOW)).toBe(false);
  });

  const T = Math.floor(NOW / 1000);
  function event(sub: Record<string, unknown>, type = "customer.subscription.created") {
    return {
      type,
      created: T,
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "trialing",
          trial_end: T + 14 * 86400,
          cancel_at: null,
          cancel_at_period_end: false,
          metadata: { user_id: "u1", room_id: "team-falcon" },
          items: { data: [{ current_period_end: T + 14 * 86400, price: { recurring: { interval: "year" } } }] },
          ...sub,
        },
      },
    };
  }

  it("reads a Stripe subscription event", () => {
    const update = planFromStripe(event({}));
    expect(update?.userId).toBe("u1");
    expect(update?.roomId).toBe("team-falcon");
    expect(update?.customerId).toBe("cus_1");
    expect(update?.plan).toMatchObject({ status: "on_trial", interval: "yearly", subscriptionId: "sub_1", updatedAt: NOW - (NOW % 1000) });
    expect(update?.plan.trialEndsAt).toBe((T + 14 * 86400) * 1000);
  });

  it("maps Stripe statuses, including a pending cancel", () => {
    expect(planFromStripe(event({ status: "active" }))?.plan.status).toBe("active");
    expect(planFromStripe(event({ status: "past_due" }))?.plan.status).toBe("past_due");
    expect(planFromStripe(event({ status: "canceled" }, "customer.subscription.deleted"))?.plan.status).toBe("expired");
    expect(planFromStripe(event({ status: "incomplete" }))?.plan.status).toBe("expired");
    const cancelling = planFromStripe(event({ status: "active", cancel_at_period_end: true }))?.plan;
    expect(cancelling?.status).toBe("cancelled");
    expect(cancelling?.endsAt).toBe((T + 14 * 86400) * 1000);
    expect(isPro(cancelling, NOW)).toBe(true);
  });

  it("ignores other events and subscriptions without an account", () => {
    expect(planFromStripe({ type: "invoice.paid", data: { object: {} } })).toBeNull();
    expect(planFromStripe(event({ metadata: {} }))).toBeNull();
    expect(planFromStripe(null)).toBeNull();
  });

  it("shows rooms their plan", () => {
    const room = createRoom("team", NOW);
    room.plan = plan({});
    expect(toView(room, new Set(), NOW, "guest").plan?.status).toBe("active");
  });
});

describe("webhook signature", () => {
  const body = '{"type":"customer.subscription.created"}';
  const t = Math.floor(NOW / 1000);
  const sign = (secret: string, ts = t) => `t=${ts},v1=${createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")}`;

  it("accepts Stripe's signature and rejects anything else", async () => {
    expect(await signatureValid(body, sign("whsec_x"), "whsec_x", NOW)).toBe(true);
    expect(await signatureValid(body, `v0=abc,${sign("whsec_x")}`, "whsec_x", NOW)).toBe(true);
    expect(await signatureValid(body, sign("other"), "whsec_x", NOW)).toBe(false);
    expect(await signatureValid(body + " ", sign("whsec_x"), "whsec_x", NOW)).toBe(false);
    expect(await signatureValid(body, null, "whsec_x", NOW)).toBe(false);
    expect(await signatureValid(body, sign("whsec_x"), "", NOW)).toBe(false);
    expect(await signatureValid(body, "nope", "whsec_x", NOW)).toBe(false);
  });

  it("rejects old signatures so webhooks can't be replayed", async () => {
    expect(await signatureValid(body, sign("whsec_x", t - 600), "whsec_x", NOW)).toBe(false);
  });
});

describe("sign-in redirects", async () => {
  const { safeNext } = await import("../worker/auth");
  it("only allows same-site paths", () => {
    expect(safeNext("/account?room=team")).toBe("/account?room=team");
    expect(safeNext("/r/team-falcon")).toBe("/r/team-falcon");
    expect(safeNext("//evil.com")).toBe("/account");
    expect(safeNext("https://evil.com")).toBe("/account");
    expect(safeNext(undefined)).toBe("/account");
  });
});
