"use client";

import { useMe } from "@/hooks/useSession";
import { useCurrentScreen } from "@/store/app";

/**
 * Resolves the profile a screen should read: an explicit `profileId` param
 * (deep links / cross-links) wins, otherwise the user's primary profile.
 */
export function useActiveProfileId(): { profileId: string | undefined; ready: boolean } {
  const me = useMe();
  const screen = useCurrentScreen();
  const pid = screen.params?.profileId ?? me.data?.primaryProfile?.id;
  return { profileId: pid, ready: !me.isLoading };
}
