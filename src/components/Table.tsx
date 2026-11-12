import type { RoomView } from "../../shared/protocol";
import { Avatar } from "./Avatar";
import { CardBack, EmptySeat, PlayingCard } from "./PlayingCard";

const GOLD = "#f3d48c";
const MINT = "#9fd3c0";

export function Table({ room, me }: { room: RoomView; me: string }) {
  const people = Object.values(room.participants)
    .filter((p) => room.online.includes(p.id) || p.id in room.votes)
    .sort((a, b) => (a.role === b.role ? a.joinedAt - b.joinedAt : a.role === "voter" ? -1 : 1));
  const voters = people.filter((p) => p.role === "voter");
  const spectators = people.filter((p) => p.role === "spectator");
  const voted = voters.filter((p) => p.id in room.votes).length;
  const low = new Set(room.stats?.lowVoters ?? []);
  const high = new Set(room.stats?.highVoters ?? []);
  const stats = room.revealed ? room.stats : null;
  const waitingOn = voters.filter((p) => !(p.id in room.votes)).map((p) => (p.id === me ? "you" : p.name));

  const status = room.revealed
    ? stats?.consensus
      ? "Everyone agrees!"
      : "Cards are on the table"
    : voters.length === 0
      ? "Waiting for voters to join"
      : voted === voters.length
        ? "Everyone has voted. Ready to reveal."
        : `${voted} of ${voters.length} voted`;

  return (
    <div className="felt relative overflow-hidden rounded-[22px] px-3 py-7 text-[#efe7d6] sm:rounded-[28px] sm:px-8 sm:py-9">
      <ul className="relative flex flex-wrap justify-center gap-x-5 gap-y-7 sm:gap-x-9" aria-label="Table">
        {voters.map((p, i) => {
          const vote = room.votes[p.id];
          const away = !room.online.includes(p.id);
          const tag = low.has(p.id) ? "Lowest" : high.has(p.id) ? "Highest" : null;
          const tilt = ((i % 3) - 1) * 3;
          return (
            <li key={p.id} className="flex w-[84px] flex-col items-center gap-2.5 sm:w-[100px]" data-testid={`seat-${p.name}`}>
              <div className="relative" style={{ transform: `rotate(${tilt}deg)` }}>
                {vote === undefined ? (
                  <EmptySeat label="Not voted yet" />
                ) : !room.revealed ? (
                  <div className="relative -translate-y-1.5 transition">
                    <CardBack label={vote === true ? "Voted" : `Your card: ${vote}`} />
                    {vote !== true && (
                      <span className="absolute -right-2 -bottom-2 grid size-7 place-items-center rounded-full bg-paper font-display text-base text-[#1b1814] shadow">
                        {vote}
                      </span>
                    )}
                  </div>
                ) : (
                  <PlayingCard
                    value={String(vote)}
                    testId="revealed-card"
                    className="flip-in"
                    style={tag ? { outline: `3px solid ${tag === "Highest" ? GOLD : MINT}`, outlineOffset: 4 } : undefined}
                  />
                )}
                {p.id === room.hostId && (
                  <span className="absolute -top-2.5 -left-2.5 rounded-full bg-[#f3d48c] px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-wider text-[#1b1814]" title="Host">
                    HOST
                  </span>
                )}
              </div>
              <span className="flex max-w-full items-center gap-1.5">
                <Avatar name={p.name} color={p.color} size={18} dim={away} />
                <span className={`truncate text-[13px] font-medium ${away ? "opacity-45" : ""}`}>{p.id === me ? "You" : p.name}</span>
              </span>
              {tag && (
                <span className="-mt-1.5 font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: tag === "Highest" ? GOLD : MINT }}>
                  {tag}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center" aria-live="polite">
        {stats && stats.suggested ? (
          <>
            <span className="font-mono text-[11px] tracking-[0.2em] opacity-70 uppercase">{status}</span>
            <span className="font-display text-4xl leading-none" style={{ color: GOLD }}>
              {stats.suggested}
            </span>
            <span className="font-mono text-[11px] tracking-[0.2em] opacity-70 uppercase">
              {stats.average !== null ? `avg ${stats.average} · median ${stats.median}` : "suggested"}
            </span>
          </>
        ) : (
          <>
            <span className="font-display text-2xl">{status}</span>
            {!room.revealed && waitingOn.length > 0 && voted > 0 && (
              <span className="text-sm opacity-70">waiting on {waitingOn.slice(0, 3).join(", ")}{waitingOn.length > 3 ? "…" : ""}</span>
            )}
          </>
        )}
      </div>

      {spectators.length > 0 && (
        <p className="relative mt-4 text-center text-xs opacity-60">
          Watching: {spectators.map((p) => (p.id === me ? "you" : p.name)).join(", ")}
        </p>
      )}
    </div>
  );
}
