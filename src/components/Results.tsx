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
  const hasNext = room.stories.some((s) => s.status === "pending" && s.id !== room.currentStoryId);
  const names = (ids: string[]) => ids.map((id) => room.participants[id]?.name ?? "someone").join(", ");

  return (
    <section className="grid overflow-hidden rounded-[22px] border border-line bg-surface md:grid-cols-[1fr_1.15fr]" aria-label="Results">
      <div className="border-line p-5 md:border-r sm:p-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-3xl leading-none">The spread</h2>
          {stats.consensus ? (
            <span className="eyebrow !text-brand">Consensus</span>
          ) : stats.lowVoters.length > 0 ? (
            <span className="eyebrow">Spread out · talk it through</span>
          ) : null}
        </div>
        <dl className="mt-4 grid grid-cols-3 border-y border-line">
          <Stat label="Average" value={stats.average ?? "–"} testId="stat-average" />
          <Stat label="Median" value={stats.median ?? "–"} />
          <Stat label={room.previousRounds.length ? `Votes · R${room.previousRounds.length + 1}` : "Votes"} value={stats.voteCount} />
        </dl>
        <div className="mt-4 space-y-2" aria-label="Vote spread">
          {stats.distribution.map((d) => (
            <div key={d.card} className="flex items-center gap-3">
              <span className="w-8 text-right font-display text-2xl leading-none">{d.card}</span>
              <div className="h-2 flex-1 rounded-full bg-surface-2">
                <div className="h-2 rounded-full bg-brand" style={{ width: `${(d.count / max) * 100}%` }} />
              </div>
              <span className="w-5 font-mono text-xs text-ink-3">{d.count}</span>
            </div>
          ))}
        </div>
        {stats.lowVoters.length > 0 && (
          <p className="mt-4 text-sm leading-relaxed text-ink-2">
            Hear from <b className="font-semibold text-ink underline decoration-[#9fd3c0] decoration-2 underline-offset-4">{names(stats.lowVoters)}</b> (lowest) and{" "}
            <b className="font-semibold text-ink underline decoration-[#e2b45c] decoration-2 underline-offset-4">{names(stats.highVoters)}</b> (highest) before voting
            again.
          </p>
        )}
      </div>

      {canControl ? (
        <div className="bg-surface-2/50 p-5 sm:p-6">
          <h2 className="font-display text-3xl leading-none">The verdict</h2>
          <p className="mt-1 truncate text-sm text-ink-2">{current ? `for “${current.title}”` : "for this quick round"}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {cards.map((c) => (
              <button
                key={c}
                onClick={() => setChoice(c)}
                aria-pressed={choice === c}
                className={`min-w-11 rounded-lg border px-2 py-1.5 font-display text-2xl leading-none transition ${
                  choice === c
                    ? "border-ink bg-ink text-bg"
                    : c === stats.suggested
                      ? "border-brand text-brand"
                      : "border-line bg-surface hover:border-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {stats.suggested && <p className="mt-2 eyebrow !text-[10px]">Suggested: {stats.suggested}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              disabled={!choice}
              onClick={() => choice && send({ type: "accept", estimate: choice })}
              className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              Save {choice ?? ""} {hasNext ? "and deal next" : ""}
            </button>
            <button onClick={() => send({ type: "revote" })} className="rounded-full border-[1.5px] border-ink px-5 py-2.5 font-semibold hover:bg-ink hover:text-bg">
              Vote again
            </button>
          </div>
        </div>
      ) : (
        <div className="grid place-items-center bg-surface-2/50 p-6 text-center text-sm text-ink-2">The host will record the estimate.</div>
      )}
    </section>
  );
}

function Stat({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <div className="border-line py-3 not-first:border-l not-first:pl-4">
      <dt className="eyebrow !text-[10px]">{label}</dt>
      <dd className="mt-1 font-display text-4xl leading-none" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
