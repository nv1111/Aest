/**
 * i18n architecture. English ships today; dictionaries are per-feature so
 * feature agents own their strings. t("home.greeting") resolves across the
 * merged dictionary. Adding a language = adding a folder + locale switch.
 */

import common from "./en/common";
import nav from "./en/nav";
import onboarding from "./en/onboarding";
import home from "./en/home";
import ask from "./en/ask";
import astrology from "./en/astrology";
import astrologers from "./en/astrologers";
import consultation from "./en/consultation";
import wallet from "./en/wallet";
import reports from "./en/reports";
import profile from "./en/profile";

export type Locale = "en";
export const LOCALES: { code: Locale; label: string }[] = [{ code: "en", label: "English" }];

const dictionaries: Record<Locale, Record<string, unknown>> = {
  en: {
    common,
    nav,
    onboarding,
    home,
    ask,
    astrology,
    astrologers,
    consultation,
    wallet,
    reports,
    profile,
  },
};

let currentLocale: Locale = "en";

export function setLocale(locale: Locale) {
  if (dictionaries[locale]) currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

/** t("home.greeting") → string; falls back to the key path if missing. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = dictionaries[currentLocale];
  const parts = key.split(".");
  let node: unknown = dict;
  for (const p of parts) {
    if (typeof node !== "object" || node === null) return key;
    node = (node as Record<string, unknown>)[p];
  }
  let result = typeof node === "string" ? node : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return result;
}
