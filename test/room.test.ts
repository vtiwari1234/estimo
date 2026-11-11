import { describe, expect, it } from "vitest";
import { parseCustomCards } from "../shared/decks";
import type { ClientMessage } from "../shared/protocol";
import { applyMessage, createRoom, handleDisconnect, toView } from "../shared/room";
import { computeStats, nearestCard } from "../shared/stats";

const NOW = 1_700_000_000_000;

function setup(names = ["ana", "ben", "cy"]) {
  const room = createRoom("team", NOW);
  const online = new Set<string>();
  for (const n of names) {
    online.add(n);
    applyMessage(room, n, { type: "join", id: n, name: n.toUpperCase(), color: "#123456", role: "voter" }, NOW, online);
  }
  const act = (who: string, msg: ClientMessage) => applyMessage(room, who, msg, NOW, online);
  return { room, online, act };
}

describe("joining", () => {
  it("makes the first person host and keeps names tidy", () => {
    const { room } = setup();
    expect(room.hostId).toBe("ana");
    expect(Object.keys(room.participants)).toEqual(["ana", "ben", "cy"]);
  });

  it("rejects blank names", () => {
    const room = createRoom("r", NOW);
    const res = applyMessage(room, "x", { type: "join", id: "x", name: "   ", color: "#000000", role: "voter" }, NOW, new Set(["x"]));
    expect(res.error).toBeTruthy();
  });

  it("rejoining updates the existing participant", () => {
    const { room, act } = setup();
    act("ben", { type: "join", id: "ben", name: "Benny", color: "#654321", role: "spectator" });
    expect(room.participants.ben.name).toBe("Benny");
    expect(room.participants.ben.role).toBe("spectator");
    expect(Object.keys(room.participants)).toHaveLength(3);
  });
});

describe("voting", () => {
  it("hides votes until reveal", () => {
    const { room, online, act } = setup();
    act("ana", { type: "vote", card: "5" });
    act("ben", { type: "vote", card: "8" });
    let view = toView(room, online, NOW);
    expect(view.votes).toEqual({ ana: true, ben: true });
    expect(view.stats).toBeNull();
    act("cy", { type: "reveal" });
    view = toView(room, online, NOW);
    expect(view.votes).toEqual({ ana: "5", ben: "8" });
    expect(view.stats?.average).toBe(6.5);
  });

  it("hides revealed cards again but keeps the votes", () => {
    const { room, online, act } = setup();
    act("ana", { type: "vote", card: "5" });
    act("ben", { type: "vote", card: "8" });
    act("ana", { type: "reveal" });
    expect(act("ben", { type: "hide" }).error).toBeUndefined();
    expect(room.revealed).toBe(false);
    expect(toView(room, online, NOW, "cy").votes).toEqual({ ana: true, ben: true });
    expect(act("cy", { type: "vote", card: "3" }).error).toBeUndefined();
    act("ana", { type: "reveal" });
    expect(toView(room, online, NOW).votes).toEqual({ ana: "5", ben: "8", cy: "3" });
  });

  it("does not auto-reveal straight after someone hides the cards", () => {
    const { room, act } = setup(["ana", "ben"]);
    act("ana", { type: "settings", settings: { autoReveal: true } });
    act("ana", { type: "vote", card: "3" });
    act("ben", { type: "vote", card: "5" });
    expect(room.revealed).toBe(true);
    act("ana", { type: "hide" });
    act("ben", { type: "vote", card: "8" });
    expect(room.revealed).toBe(false);
    act("ana", { type: "clear" });
    act("ana", { type: "vote", card: "3" });
    act("ben", { type: "vote", card: "3" });
    expect(room.revealed).toBe(true);
  });

  it("reset clears estimates whether or not the cards are revealed", () => {
    const { room, act } = setup();
    act("ana", { type: "vote", card: "5" });
    act("ana", { type: "reveal" });
    act("ben", { type: "clear" });
    expect(room.revealed).toBe(false);
    expect(room.votes).toEqual({});
  });

  it("only lets the host hide cards when controls are host-only", () => {
    const { act } = setup();
    act("ana", { type: "settings", settings: { openControls: false } });
    act("ana", { type: "vote", card: "5" });
    act("ana", { type: "reveal" });
    expect(act("ben", { type: "hide" }).error).toMatch(/host/);
  });

  it("rejects cards that are not in the deck and votes after reveal", () => {
    const { act } = setup();
    expect(act("ana", { type: "vote", card: "7" }).error).toBeTruthy();
    act("ana", { type: "vote", card: "3" });
    act("ana", { type: "reveal" });
    expect(act("ben", { type: "vote", card: "3" }).error).toBeTruthy();
  });

  it("does not let spectators vote", () => {
    const { act } = setup();
    act("cy", { type: "profile", role: "spectator" });
    expect(act("cy", { type: "vote", card: "3" }).error).toMatch(/Spectators/);
  });

  it("auto-reveals once every online voter has voted", () => {
    const { room, online, act } = setup();
    act("ana", { type: "settings", settings: { autoReveal: true } });
    act("ana", { type: "vote", card: "3" });
    act("ben", { type: "vote", card: "3" });
    expect(room.revealed).toBe(false);
    online.delete("cy");
    expect(handleDisconnect(room, online, NOW)).toBe(true);
    expect(room.revealed).toBe(true);
  });

  it("refuses to reveal an empty round", () => {
    const { act } = setup();
    expect(act("ana", { type: "reveal" }).error).toMatch(/Nobody/);
  });
});

