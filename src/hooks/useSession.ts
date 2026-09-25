"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services/auth";
import type { MeDTO } from "@/types/models";
import { trackEvent } from "@/lib/analytics";

/** Session state via TanStack Query — single source of truth for /me. */
export function useMe() {
  return useQuery<MeDTO>({
    queryKey: ["me"],
    queryFn: authService.me,
    staleTime: 15_000,
    retry: false,
  });
}

export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}

/** Fires once when the app shell mounts (privacy-conscious analytics). */
export function useAppOpenedTracking() {
  if (typeof window !== "undefined" && !(window as unknown as { __taraOpened?: boolean }).__taraOpened) {
    (window as unknown as { __taraOpened?: boolean }).__taraOpened = true;
    trackEvent("app_opened");
  }
}
