import { AVATAR_COLORS, type Role } from "../../shared/protocol";

export interface Profile {
  name: string;
  color: string;
  role: Role;
}

const ID_KEY = "estimo:id";
const PROFILE_KEY = "estimo:profile";

function randomId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

let memoryId: string | null = null;

/** A stable per-browser id, so refreshing the page keeps your seat and votes. */
export function clientId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return (memoryId ??= randomId());
  }
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.name === "string" && p.name.trim()) {
      return { name: p.name, color: p.color ?? AVATAR_COLORS[0], role: p.role === "spectator" ? "spectator" : "voter" };
    }
  } catch {
    // Ignore.
  }
  return null;
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // Ignore.
  }
}

const ADJECTIVES = ["brave", "calm", "clever", "swift", "sunny", "lucky", "bold", "quiet", "witty", "keen", "merry", "nimble"];
const ANIMALS = ["otter", "falcon", "panda", "lynx", "heron", "badger", "koala", "fox", "orca", "yak", "gecko", "puffin"];

export function randomRoomName(): string {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return `${pick(ADJECTIVES)}-${pick(ANIMALS)}-${Math.floor(10 + Math.random() * 90)}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}
