"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { consultationsService } from "@/services/consultations";
import type { MessageDTO } from "@/types/models";

/**
 * useConsultationSocket — socket.io connection for a consultation room.
 *
 * Always connects through the gateway: io("/?XTransformPort=3003") — never
 * an absolute URL or a port. Ticket (HMAC) comes from the Next.js API which
 * verifies ownership; the relay verifies the ticket statelessly.
 *
 * Exposes connection status + relays room events to the handlers passed in
 * (handlers are kept in a ref so listeners always see the latest closures).
 */

export type SocketStatus = "connecting" | "connected" | "reconnecting" | "offline";

export interface ConsultationSocketHandlers {
  onMessage?: (message: MessageDTO) => void;
  onTyping?: (isTyping: boolean) => void;
  /** the astrologer read the user's messages (double ticks) */
  onRead?: (readAt: string) => void;
  onEnded?: (consultationId: string) => void;
}

interface RoomMessageEvent {
  message?: MessageDTO;
}
interface RoomTypingEvent {
  consultationId?: string;
  userId?: string;
  isTyping?: boolean;
}
interface RoomReadEvent {
  userId?: string;
  readAt?: string;
}
interface RoomEndedEvent {
  consultationId?: string;
}

export function useConsultationSocket(
  consultationId: string | undefined,
  userId: string | undefined,
  enabled: boolean,
  handlers: ConsultationSocketHandlers
): { status: SocketStatus } {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!consultationId || !userId || !enabled) return;

    let cancelled = false;
    let joinAttempts = 0;

    const socket: Socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    const joinRoom = async () => {
      try {
        const { ticket } = await consultationsService.ticket(consultationId);
        if (cancelled) return;
        socket.emit("join", { consultationId, ticket, userId });
      } catch {
        if (cancelled) return;
        // ticket fetch failed (signed out? network?) — retry after a pause
        setTimeout(() => {
          if (!cancelled) void joinRoom();
        }, 4000);
      }
    };

    const matches = (event: { consultationId?: string }) => event.consultationId === consultationId;

    socket.on("connect", () => {
      setStatus("connecting"); // joined → connected
      joinAttempts = 0;
      void joinRoom();
    });

    socket.on("joined", () => {
      if (!cancelled) setStatus("connected");
    });

    socket.on("join_error", () => {
      if (cancelled) return;
      joinAttempts += 1;
      if (joinAttempts <= 3) {
        setTimeout(() => {
          if (!cancelled) void joinRoom();
        }, 2500);
      } else {
        setStatus("reconnecting");
      }
    });

    socket.on("disconnect", () => {
      if (cancelled) return;
      // socket.active stays true while socket.io is trying to reconnect
      setStatus(socket.active ? "reconnecting" : "offline");
    });

    socket.on("consultation:message", (payload: RoomMessageEvent) => {
      const message = payload?.message;
      if (!message || message.consultationId !== consultationId) return;
      handlersRef.current.onMessage?.(message);
    });

    socket.on("consultation:typing", (payload: RoomTypingEvent) => {
      if (!matches(payload) || payload.userId !== "astrologer") return;
      handlersRef.current.onTyping?.(payload.isTyping === true);
    });

    socket.on("consultation:read", (payload: RoomReadEvent) => {
      if (payload?.userId !== "astrologer" || typeof payload.readAt !== "string") return;
      handlersRef.current.onRead?.(payload.readAt);
    });

    socket.on("consultation:ended", (payload: RoomEndedEvent) => {
      if (!matches(payload)) return;
      handlersRef.current.onEnded?.(consultationId);
    });

    return () => {
      cancelled = true;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [consultationId, userId, enabled]);

  return { status };
}
