"use client";

/**
 * Locale store — language choice persists in localStorage and switching it
 * re-renders the app (AppShell subscribes; screens read t() at render time).
 * Kept separate from the nav store so navigation state survives a language
 * switch without any coupling.
 */

import { create } from "zustand";
import { setLocale, getLocale, type Locale } from "@/i18n";

const STORAGE_KEY = "tara.locale";

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "hi") return stored;
  } catch {
    // private mode / storage blocked — default is fine
  }
  return "en";
}

interface LocaleState {
  locale: Locale;
  /** Switch language; persists and re-renders subscribers. */
  changeLocale: (locale: Locale) => void;
}

const initialLocale = readStoredLocale();
// The i18n module holds its own mutable locale — keep both in sync from boot.
setLocale(initialLocale);
if (typeof document !== "undefined") document.documentElement.lang = initialLocale;

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: initialLocale,
  changeLocale: (locale) => {
    setLocale(locale);
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
      document.documentElement.lang = locale;
    } catch {
      // storage blocked — switch still works for this session
    }
    set({ locale });
  },
}));
