import { SPECIAL_CARDS, deckCards } from "../../shared/decks";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { PlayingCard } from "./PlayingCard";

export function Hand({ room, mine, send }: { room: RoomView; mine: string | null; send: (m: ClientMessage) => void }) {
  const cards = [...deckCards(room.settings.deckId, room.settings.customCards), ...SPECIAL_CARDS];
  const mid = (cards.length - 1) / 2;
  return (
    <div className="border-t border-line bg-bg/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="mb-1 text-center eyebrow !text-[10px]">
          {room.revealed ? "Cards are revealed. Vote again to start a new round." : mine ? "Tap your card again to take it back" : "Pick a card"}
        </p>
        <div
          role="radiogroup"
          aria-label="Your card"
          className="flex justify-start gap-1 overflow-x-auto px-2 pt-5 pb-1 sm:justify-center sm:overflow-visible"
        >
          {cards.map((card, i) => {
            const selected = mine === card;
            const offset = i - mid;
            return (
              <button
                key={card}
                role="radio"
                aria-checked={selected}
                aria-label={card === "?" ? "Not sure" : card === "☕" ? "Need a break" : `${card} points`}
                disabled={room.revealed}
                onClick={() => send({ type: "vote", card: selected ? null : card })}
                className="group shrink-0 rounded-lg transition-transform duration-200 disabled:opacity-50 sm:-mx-0.5"
                style={{
                  transform: selected ? "translateY(-18px) rotate(0deg)" : `translateY(${Math.abs(offset) * 1.2}px) rotate(${offset * 1.4}deg)`,
                }}
              >
                <PlayingCard
                  value={card}
                  size="sm"
                  className={`transition group-hover:-translate-y-2 ${selected ? "outline-2 outline-offset-2 outline-brand" : ""}`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
