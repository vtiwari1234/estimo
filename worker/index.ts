import { ROOM_ID_PATTERN } from "../shared/protocol";
import { createCheckout, handleWebhook } from "./billing";

export { Room } from "./room";

export interface Env {
  ROOMS: DurableObjectNamespace;
  ASSETS: Fetcher;
  /** "pro" on the paid site; unset on the free site. */
  EDITION?: string;
  LS_API_KEY?: string;
  LS_WEBHOOK_SECRET?: string;
  LS_STORE_ID?: string;
  LS_VARIANT_MONTHLY?: string;
  LS_VARIANT_YEARLY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
    if (match) {
      const roomId = decodeURIComponent(match[1]).toLowerCase();
      if (!ROOM_ID_PATTERN.test(roomId)) return new Response("Invalid room name", { status: 400 });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(roomId));
      const forward = new URL(request.url);
      forward.searchParams.set("room", roomId);
      return stub.fetch(new Request(forward, request));
    }
    if (url.pathname === "/api/billing/checkout" && request.method === "POST") return createCheckout(request, env);
    if (url.pathname === "/api/billing/webhook" && request.method === "POST") return handleWebhook(request, env);
    if (url.pathname === "/api/health") return Response.json({ ok: true });
    if (url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
