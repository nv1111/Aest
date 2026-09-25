/**
 * Tara chat relay — socket.io mini-service (port 3003).
 *
 * Stateless relay ONLY: message persistence lives in the Next.js API routes;
 * this service just verifies HMAC tickets and fans events out to rooms.
 *
 * Client contract (browser, via Caddy gateway):
 *   io("/?XTransformPort=3003", { transports: ["websocket", "polling"], ... })
 *
 * Events IN (from clients):
 *   - "join"    { consultationId, ticket, userId }  → socket joins room c:{id}, ack "joined"
 *   - "typing"  { consultationId, ticket, userId, isTyping } → broadcast to room
 *
 * Internal HTTP (from Next.js API routes, 127.0.0.1 only):
 *   POST /emit  headers: { x-relay-secret }  body: { room, event, payload }
 *   GET  /      → engine.io answers (proves the port is up)
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { createHmac } from "crypto";
import { Server, type Socket } from "socket.io";

const PORT = 3003;
const RELAY_SECRET = process.env.TARA_RELAY_SECRET || "tara-dev-relay-secret";

interface JoinPayload {
  consultationId?: unknown;
  ticket?: unknown;
  userId?: unknown;
}

interface TypingPayload extends JoinPayload {
  isTyping?: unknown;
}

interface EmitBody {
  room?: unknown;
  event?: unknown;
  payload?: unknown;
}

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Stateless HMAC ticket — identical formula to src/lib/relay.ts in the app. */
function makeTicket(consultationId: string, userId: string): string {
  return createHmac("sha256", RELAY_SECRET).update(`${consultationId}:${userId}`).digest("hex");
}

function ticketValid(consultationId: string, userId: string, ticket: string): boolean {
  const expected = makeTicket(consultationId, userId);
  const a = Buffer.from(ticket);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return a.equals(b);
}

// ------------------------------------------------------------- internal /emit

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => {
      raw += chunk.toString();
      if (raw.length > limit) {
        req.destroy();
        reject(new Error("body_too_large"));
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

// ------------------------------------------------------------------ http + io

const httpServer = createServer();

const io = new Server(httpServer, {
  // DO NOT change the path — Caddy forwards /?XTransformPort=3003 by path.
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket: Socket) => {
  socket.on("join", (data: JoinPayload) => {
    const consultationId = asString(data.consultationId);
    const userId = asString(data.userId);
    const ticket = asString(data.ticket);
    if (!consultationId || !userId || !ticket || !ticketValid(consultationId, userId, ticket)) {
      socket.emit("join_error", { error: "invalid_ticket" });
      return;
    }
    const room = `c:${consultationId}`;
    void socket.join(room);
    socket.emit("joined", { consultationId });
    console.log(`[relay] user ${userId.slice(0, 8)}… joined ${room}`);
  });

  socket.on("typing", (data: TypingPayload) => {
    const consultationId = asString(data.consultationId);
    const userId = asString(data.userId);
    const ticket = asString(data.ticket);
    if (!consultationId || !userId || !ticket || !ticketValid(consultationId, userId, ticket)) return;
    io.to(`c:${consultationId}`).emit("consultation:typing", {
      consultationId,
      userId,
      isTyping: data.isTyping === true,
    });
  });

  socket.on("disconnect", () => {
    // rooms are cleaned up automatically by socket.io
  });
});

// engine.io (path "/") claims every request, so POST /emit must be peeled off
// in front of it: capture engine.io's listener, then intercept /emit first.
const engineHandlers = httpServer.listeners("request").slice(0) as RequestHandler[];
httpServer.removeAllListeners("request");
httpServer.on("request", (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === "POST" && req.url === "/emit") {
    const secret = req.headers["x-relay-secret"];
    if (secret !== RELAY_SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "bad_secret" }));
      return;
    }
    readBody(req, 1_000_000)
      .then((raw) => {
        let body: EmitBody;
        try {
          body = JSON.parse(raw) as EmitBody;
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "bad_json" }));
          return;
        }
        const room = asString(body.room);
        const event = asString(body.event);
        if (!room || !event) {
          res.writeHead(422, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "room_and_event_required" }));
          return;
        }
        io.to(room).emit(event, body.payload ?? {});
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      })
      .catch(() => {
        if (!res.headersSent) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "body_too_large" }));
        }
      });
    return; // engine.io never sees /emit
  }
  for (const h of engineHandlers) h(req, res);
});

httpServer.listen(PORT, () => {
  console.log(`Tara chat relay listening on port ${PORT}`);
});
