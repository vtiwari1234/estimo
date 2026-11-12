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
    <div className="text-right">
      <p className="eyebrow">Timer</p>
      <div className="flex items-baseline justify-end gap-3">
        {canControl && (
          <button
            onClick={() => send({ type: "timer", action: endsAt && !done ? "stop" : "start" })}
            className="font-mono text-[11px] tracking-wider text-ink-2 uppercase underline-offset-4 hover:underline"
          >
            {endsAt && !done ? "Stop" : done ? "Restart" : "Start"}
          </button>
        )}
        <span
          className={`font-display text-[44px] leading-none tabular-nums sm:text-[54px] ${done ? "animate-pulse text-brand" : endsAt ? "text-brand" : "text-ink-3"}`}
          aria-live={done ? "assertive" : "off"}
          title="Timer"
        >
          {done ? "Time!" : `${mm}:${ss}`}
        </span>
      </div>
    </div>
  );
}
