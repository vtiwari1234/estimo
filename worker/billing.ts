import { TRIAL_DAYS, planFromStripe, type Interval } from "../shared/plan";
import { ROOM_ID_PATTERN } from "../shared/protocol";
import { customerOf, saveSubscription, subscriptionOf } from "./account";
import { currentUser } from "./auth";
import type { Env } from "./index";

/**
 * Stripe billing for the paid site, through Stripe Managed Payments (Stripe is
 * the merchant of record and handles sales tax/VAT). All provider-specific code
 * lives here, so moving to another provider means replacing this file.
 *
 * Settings (Cloudflare → the agilesizing Worker → Settings → Variables and Secrets):
 *   STRIPE_SECRET_KEY      secret  secret API key (Stripe → Developers → API keys)
 *   STRIPE_WEBHOOK_SECRET  secret  signing secret (whsec_…) of the webhook endpoint
 *   STRIPE_PRICE_MONTHLY   var     price id (price_…) of the $4/month plan, in wrangler.jsonc
 *   STRIPE_PRICE_YEARLY    var     price id (price_…) of the $36/year plan, in wrangler.jsonc
 *
 * Webhook endpoint: https://agilesizing.com/api/billing/webhook with events
 * customer.subscription.created, .updated and .deleted.
 */

const API = "https://api.stripe.com/v1";
const API_VERSION = "2025-03-31.basil";
/** Webhooks older than this are rejected, so a captured one can't be replayed later. */
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function billingConfigured(env: Env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_MONTHLY && env.STRIPE_PRICE_YEARLY);
}

/** Calls the Stripe API with a form-encoded body. */
async function stripe<T>(env: Env, path: string, params: Record<string, string>): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": API_VERSION,
    },
    body: new URLSearchParams(params),
  });
  if (!res.ok) {
    console.error("stripe", path, res.status, await res.text());
    return null;
  }
  return (await res.json()) as T;
}

/** POST /api/billing/checkout {interval, roomId?} → {url} of a hosted checkout page. Needs a signed-in owner. */
export async function createCheckout(request: Request, env: Env): Promise<Response> {
  if (env.EDITION !== "pro") return json({ error: "Not available." }, 404);
  if (!billingConfigured(env)) return json({ error: "Payments aren't set up yet. Please try again later." }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: "Please sign in." }, 401);
  const existing = await subscriptionOf(env, user.id);
  if (existing && existing.status !== "expired") {
    return json({ error: "You already have a plan. Manage it from your account page." }, 409);
  }
  let body: { roomId?: unknown; interval?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const roomId = String(body.roomId ?? "").toLowerCase();
  const interval: Interval = body.interval === "yearly" ? "yearly" : "monthly";
  const origin = new URL(request.url).origin;
  const customer = await customerOf(env, user.id);

  const params: Record<string, string> = {
    mode: "subscription",
    "managed_payments[enabled]": "true",
    "line_items[0][price]": String(interval === "yearly" ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_MONTHLY),
    "line_items[0][quantity]": "1",
    "subscription_data[metadata][user_id]": user.id,
    client_reference_id: user.id,
    success_url: `${origin}/account?welcome=1`,
    cancel_url: `${origin}/account${ROOM_ID_PATTERN.test(roomId) ? `?room=${roomId}` : ""}`,
  };
  if (ROOM_ID_PATTERN.test(roomId)) params["subscription_data[metadata][room_id]"] = roomId;
  // One free trial per account: someone coming back after their plan ended pays from day one.
  if (!existing) params["subscription_data[trial_period_days]"] = String(TRIAL_DAYS);
  if (customer) params.customer = customer;
  else params.customer_email = user.email;

  const session = await stripe<{ url?: string }>(env, "/checkout/sessions", params);
  if (!session?.url) return json({ error: "Couldn't start checkout. Please try again." }, 502);
  return json({ url: session.url });
}

/** POST /api/billing/portal → {url} of Stripe's page to change card, plan, cancel and get invoices. */
export async function createPortal(request: Request, env: Env): Promise<Response> {
  if (env.EDITION !== "pro") return json({ error: "Not available." }, 404);
  const user = await currentUser(request, env);
  if (!user) return json({ error: "Please sign in." }, 401);
  const customer = await customerOf(env, user.id);
  if (!customer || !env.STRIPE_SECRET_KEY) return json({ error: "No billing details yet." }, 404);
  const portal = await stripe<{ url?: string }>(env, "/billing_portal/sessions", {
    customer,
    return_url: `${new URL(request.url).origin}/account`,
  });
  if (!portal?.url) return json({ error: "Couldn't open billing. Please try again." }, 502);
  return json({ url: portal.url });
}

/** Constant-time comparison of two hex strings. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checks a Stripe-Signature header ("t=…,v1=…"): HMAC-SHA256 of "t.body", within the time tolerance. */
export async function signatureValid(raw: string, header: string | null, secret: string, nowMs = Date.now()): Promise<boolean> {
  if (!header || !secret) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.trim().split("=", 2);
    if (k === "t") timestamp = v ?? "";
    if (k === "v1" && v) signatures.push(v.toLowerCase());
  }
  const t = Number(timestamp);
  if (!timestamp || !Number.isFinite(t) || signatures.length === 0) return false;
  if (Math.abs(nowMs - t * 1000) > SIGNATURE_TOLERANCE_MS) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${raw}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((s) => sameHex(hex, s));
}

/** POST /api/billing/webhook from Stripe: verifies it, then updates the owner's plan and rooms. */
export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (env.EDITION !== "pro") return new Response("Not found", { status: 404 });
  const raw = await request.text();
  if (!(await signatureValid(raw, request.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET ?? ""))) {
    return new Response("Invalid signature", { status: 401 });
  }
  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const update = planFromStripe(event);
  // Acknowledge events we don't use, so Stripe doesn't keep retrying them.
  if (!update) return new Response("Ignored", { status: 200 });
  const ok = await saveSubscription(env, update.userId, update.plan, update.roomId, update.customerId);
  return new Response(ok ? "OK" : "Saved; some rooms not updated", { status: ok ? 200 : 500 });
}
