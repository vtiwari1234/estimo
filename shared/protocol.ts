import type { RoundStats } from "./stats";

export type Role = "voter" | "spectator";

export interface Participant {
  id: string;
  name: string;
  color: string;
  role: Role;
  joinedAt: number;
}

export interface RoundRecord {
  votes: Record<string, string>;
  /** Display names at the time of the round, so history survives people leaving. */
  names: Record<string, string>;
  stats: RoundStats;
  revealedAt: number;
}

export type StoryStatus = "pending" | "estimated" | "skipped";

export interface Story {
  id: string;
  title: string;
  link?: string;
  status: StoryStatus;
  estimate?: string;
  rounds: RoundRecord[];
  estimatedAt?: number;
}

export interface Settings {
  deckId: string;
  customCards: string[];
  /** When false, only the host can reveal, reset, move between stories and run the timer. */
  openControls: boolean;
  autoReveal: boolean;
  timerSeconds: number;
}

export interface Timer {
  endsAt: number | null;
  duration: number;
}

/** Full room state as stored on the server. */
export interface RoomState {
  id: string;
  createdAt: number;
  updatedAt: number;
  hostId: string | null;
  settings: Settings;
  participants: Record<string, Participant>;
  stories: Story[];
  currentStoryId: string | null;
  /** Votes for the current round, by participant id. */
  votes: Record<string, string>;
  revealed: boolean;
  /** Set when someone hides revealed cards again, so auto-reveal doesn't flip them straight back. */
  rehidden?: boolean;
  /** Earlier revealed rounds of the current item, before "vote again". */
  previousRounds: RoundRecord[];
  timer: Timer;
  /** Results of quick rounds that were not attached to a story. */
  quickRounds: number;
}

/** What a client sees. Votes are hidden until reveal. */
export interface RoomView extends Omit<RoomState, "votes"> {
  /** Before reveal, only `true` for people who voted. After reveal, their card. */
  votes: Record<string, string | true>;
  online: string[];
  stats: RoundStats | null;
  serverNow: number;
}

export type ClientMessage =
  | { type: "join"; id: string; name: string; color: string; role: Role }
  | { type: "profile"; name?: string; color?: string; role?: Role }
  | { type: "vote"; card: string | null }
  | { type: "reveal" }
  | { type: "hide" }
  | { type: "revote" }
  | { type: "clear" }
  | { type: "accept"; estimate: string }
  | { type: "skip" }
  | { type: "addStories"; stories: { title: string; link?: string }[] }
  | { type: "editStory"; storyId: string; title: string; link?: string }
  | { type: "removeStory"; storyId: string }
  | { type: "moveStory"; storyId: string; toIndex: number }
  | { type: "selectStory"; storyId: string | null }
  | { type: "reopenStory"; storyId: string }
  | { type: "settings"; settings: Partial<Settings> }
  | { type: "timer"; action: "start" | "stop" }
  | { type: "kick"; participantId: string }
  | { type: "makeHost"; participantId: string }
  | { type: "claimHost" }
  | { type: "react"; emoji: string };

export type ServerMessage =
  | { type: "state"; room: RoomView; you: string }
  | { type: "reaction"; from: string; emoji: string }
  | { type: "error"; message: string }
  | { type: "kicked" };

export const REACTIONS = ["👍", "🎉", "🤔", "😅", "🔥", "☕"];
export const AVATAR_COLORS = [
  "#0f766e",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#1d4ed8",
  "#15803d",
  "#c2410c",
  "#0e7490",
  "#a21caf",
  "#4d7c0f",
];

export const ROOM_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
export const MAX_NAME = 32;
export const MAX_STORY_TITLE = 300;
export const MAX_STORIES = 300;
