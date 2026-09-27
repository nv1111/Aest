/**
 * Console navigation — Phase 2 role-switch demo.
 *
 * Self-contained stack model for the astrologer + admin consoles. The
 * customer app keeps its own store (store/app.ts); consoles never touch it,
 * so switching personas never corrupts customer navigation state.
 */

import { create } from "zustand";

export type ConsolePersona = "astrologer" | "admin";

// astrologer console tabs → root screens
export type AstrologerTab = "dashboard" | "chats" | "reviews";
// admin console tabs → root screens
export type AdminTab = "dashboard" | "astrologers" | "consultations" | "support";

export interface ConsoleScreen {
  id: string;
  params?: Record<string, string>;
}

const AST_ROOT: Record<AstrologerTab, ConsoleScreen> = {
  dashboard: { id: "ast.dashboard" },
  chats: { id: "ast.chats" },
  reviews: { id: "ast.reviews" },
};

const ADMIN_ROOT: Record<AdminTab, ConsoleScreen> = {
  dashboard: { id: "admin.dashboard" },
  astrologers: { id: "admin.astrologers" },
  consultations: { id: "admin.consultations" },
  support: { id: "admin.support" },
};

interface ConsoleState {
  persona: ConsolePersona;
  tab: string;
  stacks: Record<string, ConsoleScreen[]>;
  setPersona: (p: ConsolePersona) => void;
  setTab: (tab: string) => void;
  push: (screen: ConsoleScreen) => void;
  pop: () => void;
  reset: () => void;
}

function freshStacks(persona: ConsolePersona): Record<string, ConsoleScreen[]> {
  if (persona === "astrologer") {
    return {
      dashboard: [AST_ROOT.dashboard],
      chats: [AST_ROOT.chats],
      reviews: [AST_ROOT.reviews],
    };
  }
  return {
    dashboard: [ADMIN_ROOT.dashboard],
    astrologers: [ADMIN_ROOT.astrologers],
    consultations: [ADMIN_ROOT.consultations],
    support: [ADMIN_ROOT.support],
  };
}

export const useConsoleStore = create<ConsoleState>((set, get) => ({
  persona: "astrologer",
  tab: "dashboard",
  stacks: freshStacks("astrologer"),

  setPersona: (persona) => set({ persona, tab: "dashboard", stacks: freshStacks(persona) }),

  setTab: (tab) => {
    const { stacks } = get();
    if (get().tab === tab) {
      // tapping the active tab resets to its root
      const root = stacks[tab]?.[0];
      set({ tab, stacks: { ...stacks, [tab]: root ? [root] : [AST_ROOT.dashboard] } });
      return;
    }
    set({ tab });
  },

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

  reset: () => set({ stacks: freshStacks(get().persona) }),
}));

/** Current screen of the console's active tab. */
export function useCurrentConsoleScreen(): ConsoleScreen {
  const tab = useConsoleStore((s) => s.tab);
  const stacks = useConsoleStore((s) => s.stacks);
  return stacks[tab][stacks[tab].length - 1];
}
