import { DurableObject } from "cloudflare:workers";
import type { ClientMessage, RoomState, ServerMessage } from "../shared/protocol";
import type { Env } from "./index";
import { applyMessage, createRoom, handleDisconnect, toView } from "../shared/room";

/** Rooms nobody has touched for this long are deleted. */
const EXPIRY_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_MESSAGE_BYTES = 64 * 1024;
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;

interface Attachment {
  pid: string | null;
}

/**
 * One Durable Object per room. It holds the room state, accepts the room's
 * WebSockets (with hibernation, so idle rooms cost nothing) and broadcasts
 * every change to everyone in the room.
 */
export class Room extends DurableObject<Env> {
  private state: RoomState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<RoomState>("state")) ?? null;
    });
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    const roomId = new URL(request.url).searchParams.get("room") ?? "room";
    if (!this.state) this.state = createRoom(roomId, Date.now());

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ pid: null } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== "string" || data.length > MAX_MESSAGE_BYTES) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
    const state = this.state ?? (this.state = createRoom("room", Date.now()));

    const attachment = ws.deserializeAttachment() as Attachment;
    let actor = attachment.pid;
    if (msg.type === "join") {
      if (typeof msg.id !== "string" || !CLIENT_ID.test(msg.id)) {
        return this.send(ws, { type: "error", message: "Invalid client id." });
      }
      actor = msg.id;
      ws.serializeAttachment({ pid: actor } satisfies Attachment);
    }
    if (!actor) return this.send(ws, { type: "error", message: "Join the room first." });

    const now = Date.now();
    const result = applyMessage(state, actor, msg, now, this.onlineIds());
    if (result.error) this.send(ws, { type: "error", message: result.error });
    if (result.reaction) this.broadcast({ type: "reaction", ...result.reaction });
    if (result.kicked) {
      for (const socket of this.ctx.getWebSockets()) {
        const a = socket.deserializeAttachment() as Attachment;
        if (a.pid === result.kicked) {
          this.send(socket, { type: "kicked" });
          socket.serializeAttachment({ pid: null } satisfies Attachment);
          socket.close(4001, "Removed by host");
        }
      }
    }
    if (result.changed) {
      await this.save();
      this.broadcastState();
    } else if (msg.type === "join") {
      this.broadcastState();
    }
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    ws.serializeAttachment({ pid: null } satisfies Attachment);
    try {
      ws.close(code === 1005 ? 1000 : code, "closing");
    } catch {
      // Already closed.
    }
    await this.onDisconnect();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    ws.serializeAttachment({ pid: null } satisfies Attachment);
    await this.onDisconnect();
  }

  async alarm(): Promise<void> {
    const state = this.state;
    if (!state) return;
    if (Date.now() - state.updatedAt >= EXPIRY_MS && this.ctx.getWebSockets().length === 0) {
      this.state = null;
      await this.ctx.storage.deleteAll();
    } else {
      await this.ctx.storage.setAlarm(state.updatedAt + EXPIRY_MS);
    }
  }

  private async onDisconnect() {
    if (!this.state) return;
    if (handleDisconnect(this.state, this.onlineIds(), Date.now())) await this.save();
    this.broadcastState();
  }

  private onlineIds(): Set<string> {
    const ids = new Set<string>();
    for (const socket of this.ctx.getWebSockets()) {
      const a = socket.deserializeAttachment() as Attachment | null;
      if (a?.pid && socket.readyState === WebSocket.OPEN) ids.add(a.pid);
    }
    return ids;
  }

  private async save() {
    if (!this.state) return;
    await this.ctx.storage.put("state", this.state);
    await this.ctx.storage.setAlarm(this.state.updatedAt + EXPIRY_MS);
  }

  private broadcastState() {
    if (!this.state) return;
    const online = this.onlineIds();
    const now = Date.now();
    for (const socket of this.ctx.getWebSockets()) {
      const a = socket.deserializeAttachment() as Attachment | null;
      if (a?.pid) this.send(socket, { type: "state", room: toView(this.state, online, now, a.pid), you: a.pid });
    }
  }

  private broadcast(msg: ServerMessage) {
    for (const socket of this.ctx.getWebSockets()) {
      const a = socket.deserializeAttachment() as Attachment | null;
      if (a?.pid) this.send(socket, msg);
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Socket went away; the close handler will clean up.
    }
  }
}
