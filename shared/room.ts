import {
  CUSTOM_DECK_ID,
  DECKS,
  DEFAULT_DECK_ID,
  SPECIAL_CARDS,
  deckCards,
  parseCustomCards,
} from "./decks";
import {
  AVATAR_COLORS,
  MAX_NAME,
  MAX_STORIES,
  MAX_STORY_TITLE,
  REACTIONS,
  type ClientMessage,
  type RoomState,
  type RoomView,
  type RoundRecord,
  type Story,
} from "./protocol";
import { computeStats } from "./stats";

export interface ApplyResult {
  error?: string;
  /** Participant removed by the host; their sockets should be closed. */
  kicked?: string;
  reaction?: { from: string; emoji: string };
  /** False when nothing needs saving or broadcasting. */
  changed: boolean;
}

export function createRoom(id: string, now: number): RoomState {
  return {
    id,
    createdAt: now,
    updatedAt: now,
    hostId: null,
    settings: {
      deckId: DEFAULT_DECK_ID,
      customCards: ["1", "2", "3", "5", "8"],
      openControls: true,
      autoReveal: false,
      timerSeconds: 60,
    },
    participants: {},
    stories: [],
    currentStoryId: null,
    votes: {},
    revealed: false,
    previousRounds: [],
    timer: { endsAt: null, duration: 60 },
    quickRounds: 0,
  };
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export function currentCards(state: RoomState): string[] {
  return deckCards(state.settings.deckId, state.settings.customCards);
}

function cleanName(name: unknown): string {
  return String(name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
}

function cleanColor(color: unknown): string {
  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color : AVATAR_COLORS[0];
}

function cleanLink(link: unknown): string | undefined {
  if (typeof link !== "string") return undefined;
  const trimmed = link.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed.slice(0, 500) : undefined;
}

function canControl(state: RoomState, actor: string): boolean {
  return state.settings.openControls || state.hostId === actor;
}

function resetRound(state: RoomState) {
  state.votes = {};
  state.revealed = false;
  state.previousRounds = [];
  state.timer.endsAt = null;
}

function snapshotRound(state: RoomState, now: number): RoundRecord {
  const names: Record<string, string> = {};
  for (const id of Object.keys(state.votes)) names[id] = state.participants[id]?.name ?? "Someone";
  return {
    votes: { ...state.votes },
    names,
    stats: computeStats(state.votes, currentCards(state)),
    revealedAt: now,
  };
}

/** Picks the next pending story after the given one, wrapping to the top. */
function nextPending(state: RoomState, afterId: string | null): string | null {
  const start = afterId ? state.stories.findIndex((s) => s.id === afterId) : -1;
  const n = state.stories.length;
  for (let i = 1; i <= n; i++) {
    const s = state.stories[(start + i + n) % n];
    if (s.status === "pending" && s.id !== afterId) return s.id;
  }
  return null;
}

function story(state: RoomState, id: string): Story | undefined {
  return state.stories.find((s) => s.id === id);
}

/** Voters who are online right now. Auto-reveal waits for all of them. */
function onlineVoters(state: RoomState, online: Set<string>): string[] {
  return Object.values(state.participants)
    .filter((p) => p.role === "voter" && online.has(p.id))
    .map((p) => p.id);
}

function maybeAutoReveal(state: RoomState, online: Set<string>, now: number) {
  if (!state.settings.autoReveal || state.revealed) return;
  const voters = onlineVoters(state, online);
  if (voters.length > 0 && voters.every((id) => id in state.votes)) reveal(state, now);
}

function reveal(state: RoomState, _now: number) {
  state.revealed = true;
  state.timer.endsAt = null;
}

/**
 * Applies one client message to the room. The caller has already attached the
 * sender's participant id (`actor`); only "join" may come from a newcomer.
 */
export function applyMessage(
  state: RoomState,
  actor: string,
  msg: ClientMessage,
  now: number,
  online: Set<string>,
): ApplyResult {
  const ok: ApplyResult = { changed: true };
  const fail = (error: string): ApplyResult => ({ error, changed: false });
  const me = state.participants[actor];

  if (msg.type === "join") {
    const name = cleanName(msg.name);
    if (!name) return fail("Please enter a name.");
    const role = msg.role === "spectator" ? "spectator" : "voter";
    if (me) {
      me.name = name;
      me.color = cleanColor(msg.color);
      me.role = role;
    } else {
      if (Object.keys(state.participants).length >= 100) return fail("This room is full.");
      state.participants[actor] = { id: actor, name, color: cleanColor(msg.color), role, joinedAt: now };
    }
    if (!state.hostId || !state.participants[state.hostId]) state.hostId = actor;
    return touch(state, now, ok);
  }

  if (!me) return fail("Join the room first.");

  const needControl = (): ApplyResult | null =>
    canControl(state, actor) ? null : fail("Only the host can do that in this room.");
  const needHost = (): ApplyResult | null =>
    state.hostId === actor ? null : fail("Only the host can do that.");

  switch (msg.type) {
    case "profile": {
      if (msg.name !== undefined) {
        const name = cleanName(msg.name);
        if (!name) return fail("Please enter a name.");
        me.name = name;
      }
      if (msg.color !== undefined) me.color = cleanColor(msg.color);
      if (msg.role === "voter" || msg.role === "spectator") {
        me.role = msg.role;
        if (me.role === "spectator" && !state.revealed) delete state.votes[actor];
      }
      maybeAutoReveal(state, online, now);
      return touch(state, now, ok);
    }

    case "vote": {
      if (me.role !== "voter") return fail("Spectators can't vote. Switch to voter first.");
      if (state.revealed) return fail("Cards are already revealed. Vote again to start a new round.");
      if (msg.card === null) {
        delete state.votes[actor];
      } else {
        const allowed = [...currentCards(state), ...SPECIAL_CARDS];
        if (!allowed.includes(msg.card)) return fail("That card isn't in this deck.");
        state.votes[actor] = msg.card;
      }
      maybeAutoReveal(state, online, now);
      return touch(state, now, ok);
    }

    case "reveal": {
      const denied = needControl();
      if (denied) return denied;
      if (state.revealed) return { changed: false };
      if (Object.keys(state.votes).length === 0) return fail("Nobody has voted yet.");
      reveal(state, now);
      return touch(state, now, ok);
    }

    case "revote": {
      const denied = needControl();
      if (denied) return denied;
      const previous = state.revealed ? [...state.previousRounds, snapshotRound(state, now)] : state.previousRounds;
      resetRound(state);
      state.previousRounds = previous;
      return touch(state, now, ok);
    }

    case "clear": {
      const denied = needControl();
      if (denied) return denied;
      resetRound(state);
      return touch(state, now, ok);
    }

    case "accept": {
      const denied = needControl();
      if (denied) return denied;
      if (!state.revealed) return fail("Reveal the cards before saving an estimate.");
      const estimate = String(msg.estimate ?? "").trim().slice(0, 12);
      if (!estimate) return fail("Pick an estimate to save.");
      const rounds = [...state.previousRounds, snapshotRound(state, now)];
      let current = state.currentStoryId ? story(state, state.currentStoryId) : undefined;
      if (!current) {
        if (state.stories.length >= MAX_STORIES) return fail("This room has too many stories.");
        state.quickRounds += 1;
        current = { id: newId(), title: `Quick round ${state.quickRounds}`, status: "pending", rounds: [] };
        state.stories.push(current);
      }
      current.status = "estimated";
      current.estimate = estimate;
      current.rounds = rounds;
      current.estimatedAt = now;
      resetRound(state);
      state.currentStoryId = nextPending(state, current.id);
      return touch(state, now, ok);
    }

    case "skip": {
      const denied = needControl();
      if (denied) return denied;
      const current = state.currentStoryId ? story(state, state.currentStoryId) : undefined;
      if (!current) return fail("There's no story to skip.");
      if (current.status === "pending") current.status = "skipped";
      resetRound(state);
      state.currentStoryId = nextPending(state, current.id);
      return touch(state, now, ok);
    }

    case "addStories": {
      const denied = needControl();
      if (denied) return denied;
      const incoming = (Array.isArray(msg.stories) ? msg.stories : [])
        .map((s) => ({ title: String(s?.title ?? "").trim().slice(0, MAX_STORY_TITLE), link: cleanLink(s?.link) }))
        .filter((s) => s.title);
      if (incoming.length === 0) return fail("Add at least one story title.");
      if (state.stories.length + incoming.length > MAX_STORIES)
        return fail(`A room can hold up to ${MAX_STORIES} stories.`);
      const added = incoming.map((s) => ({ id: newId(), title: s.title, link: s.link, status: "pending" as const, rounds: [] }));
      state.stories.push(...added);
      if (!state.currentStoryId && !state.revealed && Object.keys(state.votes).length === 0) {
        state.currentStoryId = added[0].id;
      }
      return touch(state, now, ok);
    }

    case "editStory": {
      const denied = needControl();
      if (denied) return denied;
      const s = story(state, msg.storyId);
      if (!s) return fail("That story no longer exists.");
      const title = String(msg.title ?? "").trim().slice(0, MAX_STORY_TITLE);
      if (!title) return fail("A story needs a title.");
      s.title = title;
      s.link = cleanLink(msg.link);
      return touch(state, now, ok);
    }

    case "removeStory": {
      const denied = needControl();
      if (denied) return denied;
      const idx = state.stories.findIndex((s) => s.id === msg.storyId);
      if (idx < 0) return { changed: false };
      if (state.currentStoryId === msg.storyId) {
        const next = nextPending(state, msg.storyId);
        resetRound(state);
        state.currentStoryId = next;
      }
      state.stories.splice(idx, 1);
      return touch(state, now, ok);
    }

    case "moveStory": {
      const denied = needControl();
      if (denied) return denied;
      const idx = state.stories.findIndex((s) => s.id === msg.storyId);
      if (idx < 0) return fail("That story no longer exists.");
      const to = Math.max(0, Math.min(state.stories.length - 1, Math.floor(Number(msg.toIndex) || 0)));
      const [s] = state.stories.splice(idx, 1);
      state.stories.splice(to, 0, s);
      return touch(state, now, ok);
    }

    case "selectStory": {
      const denied = needControl();
      if (denied) return denied;
      if (msg.storyId !== null && !story(state, msg.storyId)) return fail("That story no longer exists.");
      if (msg.storyId === state.currentStoryId) return { changed: false };
      resetRound(state);
      state.currentStoryId = msg.storyId;
      return touch(state, now, ok);
    }

    case "reopenStory": {
      const denied = needControl();
      if (denied) return denied;
      const s = story(state, msg.storyId);
      if (!s) return fail("That story no longer exists.");
      s.status = "pending";
      delete s.estimate;
      delete s.estimatedAt;
      return touch(state, now, ok);
    }

    case "settings": {
      const denied = needHost();
      if (denied) return denied;
      const next = { ...state.settings };
      const s = msg.settings ?? {};
      if (typeof s.deckId === "string" && (s.deckId === CUSTOM_DECK_ID || DECKS.some((d) => d.id === s.deckId))) {
        next.deckId = s.deckId;
      }
      if (Array.isArray(s.customCards)) {
        const cards = parseCustomCards(s.customCards.join(","));
        if (cards.length < 2) return fail("A custom deck needs at least two cards.");
        next.customCards = cards;
      }
      if (typeof s.openControls === "boolean") next.openControls = s.openControls;
      if (typeof s.autoReveal === "boolean") next.autoReveal = s.autoReveal;
      if (typeof s.timerSeconds === "number" && Number.isFinite(s.timerSeconds)) {
        next.timerSeconds = Math.max(10, Math.min(1800, Math.round(s.timerSeconds)));
      }
      const deckChanged =
        next.deckId !== state.settings.deckId ||
        (next.deckId === CUSTOM_DECK_ID && next.customCards.join() !== state.settings.customCards.join());
      state.settings = next;
      state.timer.duration = next.timerSeconds;
      if (deckChanged && !state.revealed) state.votes = {};
      maybeAutoReveal(state, online, now);
      return touch(state, now, ok);
    }

    case "timer": {
      const denied = needControl();
      if (denied) return denied;
      if (msg.action === "start") {
        state.timer.duration = state.settings.timerSeconds;
        state.timer.endsAt = now + state.settings.timerSeconds * 1000;
      } else {
        state.timer.endsAt = null;
      }
      return touch(state, now, ok);
    }

    case "kick": {
      const denied = needHost();
      if (denied) return denied;
      if (msg.participantId === actor) return fail("You can't remove yourself.");
      if (!state.participants[msg.participantId]) return { changed: false };
      delete state.participants[msg.participantId];
      if (!state.revealed) delete state.votes[msg.participantId];
      maybeAutoReveal(state, online, now);
      return touch(state, now, { ...ok, kicked: msg.participantId });
    }

    case "makeHost": {
      const denied = needHost();
      if (denied) return denied;
      if (!state.participants[msg.participantId]) return fail("That person has left.");
      state.hostId = msg.participantId;
      return touch(state, now, ok);
    }

    case "claimHost": {
      if (state.hostId === actor) return { changed: false };
      if (state.hostId && online.has(state.hostId)) return fail("The host is still here. Ask them to hand over.");
      state.hostId = actor;
      return touch(state, now, ok);
    }

    case "react": {
      if (!REACTIONS.includes(msg.emoji)) return { changed: false };
      return { changed: false, reaction: { from: actor, emoji: msg.emoji } };
    }

    default:
      return fail("Unknown action.");
  }
}

function touch(state: RoomState, now: number, result: ApplyResult): ApplyResult {
  state.updatedAt = now;
  return result;
}

/** Called when someone's last connection drops, so auto-reveal doesn't wait on them. */
export function handleDisconnect(state: RoomState, online: Set<string>, now: number): boolean {
  const before = state.revealed;
  maybeAutoReveal(state, online, now);
  return before !== state.revealed;
}

/**
 * The view for one person. Hides other people's cards until the round is
 * revealed; the viewer always sees their own card.
 */
export function toView(state: RoomState, online: Set<string>, now: number, viewer?: string): RoomView {
  const votes: Record<string, string | true> = {};
  for (const [id, card] of Object.entries(state.votes)) votes[id] = state.revealed || id === viewer ? card : true;
  return {
    ...state,
    votes,
    online: [...online].filter((id) => state.participants[id]),
    stats: state.revealed ? computeStats(state.votes, currentCards(state)) : null,
    serverNow: now,
  };
}
