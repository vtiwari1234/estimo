import { db, randomToken, sha256 } from "./db";
import type { Env } from "./index";

/**
 * Email sign-in for people who pay (voters never sign in). We email a one-time
 * link; opening it and pressing "Sign in" starts a 30-day session cookie.
 *
 * Settings: RESEND_API_KEY (secret) to send the emails. Without it, on a dev
 * machine with DEV_LOGIN_LINKS=1, the link is returned in the response instead.
 */

const TOKEN_TTL = 20 * 60 * 1000;
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
const COOKIE = "as_session";
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export interface User {
  id: string;
  email: string;
}

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(data, { status, headers });
}

function cookie(value: string, maxAgeSeconds: number, secure: boolean): string {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}

/** Only same-site paths, so a sign-in link can't redirect somewhere else. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && /^\/(?!\/)[\w\-/?=&.%]*$/.test(next) ? next : "/account";
}

async function sendEmail(env: Env, to: string, link: string, appName: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${appName} <${env.EMAIL_FROM || "signin@agilesizing.com"}>`,
      to: [to],
      subject: `Your ${appName} sign-in link`,
      text: `Sign in to ${appName}:\n\n${link}\n\nThe link works once and expires in 20 minutes. If you didn't ask for it, you can ignore this email.`,
      html: `<p>Sign in to ${appName}:</p><p><a href="${link}">Sign in</a></p><p style="color:#666">The link works once and expires in 20 minutes. If you didn't ask for it, you can ignore this email.</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Email failed: ${res.status} ${await res.text()}`);
}

/** POST /api/auth/start {email, next} */
export async function startSignIn(request: Request, env: Env, appName: string): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; next?: unknown };
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return json({ error: "Please enter a valid email address." }, 400);
  const database = await db(env);
  const token = randomToken();
  const now = Date.now();
  await database.batch([
    database.prepare("DELETE FROM login_tokens WHERE expires_at < ?").bind(now),
    database.prepare("INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)").bind(await sha256(token), email, now + TOKEN_TTL),
  ]);
  const url = new URL("/signin", request.url);
  url.searchParams.set("token", token);
  url.searchParams.set("next", safeNext(body.next));
  const link = url.toString();

  if (env.RESEND_API_KEY) {
    try {
      await sendEmail(env, email, link, appName);
    } catch (err) {
      console.error(err);
      return json({ error: "We couldn't send the email. Please try again in a minute." }, 502);
    }
    return json({ sent: true });
  }
  if (env.DEV_LOGIN_LINKS === "1") return json({ sent: true, devLink: link });
  return json({ error: "Sign-in emails aren't set up yet." }, 503);
}

/** POST /api/auth/verify {token} → sets the session cookie. */
export async function verifySignIn(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const token = String(body.token ?? "");
  if (!token) return json({ error: "This sign-in link is invalid." }, 400);
  const database = await db(env);
  const hash = await sha256(token);
  const row = await database
    .prepare("DELETE FROM login_tokens WHERE token_hash = ? RETURNING email, expires_at")
    .bind(hash)
    .first<{ email: string; expires_at: number }>();
  const now = Date.now();
  if (!row || row.expires_at < now) return json({ error: "This sign-in link has expired or was already used. Ask for a new one." }, 400);

  await database
    .prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING")
    .bind(crypto.randomUUID(), row.email, now)
    .run();
  const user = await database.prepare("SELECT id FROM users WHERE email = ?").bind(row.email).first<{ id: string }>();
  const session = randomToken();
  await database
    .prepare("INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(session), user!.id, now + SESSION_TTL)
    .run();
  const secure = new URL(request.url).protocol === "https:";
  return json({ ok: true }, 200, { "Set-Cookie": cookie(session, SESSION_TTL / 1000, secure) });
}

function sessionToken(request: Request): string | null {
  const header = request.headers.get("Cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export async function currentUser(request: Request, env: Env): Promise<User | null> {
  const token = sessionToken(request);
  if (!token) return null;
  const database = await db(env);
  return database
    .prepare("SELECT users.id AS id, users.email AS email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id_hash = ? AND sessions.expires_at > ?")
    .bind(await sha256(token), Date.now())
    .first<User>();
}

/** POST /api/auth/logout */
export async function signOut(request: Request, env: Env): Promise<Response> {
  const token = sessionToken(request);
  if (token) await (await db(env)).prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await sha256(token)).run();
  const secure = new URL(request.url).protocol === "https:";
  return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0, secure) });
}