describe("host controls", () => {
  it("limits controls to the host when open controls are off", () => {
    const { act } = setup();
    expect(act("ben", { type: "settings", settings: { openControls: false } }).error).toBeTruthy();
    act("ana", { type: "settings", settings: { openControls: false } });
    act("ben", { type: "vote", card: "5" });
    expect(act("ben", { type: "reveal" }).error).toMatch(/host/);
    expect(act("ana", { type: "reveal" }).error).toBeUndefined();
  });

  it("can hand over, kick and let others claim an absent host", () => {
    const { room, online, act } = setup();
    act("ana", { type: "makeHost", participantId: "ben" });
    expect(room.hostId).toBe("ben");
    const kicked = act("ben", { type: "kick", participantId: "ana" });
    expect(kicked.kicked).toBe("ana");
    expect(room.participants.ana).toBeUndefined();
    expect(act("cy", { type: "claimHost" }).error).toBeTruthy();
    online.delete("ben");
    act("cy", { type: "claimHost" });
    expect(room.hostId).toBe("cy");
  });

  it("clears unrevealed votes when the deck changes", () => {
    const { room, act } = setup();
    act("ben", { type: "vote", card: "5" });
    act("ana", { type: "settings", settings: { deckId: "t-shirt" } });
    expect(room.votes).toEqual({});
    expect(act("ben", { type: "vote", card: "M" }).error).toBeUndefined();
  });
});

describe("story queue", () => {
  function withStories() {
    const ctx = setup();
    ctx.act("ana", { type: "addStories", stories: [{ title: "Login page" }, { title: "Search", link: "https://x.test/1" }, { title: "  " }] });
    return ctx;
  }

  it("adds stories and selects the first one", () => {
    const { room } = withStories();
    expect(room.stories.map((s) => s.title)).toEqual(["Login page", "Search"]);
    expect(room.currentStoryId).toBe(room.stories[0].id);
    expect(room.stories[1].link).toBe("https://x.test/1");
  });

  it("saves the estimate with every round and moves to the next story", () => {
    const { room, act } = withStories();
    act("ana", { type: "vote", card: "3" });
    act("ben", { type: "vote", card: "13" });
    act("ana", { type: "reveal" });
    act("ana", { type: "revote" });
    expect(room.previousRounds).toHaveLength(1);
    act("ana", { type: "vote", card: "5" });
    act("ben", { type: "vote", card: "5" });
    act("ana", { type: "reveal" });
    act("ana", { type: "accept", estimate: "5" });
    const first = room.stories[0];
    expect(first.status).toBe("estimated");
    expect(first.estimate).toBe("5");
    expect(first.rounds).toHaveLength(2);
    expect(first.rounds[0].names.ben).toBe("BEN");
    expect(room.currentStoryId).toBe(room.stories[1].id);
    expect(room.votes).toEqual({});
  });

  it("records quick rounds without a story", () => {
    const { room, act } = setup();
    act("ana", { type: "vote", card: "2" });
    act("ana", { type: "reveal" });
    act("ana", { type: "accept", estimate: "2" });
    expect(room.stories).toHaveLength(1);
    expect(room.stories[0].title).toBe("Quick round 1");
    expect(room.currentStoryId).toBeNull();
  });

  it("skips, reorders, removes and reopens stories", () => {
    const { room, act } = withStories();
    const [a, b] = room.stories;
    act("ana", { type: "skip" });
    expect(a.status).toBe("skipped");
    expect(room.currentStoryId).toBe(b.id);
    act("ana", { type: "moveStory", storyId: b.id, toIndex: 0 });
    expect(room.stories[0].id).toBe(b.id);
    act("ana", { type: "reopenStory", storyId: a.id });
    expect(a.status).toBe("pending");
    act("ana", { type: "removeStory", storyId: b.id });
    expect(room.currentStoryId).toBe(a.id);
  });
});

