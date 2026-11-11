export interface Deck {
  id: string;
  name: string;
  cards: string[];
}

/** Cards every deck gets in addition to its values. */
export const UNSURE = "?";
export const BREAK = "☕";
export const SPECIAL_CARDS = [UNSURE, BREAK];

export const DECKS: Deck[] = [
  {
    id: "modified-fibonacci",
    name: "Modified Fibonacci",
    cards: ["0", "½", "1", "2", "3", "5", "8", "13", "20", "40", "100"],
  },
  {
    id: "fibonacci",
    name: "Fibonacci",
    cards: ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89"],
  },
  {
    id: "t-shirt",
    name: "T-shirt sizes",
    cards: ["XS", "S", "M", "L", "XL", "XXL"],
  },
  {
    id: "powers-of-two",
    name: "Powers of 2",
    cards: ["0", "1", "2", "4", "8", "16", "32", "64"],
  },
  {
    id: "hours",
    name: "Hours",
    cards: ["1", "2", "4", "8", "12", "16", "24", "32", "40"],
  },
];

export const DEFAULT_DECK_ID = "modified-fibonacci";
export const CUSTOM_DECK_ID = "custom";

export const MAX_CUSTOM_CARDS = 20;
export const MAX_CARD_LENGTH = 6;

/** Parses a comma-separated list into a clean, de-duplicated card list. */
export function parseCustomCards(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(",")) {
    const card = raw.trim().slice(0, MAX_CARD_LENGTH);
    if (!card || seen.has(card) || SPECIAL_CARDS.includes(card)) continue;
    seen.add(card);
    out.push(card);
    if (out.length >= MAX_CUSTOM_CARDS) break;
  }
  return out;
}

/** The value cards for a deck id (custom decks pass their own cards). */
export function deckCards(deckId: string, customCards: string[]): string[] {
  if (deckId === CUSTOM_DECK_ID) return customCards;
  return (DECKS.find((d) => d.id === deckId) ?? DECKS[0]).cards;
}

/** Numeric value of a card, or null for non-numeric cards such as "M" or "?". */
export function cardValue(card: string): number | null {
  if (card === "½") return 0.5;
  if (!/^\d+(\.\d+)?$/.test(card)) return null;
  return Number(card);
}
