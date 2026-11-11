import { useEffect, useState } from "react";
import { deckCards } from "../../shared/decks";
import type { ClientMessage, RoomView } from "../../shared/protocol";

export function Results({ room, canControl, send }: { room: RoomView; canControl: boolean; send: (m: ClientMessage) => void }) {
  const stats = room.stats!;
  const cards = deckCards(room.settings.deckId, room.settings.customCards);
  const [choice, setChoice] = useState<string | null>(stats.suggested);
  useEffect(() => setChoice(stats.suggested), [stats.suggested]);
  const max = Math.max(1, ...stats.distribution.map((d) => d.count));
  const current = room.stories.find((s) => s.id === room.currentStoryId);
  const names = (ids: string[]) => ids.map((id) => room.participants[id]?.name ?? "someone").join(", ");

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-label="Results">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-bold">Results</h2>
        {stats.consensus ? (
          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">Consensus</span>
        ) : stats.lowVoters.length > 0 ? (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-ink-2">Spread out. Talk it through.</span>
        ) : null}
        {room.previousRounds.length > 0 && <span className="text-xs text-ink-3">Round {room.previousRounds.length + 1}</span>}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Average" value={stats.average ?? "–"} testId="stat-average" />
        <Stat label="Median" value={stats.median ?? "–"} />
        <Stat label="Votes" value={stats.voteCount} />
      </dl>

      <div className="mt-4 space-y-1.5" aria-label="Vote spread">
        {stats.distribution.map((d) => (
          <div key={d.card} className="flex items-center gap-2 text-sm">
            <span className="w-8 text-right font-display font-bold">{d.card}</span>
            <div className="h-5 flex-1 rounded-md bg-surface-2">
              <div className="h-5 rounded-md bg-brand" style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
            <span className="w-6 text-xs text-ink-3">{d.count}</span>
          </div>
        ))}
      </div>

      {stats.lowVoters.length > 0 && (
        <p className="mt-3 text-sm text-ink-2">
          Hear from <b className="text-sky-600 dark:text-sky-300">{names(stats.lowVoters)}</b> (lowest) and{" "}
          <b className="text-amber-600 dark:text-amber-300">{names(stats.highVoters)}</b> (highest) before voting again.
        </p>
      )}

      {canControl && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm font-semibold">Final estimate{current ? ` for “${current.title}”` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cards.map((c) => (
              <button
                key={c}
                onClick={() => setChoice(c)}
                aria-pressed={choice === c}
                className={`min-w-10 rounded-lg border px-2 py-1.5 font-display font-bold ${
                  choice === c ? "border-brand bg-brand text-brand-ink" : "border-line hover:border-brand"
                } ${c === stats.suggested && choice !== c ? "border-brand" : ""}`}
              >
                {c}
              </button>
            ))}
          </div>
          {stats.suggested && <p className="mt-1 text-xs text-ink-3">Suggested: {stats.suggested}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={!choice}
              onClick={() => choice && send({ type: "accept", estimate: choice })}
              className="rounded-xl bg-brand px-4 py-2 font-semibold text-brand-ink hover:opacity-90 disabled:opacity-40"
            >
              Save {choice ?? ""} {room.stories.some((s) => s.status === "pending" && s.id !== room.currentStoryId) ? "and next" : ""}
            </button>
            <button onClick={() => send({ type: "revote" })} className="rounded-xl border border-line px-4 py-2 font-semibold hover:bg-surface-2">
              Vote again
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-display text-2xl font-extrabold" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
