import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FREE_VOTER_LIMIT, isPro, planFromWebhook, type Plan } from "../shared/plan";
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
    portalUrl: "https://portal",
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

  it("reads a Lemon Squeezy subscription webhook", () => {
    const update = planFromWebhook(
      {
        meta: { event_name: "subscription_created", custom_data: { room_id: "team-falcon" } },
        data: {
          type: "subscriptions",
          id: "123",
          attributes: {
            status: "on_trial",
            variant_name: "Yearly",
            trial_ends_at: "2026-11-26T00:00:00.000000Z",
            renews_at: "2026-11-26T00:00:00.000000Z",
            ends_at: null,
            urls: { customer_portal: "https://agilesizing.lemonsqueezy.com/billing" },
          },
        },
      },
      NOW,
    );
    expect(update?.roomId).toBe("team-falcon");
    expect(update?.plan).toMatchObject({ status: "on_trial", interval: "yearly", subscriptionId: "123" });
    expect(update?.plan.trialEndsAt).toBe(Date.parse("2026-11-26T00:00:00Z"));
  });

  it("ignores other events and subscriptions without a room", () => {
    expect(planFromWebhook({ meta: { event_name: "order_created" }, data: { type: "orders" } }, NOW)).toBeNull();
    expect(planFromWebhook({ meta: { event_name: "subscription_created" }, data: { type: "subscriptions" } }, NOW)).toBeNull();
  });

  it("only shows the billing portal link to the host", () => {
    const room = createRoom("team", NOW);
    room.hostId = "host";
    room.plan = plan({});
    expect(toView(room, new Set(), NOW, "host").plan?.portalUrl).toBe("https://portal");
    expect(toView(room, new Set(), NOW, "guest").plan?.portalUrl).toBeNull();
  });
});

describe("webhook signature", () => {
  const body = '{"meta":{"event_name":"subscription_created"}}';
  const good = createHmac("sha256", "s3cret").update(body).digest("hex");

  it("accepts the provider's HMAC and rejects anything else", async () => {
    expect(await signatureValid(body, good, "s3cret")).toBe(true);
    expect(await signatureValid(body, good, "other")).toBe(false);
    expect(await signatureValid(body + " ", good, "s3cret")).toBe(false);
    expect(await signatureValid(body, null, "s3cret")).toBe(false);
    expect(await signatureValid(body, good, "")).toBe(false);
  });
});
