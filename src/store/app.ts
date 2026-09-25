/**
 * App navigation — tab + stack model, client-side (single-route architecture).
 * The registry in components/app/screens.tsx maps ScreenId → component.
 */

import { create } from "zustand";

export type TabId = "home" | "ask" | "astrology" | "astrologers" | "profile";

export interface Screen {
  id: string;
  params?: Record<string, string>;
}

const ROOT: Record<TabId, Screen> = {
  home: { id: "home" },
  ask: { id: "ask" },
  astrology: { id: "astrology.hub" },
  astrologers: { id: "astrologers.list" },
  profile: { id: "profile.home" },
};

interface AppState {
  tab: TabId;
  stacks: Record<TabId, Screen[]>;
  /** navigate to a screen inside the current tab's stack */
  push: (screen: Screen) => void;
  pop: () => void;
  replace: (screen: Screen) => void;
  setTab: (tab: TabId) => void;
  resetTab: (tab: TabId) => void;
  /** cross-tab jump with params (e.g. ask a question about a transit) */
  openInTab: (tab: TabId, screen: Screen) => void;
}

const initialStacks = (): Record<TabId, Screen[]> => ({
  home: [ROOT.home],
  ask: [ROOT.ask],
  astrology: [ROOT.astrology],
  astrologers: [ROOT.astrologers],
  profile: [ROOT.profile],
});

export const useAppStore = create<AppState>((set, get) => ({
  tab: "home",
  stacks: initialStacks(),
  push: (screen) => {
    const { tab, stacks } = get();
    set({ stacks: { ...stacks, [tab]: [...stacks[tab], screen] } });
  },
  pop: () => {
    const { tab, stacks } = get();
    const stack = stacks[tab];
    if (stack.length <= 1) return;
    set({ stacks: { ...stacks, [tab]: stack.slice(0, -1) } });
  },
  replace: (screen) => {
    const { tab, stacks } = get();
    const stack = [...stacks[tab]];
    stack[stack.length - 1] = screen;
    set({ stacks: { ...stacks, [tab]: stack } });
  },
  setTab: (tab) => {
    if (get().tab === tab) {
      // tapping the active tab resets to its root
      set({ tab, stacks: { ...get().stacks, [tab]: [ROOT[tab]] } });
      return;
    }
    set({ tab });
  },
  resetTab: (tab) => set({ tab, stacks: { ...get().stacks, [tab]: [ROOT[tab]] } }),
  openInTab: (tab, screen) => {
    const { stacks } = get();
    set({ tab, stacks: { ...stacks, [tab]: [ROOT[tab], screen] } });
  },
}));

/** Current screen of the active tab. */
export function useCurrentScreen(): Screen {
  const tab = useAppStore((s) => s.tab);
  const stacks = useAppStore((s) => s.stacks);
  return stacks[tab][stacks[tab].length - 1];
}

export function rootScreenOf(tab: TabId): Screen {
  return ROOT[tab];
}
