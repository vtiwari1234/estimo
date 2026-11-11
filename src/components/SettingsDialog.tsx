import { useState } from "react";
import { CUSTOM_DECK_ID, DECKS, parseCustomCards } from "../../shared/decks";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";

export function SettingsDialog({
  room,
  me,
  send,
  onClose,
}: {
  room: RoomView;
  me: string;
  send: (m: ClientMessage) => void;
  onClose: () => void;
}) {
  const isHost = room.hostId === me;
  const s = room.settings;
  const [custom, setCustom] = useState(s.customCards.join(", "));
  const [timer, setTimer] = useState(String(s.timerSeconds));
  const hostOnline = room.hostId ? room.online.includes(room.hostId) : false;
  const people = Object.values(room.participants).sort((a, b) => a.joinedAt - b.joinedAt);

  const update = (settings: ClientMessage & { type: "settings" }) => send(settings);

  return (
    <Modal title="Room settings" onClose={onClose}>
      {!isHost && (
        <div className="mb-4 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
          Only the host ({room.hostId ? room.participants[room.hostId]?.name : "nobody"}) can change settings.
          {!hostOnline && (
            <button onClick={() => send({ type: "claimHost" })} className="mt-2 block font-semibold text-brand underline">
              The host is away. Become host
            </button>
          )}
        </div>
      )}

      <fieldset disabled={!isHost} className="space-y-5 disabled:opacity-60">
        <div>
          <label htmlFor="deck" className="text-sm font-semibold">
            Card deck
          </label>
          <select
            id="deck"
            value={s.deckId}
            onChange={(e) => update({ type: "settings", settings: { deckId: e.target.value } })}
            className="mt-2 w-full rounded-xl border border-line bg-bg px-3 py-2.5"
          >
            {DECKS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}: {d.cards.join(", ")}
              </option>
            ))}
            <option value={CUSTOM_DECK_ID}>Custom deck</option>
          </select>
          {s.deckId === CUSTOM_DECK_ID && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                update({ type: "settings", settings: { customCards: parseCustomCards(custom) } });
              }}
            >
              <input
                aria-label="Custom cards, separated by commas"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="1, 2, 3, 5, 8"
                className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm"
              />
              <button className="rounded-xl border border-line px-3 text-sm font-semibold hover:bg-surface-2">Save</button>
            </form>
          )}
          <p className="mt-1 text-xs text-ink-3">Every deck also has ? (not sure) and ☕ (need a break). Changing the deck clears unrevealed votes.</p>
        </div>

        <Toggle
          label="Anyone can run the round"
          hint="Reveal, vote again, move between stories and start the timer. Off means host only."
          checked={s.openControls}
          onChange={(v) => update({ type: "settings", settings: { openControls: v } })}
        />
        <Toggle
          label="Reveal automatically"
          hint="Flip the cards as soon as every voter who is online has voted."
          checked={s.autoReveal}
          onChange={(v) => update({ type: "settings", settings: { autoReveal: v } })}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ type: "settings", settings: { timerSeconds: Number(timer) } });
          }}
        >
          <label htmlFor="timer" className="text-sm font-semibold">
            Timer length (seconds)
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="timer"
              type="number"
              min={10}
              max={1800}
              value={timer}
              onChange={(e) => setTimer(e.target.value)}
              className="w-28 rounded-xl border border-line bg-bg px-3 py-2"
            />
            <button className="rounded-xl border border-line px-3 text-sm font-semibold hover:bg-surface-2">Save</button>
          </div>
        </form>
      </fieldset>

      <div className="mt-6">
        <h3 className="text-sm font-semibold">People ({people.length})</h3>
        <ul className="mt-2 divide-y divide-line">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Avatar name={p.name} color={p.color} size={28} dim={!room.online.includes(p.id)} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {p.name}
                {p.id === me && " (you)"}
                <span className="ml-1 text-xs text-ink-3">
                  {p.id === room.hostId ? "host · " : ""}
                  {p.role}
                  {!room.online.includes(p.id) && " · away"}
                </span>
              </span>
              {isHost && p.id !== me && (
                <>
                  <button onClick={() => send({ type: "makeHost", participantId: p.id })} className="text-xs font-semibold text-brand hover:underline">
                    Make host
                  </button>
                  <button
                    onClick={() => confirm(`Remove ${p.name} from the room?`) && send({ type: "kick", participantId: p.id })}
                    className="text-xs font-semibold text-danger hover:underline"
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-ink-3">{hint}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-1 h-6 w-11 shrink-0 rounded-full bg-line transition peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-brand after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
    </label>
  );
}
