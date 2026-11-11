import { SPECIAL_CARDS, deckCards } from "../../shared/decks";
import type { ClientMessage, RoomView } from "../../shared/protocol";

export function Hand({ room, mine, send }: { room: RoomView; mine: string | null; send: (m: ClientMessage) => void }) {
  const cards = [...deckCards(room.settings.deckId, room.settings.customCards), ...SPECIAL_CARDS];
  return (
    <div className="border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="mb-2 text-center text-xs text-ink-3">
          {room.revealed ? "Cards are revealed. Vote again to start a new round." : mine ? "Tap your card again to take it back." : "Pick a card"}
        </p>
        <div role="radiogroup" aria-label="Your card" className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible">
          {cards.map((card) => {
            const selected = mine === card;
            return (
              <button
                key={card}
                role="radio"
                aria-checked={selected}
                aria-label={card === "?" ? "Not sure" : card === "☕" ? "Need a break" : `${card} points`}
                disabled={room.revealed}
                onClick={() => send({ type: "vote", card: selected ? null : card })}
                className={`grid h-16 w-11 shrink-0 place-items-center rounded-xl border-2 font-display text-lg font-bold transition sm:h-20 sm:w-14 sm:text-xl ${
                  selected
                    ? "-translate-y-2 border-brand bg-brand text-brand-ink shadow-lg"
                    : "border-line bg-bg hover:-translate-y-1 hover:border-brand"
                } disabled:translate-y-0 disabled:opacity-50`}
              >
                {card}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
