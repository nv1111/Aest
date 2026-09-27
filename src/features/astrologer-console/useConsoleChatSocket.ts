"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { astrologerConsoleService } from "@/services/console";
import type { MessageDTO } from "@/types/models";

/**
 * useConsoleChatSocket — astrologer-console twin of useConsultationSocket.
 *
 * Same wire contract: io("/?XTransformPort=3003") through the gateway, HMAC
 * ticket fetched from the CONSOLE API (astrologerConsoleService.ticket), join
 * with the console user's OWN userId (so the customer's hook — which filters
 * only its own id — treats this socket as "the astrologer").
 *
 * Differences from the customer hook:
 * - typing filter: only the CUSTOMER's typing is surfaced (events carrying any
 *   userId that isn't mine — never my own echoes).
 * - exposes sendTyping(isTyping) so the console composer can broadcast typing
 *   to the room (the relay fans it out; the customer hook renders it).
 */

export type ConsoleSocketStatus = "connecting" | "connected" | "reconnecting" | "offline";

export interface ConsoleChatSocketHandlers {
  onMessage?: (message: MessageDTO) => void;
  onTyping?: (isTyping: boolean) => void;
  /** the customer read the console astrologer's messages (double ticks) */
  onRead?: (readAt: string) => void;
  onEnded?: (consultationId: string) => void;
  /** status transitions: requested → active / cancelled / ended */
  onStatus?: (status: string) => void;
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
interface RoomStatusEvent {
  consultationId?: string;
  status?: string;
}

export function useConsoleChatSocket(
  consultationId: string | undefined,
  userId: string | undefined,
  enabled: boolean,
  handlers: ConsoleChatSocketHandlers
): { status: ConsoleSocketStatus; sendTyping: (isTyping: boolean) => void } {
  const [status, setStatus] = useState<ConsoleSocketStatus>("connecting");
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const socketRef = useRef<Socket | null>(null);
  const ticketRef = useRef<string | null>(null);

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
    socketRef.current = socket;

    const joinRoom = async () => {
      try {
        const { ticket } = await astrologerConsoleService.ticket(consultationId);
        if (cancelled) return;
        ticketRef.current = ticket;
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
      // only the OTHER party's typing: the customer. Never my own echoes.
      if (!matches(payload) || !payload.userId || payload.userId === userId) return;
      handlersRef.current.onTyping?.(payload.isTyping === true);
    });

    socket.on("consultation:read", (payload: RoomReadEvent) => {
      if (!payload.userId || payload.userId === userId) return;
      if (typeof payload.readAt !== "string") return;
      handlersRef.current.onRead?.(payload.readAt);
    });

    socket.on("consultation:ended", (payload: RoomEndedEvent) => {
      if (!matches(payload)) return;
      handlersRef.current.onEnded?.(consultationId);
    });

    socket.on("consultation:status", (payload: RoomStatusEvent) => {
      if (!matches(payload) || typeof payload.status !== "string") return;
      handlersRef.current.onStatus?.(payload.status);
    });

    return () => {
      cancelled = true;
      socketRef.current = null;
      ticketRef.current = null;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [consultationId, userId, enabled]);

  /** Broadcast typing state to the room (debounce/timeout is the caller's job). */
  const sendTyping = useCallback((isTyping: boolean) => {
    const socket = socketRef.current;
    const ticket = ticketRef.current;
    if (!socket || !ticket || !consultationId || !userId) return;
    socket.emit("typing", { consultationId, ticket, userId, isTyping });
  }, [consultationId, userId]);

  return { status, sendTyping };
}
