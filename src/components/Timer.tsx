import { useEffect, useState } from "react";
import type { ClientMessage, RoomView } from "../../shared/protocol";

export function Timer({ room, offset, canControl, send }: { room: RoomView; offset: number; canControl: boolean; send: (m: ClientMessage) => void }) {
  const endsAt = room.timer.endsAt;
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(t);
  }, [endsAt, offset]);

  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : room.settings.timerSeconds;
  const done = endsAt !== null && remaining === 0;
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`rounded-lg px-2 py-1 font-mono text-sm font-semibold tabular-nums ${
          done ? "bg-danger text-white" : endsAt ? "bg-accent-soft text-ink" : "text-ink-3"
        }`}
        aria-live={done ? "assertive" : "off"}
        title="Timer"
      >
        ⏱ {done ? "Time's up" : `${mm}:${ss}`}
      </span>
      {canControl && (
        <button
          onClick={() => send({ type: "timer", action: endsAt && !done ? "stop" : "start" })}
          className="rounded-lg border border-line px-2 py-1 text-xs font-semibold hover:bg-surface-2"
        >
          {endsAt && !done ? "Stop" : done ? "Restart" : "Start"}
        </button>
      )}
    </div>
  );
}
