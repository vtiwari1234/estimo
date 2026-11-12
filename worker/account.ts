import { MAX_PRO_ROOMS, isPro, type Plan } from "../shared/plan";
import { ROOM_ID_PATTERN } from "../shared/protocol";
import { currentUser, type User } from "./auth";
import { db } from "./db";
import type { Env } from "./index";

/**
 * The paying owner's account: their subscription and the rooms it makes Pro.
 * Rooms keep a copy of the plan, pushed from here, so the room server never
 * has to look anything up while people are voting.
 */

interface SubscriptionRow {
  provider_id: string;
  status: Plan["status"];
  interval: string;
  trial_ends_at: number | null;
  renews_at: number | null;
  ends_at: number | null;
  portal_url: string | null;
  updated_at: number;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function toPlan(row: SubscriptionRow): Plan {
  return {
    status: row.status,
    interval: row.interval,
    trialEndsAt: row.trial_ends_at,
    renewsAt: row.renews_at,
    endsAt: row.ends_at,
    subscriptionId: row.provider_id,
    portalUrl: row.portal_url,
    updatedAt: row.updated_at,
  };
}

export async function subscriptionOf(env: Env, userId: string): Promise<Plan | null> {
  const row = await (await db(env)).prepare("SELECT * FROM subscriptions WHERE user_id = ?").bind(userId).first<SubscriptionRow>();
  return row ? toPlan(row) : null;
}

export async function roomsOf(env: Env, userId: string): Promise<string[]> {
  const { results } = await (await db(env))
    .prepare("SELECT room_id FROM pro_rooms WHERE user_id = ? ORDER BY added_at")
    .bind(userId)
    .all<{ room_id: string }>();
  return results.map((r) => r.room_id);
}

/** Tells a room its current plan (null = back to free). Rooms never get the billing link. */
export async function pushPlan(env: Env, roomId: string, plan: Plan | null): Promise<boolean> {
  const stub = env.ROOMS.get(env.ROOMS.idFromName(roomId));
  const res = await stub.fetch(
    new Request(`https://room/billing?room=${encodeURIComponent(roomId)}`, {
      method: "POST",
      body: JSON.stringify(plan ? { ...plan, portalUrl: null } : null),
    }),
  );
  return res.ok;
}

/** Saves a subscription update from the payment provider and passes it on to the owner's rooms. */
export async function saveSubscription(env: Env, userId: string, plan: Plan, startedFromRoom: string | null): Promise<boolean> {
  const database = await db(env);
  const user = await database.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first();
  if (!user) return false;
  await database
    .prepare(
      `INSERT INTO subscriptions (user_id, provider_id, status, interval, trial_ends_at, renews_at, ends_at, portal_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET provider_id = excluded.provider_id, status = excluded.status, interval = excluded.interval,
         trial_ends_at = excluded.trial_ends_at, renews_at = excluded.renews_at, ends_at = excluded.ends_at,
         portal_url = excluded.portal_url, updated_at = excluded.updated_at`,
    )
    .bind(userId, plan.subscriptionId, plan.status, plan.interval, plan.trialEndsAt, plan.renewsAt, plan.endsAt, plan.portalUrl, plan.updatedAt)
    .run();
  // First subscription started from a room: make that room Pro straight away.
  if (startedFromRoom && ROOM_ID_PATTERN.test(startedFromRoom)) {
    const rooms = await roomsOf(env, userId);
    if (rooms.length === 0) {
      await database
        .prepare("INSERT INTO pro_rooms (room_id, user_id, added_at) VALUES (?, ?, ?) ON CONFLICT(room_id) DO NOTHING")
        .bind(startedFromRoom, userId, Date.now())
        .run();
    }
  }
  const results = await Promise.all((await roomsOf(env, userId)).map((room) => pushPlan(env, room, plan)));
  return results.every(Boolean);
}

async function requireUser(request: Request, env: Env): Promise<User | Response> {
  const user = await currentUser(request, env);
  return user ?? json({ error: "Please sign in." }, 401);
}

/** GET /api/account */
export async function getAccount(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  if (user instanceof Response) return user;
  const plan = await subscriptionOf(env, user.id);
  return json({
    id: user.id,
    email: user.email,
    plan,
    pro: isPro(plan, Date.now()),
    rooms: await roomsOf(env, user.id),
    maxRooms: MAX_PRO_ROOMS,
  });
}

/** POST /api/account/rooms {roomId} */
export async function addRoom(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  if (user instanceof Response) return user;
  const body = (await request.json().catch(() => ({}))) as { roomId?: unknown };
  const roomId = String(body.roomId ?? "").trim().toLowerCase().replace(/^.*\/r\//, "").replace(/\/$/, "");
  if (!ROOM_ID_PATTERN.test(roomId)) return json({ error: "Room names use 3–40 lowercase letters, numbers and dashes." }, 400);
  const plan = await subscriptionOf(env, user.id);
  if (!isPro(plan, Date.now())) return json({ error: "Start a plan first." }, 402);
  const database = await db(env);
  const owner = await database.prepare("SELECT user_id FROM pro_rooms WHERE room_id = ?").bind(roomId).first<{ user_id: string }>();
  if (owner && owner.user_id !== user.id) return json({ error: "That room is already Pro on another account." }, 409);
  const rooms = await roomsOf(env, user.id);
  if (!owner && rooms.length >= MAX_PRO_ROOMS) {
    return json({ error: `Your plan covers ${MAX_PRO_ROOMS} rooms. Remove one first.` }, 409);
  }
  if (!owner) {
    await database.prepare("INSERT INTO pro_rooms (room_id, user_id, added_at) VALUES (?, ?, ?)").bind(roomId, user.id, Date.now()).run();
  }
  await pushPlan(env, roomId, plan);
  return json({ rooms: await roomsOf(env, user.id) });
}

/** DELETE /api/account/rooms/:roomId */
export async function removeRoom(request: Request, env: Env, roomId: string): Promise<Response> {
  const user = await requireUser(request, env);
  if (user instanceof Response) return user;
  const res = await (await db(env))
    .prepare("DELETE FROM pro_rooms WHERE room_id = ? AND user_id = ?")
    .bind(roomId, user.id)
    .run();
  if (res.meta.changes) await pushPlan(env, roomId, null);
  return json({ rooms: await roomsOf(env, user.id) });
}
