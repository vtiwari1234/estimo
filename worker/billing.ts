import { planFromWebhook, type Interval } from "../shared/plan";
import { ROOM_ID_PATTERN } from "../shared/protocol";
import type { Env } from "./index";

/**
 * Lemon Squeezy billing for the paid site. All provider-specific code lives
 * here, so moving to another provider means replacing this file.
 *
 * Settings (Cloudflare → the Worker → Settings → Variables and Secrets):
 *   LS_API_KEY           secret  API key (Lemon Squeezy → Settings → API)
 *   LS_WEBHOOK_SECRET    secret  signing secret of the webhook
 *   LS_STORE_ID          var     store id
 *   LS_VARIANT_MONTHLY   var     variant id of the $4/month plan
 *   LS_VARIANT_YEARLY    var     variant id of the $36/year plan
 */

const API = "https://api.lemonsqueezy.com/v1";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function billingConfigured(env: Env): boolean {
  return Boolean(env.LS_API_KEY && env.LS_STORE_ID && env.LS_VARIANT_MONTHLY && env.LS_VARIANT_YEARLY);
}

/** POST /api/billing/checkout {roomId, interval} → {url} of a hosted checkout page. */
export async function createCheckout(request: Request, env: Env): Promise<Response> {
  if (env.EDITION !== "pro") return json({ error: "Not available." }, 404);
  if (!billingConfigured(env)) return json({ error: "Payments aren't set up yet. Please try again later." }, 503);
  let body: { roomId?: unknown; interval?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const roomId = String(body.roomId ?? "").toLowerCase();
  if (!ROOM_ID_PATTERN.test(roomId)) return json({ error: "Invalid room." }, 400);
  const interval: Interval = body.interval === "yearly" ? "yearly" : "monthly";
  const variantId = interval === "yearly" ? env.LS_VARIANT_YEARLY : env.LS_VARIANT_MONTHLY;
  const origin = new URL(request.url).origin;

  const res = await fetch(`${API}/checkouts`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${env.LS_API_KEY}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: { custom: { room_id: roomId } },
          product_options: { redirect_url: `${origin}/r/${roomId}?upgraded=1` },
        },
        relationships: {
          store: { data: { type: "stores", id: String(env.LS_STORE_ID) } },
          variant: { data: { type: "variants", id: String(variantId) } },
        },
      },
    }),
  });
  if (!res.ok) {
    console.error("checkout failed", res.status, await res.text());
    return json({ error: "Couldn't start checkout. Please try again." }, 502);
  }
  const data = (await res.json()) as { data?: { attributes?: { url?: string } } };
  const url = data.data?.attributes?.url;
  if (!url) return json({ error: "Couldn't start checkout. Please try again." }, 502);
  return json({ url });
}

/** Constant-time comparison of two hex strings. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signatureValid(raw: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sameHex(hex, signature.trim().toLowerCase());
}

/** POST /api/billing/webhook from Lemon Squeezy: verifies it, then updates the room's plan. */
export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (env.EDITION !== "pro") return new Response("Not found", { status: 404 });
  const raw = await request.text();
  if (!(await signatureValid(raw, request.headers.get("X-Signature"), env.LS_WEBHOOK_SECRET ?? ""))) {
    return new Response("Invalid signature", { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const update = planFromWebhook(body, Date.now());
  // Acknowledge events we don't use, so the provider doesn't keep retrying them.
  if (!update || !ROOM_ID_PATTERN.test(update.roomId)) return new Response("Ignored", { status: 200 });
  const stub = env.ROOMS.get(env.ROOMS.idFromName(update.roomId));
  const res = await stub.fetch(
    new Request(`https://room/billing?room=${encodeURIComponent(update.roomId)}`, {
      method: "POST",
      body: JSON.stringify(update.plan),
    }),
  );
  return new Response(res.ok ? "OK" : "Room update failed", { status: res.ok ? 200 : 500 });
}
