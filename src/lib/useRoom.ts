import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, RoomView, ServerMessage } from "../../shared/protocol";
import { clientId, type Profile } from "./identity";

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "kicked";

export interface FloatingReaction {
  key: number;
  from: string;
  emoji: string;
  left: number;
}

export interface Toast {
  key: number;
  text: string;
}

/**
 * Connects to a room over WebSocket, joins with the given profile and keeps
 * the latest room state. Reconnects with backoff when the connection drops.
 */
export function useRoom(roomId: string, profile: Profile | null) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [clockOffset, setClockOffset] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const me = clientId();

  const toast = useCallback((text: string) => {
    const key = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { key, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.key !== key)), 4000);
  }, []);

  useEffect(() => {
    if (!profile) return;
    let stopped = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/api/rooms/${encodeURIComponent(roomId)}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        const p = profileRef.current!;
        ws.send(JSON.stringify({ type: "join", id: me, name: p.name, color: p.color, role: p.role } satisfies ClientMessage));
        pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send("ping"), 25_000);
      };

      ws.onmessage = (event) => {
        if (event.data === "pong") return;
        const msg = JSON.parse(event.data) as ServerMessage;
        if (msg.type === "state") {
          setRoom(msg.room);
          setClockOffset(msg.room.serverNow - Date.now());
          setStatus("open");
        } else if (msg.type === "error") {
          toast(msg.message);
        } else if (msg.type === "reaction") {
          const key = Date.now() + Math.random();
          setReactions((r) => [...r.slice(-20), { key, from: msg.from, emoji: msg.emoji, left: 10 + Math.random() * 80 }]);
          setTimeout(() => setReactions((r) => r.filter((x) => x.key !== key)), 2300);
        } else if (msg.type === "kicked") {
          stopped = true;
          setStatus("kicked");
        }
      };

      ws.onclose = () => {
        clearInterval(pingTimer);
        if (stopped) return;
        setStatus("reconnecting");
        const delay = Math.min(10_000, 500 * 2 ** attempt++) + Math.random() * 300;
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
    // Reconnect only when the room changes or the user first picks a profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, !!profile, me, toast]);

  const send = useCallback(
    (msg: ClientMessage) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      else toast("Reconnecting… try again in a moment.");
    },
    [toast],
  );

  return { room, status, send, me, reactions, toasts, toast, clockOffset };
}