describe("timer and reactions", () => {
  it("starts and stops the timer", () => {
    const { room, act } = setup();
    act("ana", { type: "settings", settings: { timerSeconds: 90 } });
    act("ben", { type: "timer", action: "start" });
    expect(room.timer.endsAt).toBe(NOW + 90_000);
    act("ben", { type: "timer", action: "stop" });
    expect(room.timer.endsAt).toBeNull();
  });

  it("only passes known emoji", () => {
    const { act } = setup();
    expect(act("ana", { type: "react", emoji: "🎉" }).reaction).toEqual({ from: "ana", emoji: "🎉" });
    expect(act("ana", { type: "react", emoji: "💣" }).reaction).toBeUndefined();
  });
});

describe("stats", () => {
  const fib = ["0", "½", "1", "2", "3", "5", "8", "13", "20", "40", "100"];

  it("computes average, median, consensus and outliers", () => {
    const s = computeStats({ a: "3", b: "5", c: "13", d: "?" }, fib);
    expect(s.average).toBe(7);
    expect(s.median).toBe(5);
    expect(s.consensus).toBe(false);
    expect(s.suggested).toBe("8");
    expect(s.lowVoters).toEqual(["a"]);
    expect(s.highVoters).toEqual(["c"]);
    expect(s.distribution.map((d) => d.card)).toEqual(["3", "5", "13", "?"]);
  });

  it("flags consensus and skips outliers when votes are close", () => {
    const same = computeStats({ a: "5", b: "5" }, fib);
    expect(same.consensus).toBe(true);
    expect(same.suggested).toBe("5");
    const close = computeStats({ a: "3", b: "5" }, fib);
    expect(close.lowVoters).toEqual([]);
  });

  it("handles half points and T-shirt sizes", () => {
    expect(computeStats({ a: "½", b: "1" }, fib).average).toBe(0.8);
    const tshirt = computeStats({ a: "S", b: "M", c: "XL" }, ["XS", "S", "M", "L", "XL", "XXL"]);
    expect(tshirt.average).toBeNull();
    expect(tshirt.suggested).toBe("M");
  });

  it("rounds to the nearest card, ties upward", () => {
    expect(nearestCard(4, fib)).toBe("5");
    expect(nearestCard(10.5, fib)).toBe("13");
  });

  it("returns empty stats for only special cards", () => {
    const s = computeStats({ a: "?", b: "☕" }, fib);
    expect(s.valueVoteCount).toBe(0);
    expect(s.suggested).toBeNull();
  });
});

describe("custom decks", () => {
  it("parses, trims and de-duplicates", () => {
    expect(parseCustomCards(" 1, 2,2, ,XLarge-size, ?")).toEqual(["1", "2", "XLarge"]);
  });

  it("requires at least two cards", () => {
    const { act } = setup();
    expect(act("ana", { type: "settings", settings: { customCards: ["1"] } }).error).toBeTruthy();
    expect(act("ana", { type: "settings", settings: { deckId: "custom", customCards: ["S", "M", "L"] } }).error).toBeUndefined();
  });
});

describe("views", () => {
  it("shows the viewer their own card before reveal", () => {
    const { room, online, act } = setup();
    act("ana", { type: "vote", card: "8" });
    act("ben", { type: "vote", card: "3" });
    expect(toView(room, online, NOW, "ana").votes).toEqual({ ana: "8", ben: true });
  });
});
