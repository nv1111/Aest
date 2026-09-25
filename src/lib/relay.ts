import { createHmac } from "crypto";

/**
 * Shared relay helpers (SERVER-ONLY — imports node:crypto).
 *
 * The chat relay is an independent socket.io mini-service on port 3003
 * (mini-services/chat-service). Next.js API routes persist messages in the
 * DB and then fan events out through the relay's internal /emit endpoint.
 * Clients connect via the gateway: io("/?XTransformPort=3003").
 *
 * Ticket auth is stateless: HMAC-SHA256 over `${consultationId}:${userId}`
 * with a shared secret. The exact same formula lives in the relay service.
 */

const RELAY_SECRET = process.env.TARA_RELAY_SECRET || "tara-dev-relay-secret";
const RELAY_INTERNAL_URL = process.env.TARA_RELAY_URL || "http://127.0.0.1:3003";

export function makeRelayTicket(consultationId: string, userId: string): string {
  return createHmac("sha256", RELAY_SECRET).update(`${consultationId}:${userId}`).digest("hex");
}

export function consultationRoom(consultationId: string): string {
  return `c:${consultationId}`;
}

/** Fire-and-forget emit into a relay room. Never throws, never blocks. */
export function relayEmit(room: string, event: string, payload: unknown): void {
  fetch(`${RELAY_INTERNAL_URL}/emit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-relay-secret": RELAY_SECRET },
    body: JSON.stringify({ room, event, payload }),
  }).catch(() => {
    // relay down — messages are already persisted; clients refetch on reconnect
  });
}

/** Relay the persisted message to the consultation room. */
export function relayMessage(consultationId: string, message: unknown): void {
  relayEmit(consultationRoom(consultationId), "consultation:message", { message });
}

/** Relay the astrologer typing indicator. */
export function relayTyping(consultationId: string, isTyping: boolean): void {
  relayEmit(consultationRoom(consultationId), "consultation:typing", {
    userId: "astrologer",
    isTyping,
  });
}

/** Relay that the astrologer read the user's messages (double ticks). */
export function relayAstrologerRead(consultationId: string, readAt: string): void {
  relayEmit(consultationRoom(consultationId), "consultation:read", {
    userId: "astrologer",
    readAt,
  });
}

/** Relay that the consultation ended and was billed. */
export function relayEnded(consultationId: string): void {
  relayEmit(consultationRoom(consultationId), "consultation:ended", { consultationId });
}
