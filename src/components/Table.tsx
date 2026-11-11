import type { RoomView } from "../../shared/protocol";
import { Avatar } from "./Avatar";

export function Table({ room, me }: { room: RoomView; me: string }) {
  const people = Object.values(room.participants)
    .filter((p) => room.online.includes(p.id) || p.id in room.votes)
    .sort((a, b) => (a.role === b.role ? a.joinedAt - b.joinedAt : a.role === "voter" ? -1 : 1));
  const voters = people.filter((p) => p.role === "voter");
  const voted = voters.filter((p) => p.id in room.votes).length;
  const low = new Set(room.stats?.lowVoters ?? []);
  const high = new Set(room.stats?.highVoters ?? []);

  return (
    <div className="felt relative rounded-[1.75rem] px-3 py-6 shadow-inner sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute inset-2 rounded-[1.4rem] border border-white/10" />
      <p className="relative mb-5 text-center text-sm font-medium text-white/80" aria-live="polite">
        {room.revealed
          ? room.stats?.consensus
            ? "Everyone agrees!"
            : "Cards are on the table"
          : voters.length === 0
            ? "Waiting for voters to join"
            : voted === voters.length
              ? "Everyone has voted. Ready to reveal."
              : `${voted} of ${voters.length} voted`}
      </p>
      <ul className="relative flex flex-wrap justify-center gap-x-4 gap-y-5">
        {people.map((p) => {
          const vote = room.votes[p.id];
          const away = !room.online.includes(p.id);
          const tag = low.has(p.id) ? "Lowest" : high.has(p.id) ? "Highest" : null;
          return (
            <li key={p.id} className="flex w-16 flex-col items-center gap-1.5 sm:w-20" data-testid={`seat-${p.name}`}>
              <div className="relative">
                {p.role === "spectator" ? (
                  <div className="grid h-20 w-14 place-items-center rounded-xl border border-white/15 text-xl text-white/60 sm:h-24 sm:w-16" title="Spectator">
                    👀
                  </div>
                ) : vote === undefined ? (
                  <div className="h-20 w-14 rounded-xl border-2 border-dashed border-white/25 sm:h-24 sm:w-16" aria-label="Not voted yet" />
                ) : !room.revealed ? (
                  <div
                    className="card-back grid h-20 w-14 -translate-y-1 place-items-end justify-center rounded-xl border-2 border-white/80 pb-1 shadow-lg sm:h-24 sm:w-16"
                    aria-label={vote === true ? "Voted" : `Your card: ${vote}`}
                  >
                    {vote !== true && <span className="rounded bg-white/90 px-1.5 text-xs font-bold text-stone-900">{vote}</span>}
                  </div>
                ) : (
                  <div
                    data-testid="revealed-card"
                    className={`flip-in grid h-20 w-14 place-items-center rounded-xl bg-white font-display text-2xl font-extrabold text-stone-900 shadow-lg sm:h-24 sm:w-16 ${
                      tag === "Lowest" ? "ring-4 ring-sky-400" : tag === "Highest" ? "ring-4 ring-amber-400" : ""
                    }`}
                  >
                    {vote}
                  </div>
                )}
                {p.id === room.hostId && (
                  <span className="absolute -top-2 -right-2 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-stone-900" title="Host">
                    HOST
                  </span>
                )}
              </div>
              <span className="flex max-w-full items-center gap-1">
                <Avatar name={p.name} color={p.color} size={18} dim={away} />
                <span className={`truncate text-xs font-medium ${away ? "text-white/45" : "text-white"}`}>
                  {p.id === me ? "You" : p.name}
                </span>
              </span>
              {tag && <span className={`text-[10px] font-semibold ${tag === "Lowest" ? "text-sky-300" : "text-amber-300"}`}>{tag}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
