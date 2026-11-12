import type { Env } from "./index";

/**
 * Accounts live in a D1 database (paid site only). Tables are created on first
 * use, so a fresh database needs no migration step.
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS login_tokens (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
     user_id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, status TEXT NOT NULL, interval TEXT NOT NULL,
     trial_ends_at INTEGER, renews_at INTEGER, ends_at INTEGER, portal_url TEXT, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS pro_rooms (room_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, added_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS pro_rooms_user ON pro_rooms (user_id)`,
];

let ready: Promise<void> | null = null;

export function db(env: Env): Promise<D1Database> {
  if (!env.DB) throw new Error("Accounts need the DB binding (paid site only).");
  const database = env.DB;
  ready ??= database
    .batch(SCHEMA.map((sql) => database.prepare(sql)))
    .then(() => undefined)
    .catch((err) => {
      ready = null;
      throw err;
    });
  return ready.then(() => database);
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
