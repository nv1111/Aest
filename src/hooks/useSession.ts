"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services/auth";
import type { MeDTO } from "@/types/models";
import { trackEvent } from "@/lib/analytics";
import { useAppStore } from "@/store/app";
import { errorMessage } from "@/lib/http";
import { toast } from "sonner";

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

/**
 * Sign out and return the app to the onboarding flow.
 *
 * invalidateQueries alone is NOT enough after logout: React Query keeps the
 * last successful data cached when the refetch 401s, so AppShell would keep
 * reading the stale user and stay stuck on the (now erroring) main shell.
 * resetQueries clears the cached user first, then refetches → 401 → the
 * onboarding flow mounts cleanly without needing a page reload.
 */
export function useSignOut() {
  const qc = useQueryClient();
  const resetTab = useAppStore((s) => s.resetTab);
  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: async () => {
      resetTab("home");
      await qc.resetQueries({ queryKey: ["me"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

/** Fires once when the app shell mounts (privacy-conscious analytics). */
export function useAppOpenedTracking() {
  if (typeof window !== "undefined" && !(window as unknown as { __taraOpened?: boolean }).__taraOpened) {
    (window as unknown as { __taraOpened?: boolean }).__taraOpened = true;
    trackEvent("app_opened");
  }
}
