import { SPECIAL_CARDS, cardValue } from "./decks";

export interface RoundStats {
  /** Number of votes cast, including "?" and "☕". */
  voteCount: number;
  /** Votes on value cards (excludes "?" and "☕"). */
  valueVoteCount: number;
  average: number | null;
  median: number | null;
  /** How many people picked each card, in deck order (specials last). */
  distribution: { card: string; count: number }[];
  /** True when everyone who voted on a value card picked the same one. */
  consensus: boolean;
  /** The card the team would most likely settle on. */
  suggested: string | null;
  /** Ids of the lowest and highest voters, when the votes are spread out. */
  lowVoters: string[];
  highVoters: string[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Summarises a revealed round. Works for numeric decks (average and median of
 * the values) and for ordinal decks such as T-shirt sizes (median position).
 */
export function computeStats(votes: Record<string, string>, cards: string[]): RoundStats {
  const entries = Object.entries(votes);
  const order = [...cards, ...SPECIAL_CARDS];
  const counts = new Map<string, number>();
  for (const [, card] of entries) counts.set(card, (counts.get(card) ?? 0) + 1);
  const distribution = [...counts.entries()]
    .map(([card, count]) => ({ card, count }))
    .sort((a, b) => rank(order, a.card) - rank(order, b.card));

  const valueVotes = entries.filter(([, c]) => !SPECIAL_CARDS.includes(c));
  const empty: RoundStats = {
    voteCount: entries.length,
    valueVoteCount: valueVotes.length,
    average: null,
    median: null,
    distribution,
    consensus: false,
    suggested: null,
    lowVoters: [],
    highVoters: [],
  };
  if (valueVotes.length === 0) return empty;

  const distinct = new Set(valueVotes.map(([, c]) => c));
  const consensus = distinct.size === 1;

  // Position of each vote in the deck. Cards no longer in the deck (the deck
  // was changed mid-round) sort by their numeric value at the end.
  const positions = valueVotes.map(([id, c]) => ({ id, card: c, pos: rank(cards, c) }));
  positions.sort((a, b) => a.pos - b.pos);
  const minPos = positions[0].pos;
  const maxPos = positions[positions.length - 1].pos;
  const spreadOut = maxPos - minPos >= 2;
  const lowVoters = spreadOut ? positions.filter((p) => p.pos === minPos).map((p) => p.id) : [];
  const highVoters = spreadOut ? positions.filter((p) => p.pos === maxPos).map((p) => p.id) : [];

  const numeric = valueVotes.map(([, c]) => cardValue(c));
  const allNumeric = numeric.every((n) => n !== null);
  let average: number | null = null;
  let median: number | null = null;
  let suggested: string | null;

  if (allNumeric) {
    const nums = (numeric as number[]).slice().sort((a, b) => a - b);
    average = round1(nums.reduce((s, n) => s + n, 0) / nums.length);
    const mid = Math.floor(nums.length / 2);
    median = round1(nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2);
    suggested = nearestCard(average, cards) ?? positions[Math.floor(positions.length / 2)].card;
  } else {
    // Ordinal deck: take the upper median position.
    suggested = positions[Math.floor(positions.length / 2)].card;
  }
  if (consensus) suggested = valueVotes[0][1];

  return { ...empty, average, median, consensus, suggested, lowVoters, highVoters };
}

function rank(order: string[], card: string): number {
  const i = order.indexOf(card);
  if (i >= 0) return i;
  const v = cardValue(card);
  return order.length + (v ?? 0);
}

/** The numeric card closest to a value; ties go to the larger card. */
export function nearestCard(value: number, cards: string[]): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const card of cards) {
    const v = cardValue(card);
    if (v === null) continue;
    const d = Math.abs(v - value);
    if (d < bestDist || (d === bestDist && best !== null && v > (cardValue(best) ?? -Infinity))) {
      best = card;
      bestDist = d;
    }
  }
  return best;
}
