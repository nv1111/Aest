/**
 * i18n architecture. English + Hindi ship today; dictionaries are per-feature
 * so feature agents own their strings. t("home.greeting") resolves across the
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

import hiCommon from "./hi/common";
import hiNav from "./hi/nav";
import hiOnboarding from "./hi/onboarding";
import hiHome from "./hi/home";
import hiAsk from "./hi/ask";
import hiAstrology from "./hi/astrology";
import hiAstrologers from "./hi/astrologers";
import hiConsultation from "./hi/consultation";
import hiWallet from "./hi/wallet";
import hiReports from "./hi/reports";
import hiProfile from "./hi/profile";

export type Locale = "en" | "hi";
export const LOCALES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
];

const en: Record<string, unknown> = {
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
};

const hi: Record<string, unknown> = {
  common: hiCommon,
  nav: hiNav,
  onboarding: hiOnboarding,
  home: hiHome,
  ask: hiAsk,
  astrology: hiAstrology,
  astrologers: hiAstrologers,
  consultation: hiConsultation,
  wallet: hiWallet,
  reports: hiReports,
  profile: hiProfile,
};

const dictionaries: Record<Locale, Record<string, unknown>> = { en, hi };

let currentLocale: Locale = "en";

export function setLocale(locale: Locale) {
  if (dictionaries[locale]) currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

/** t("home.greeting") → string; falls back to English, then to the key path. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const parts = key.split(".");

  const lookup = (dict: Record<string, unknown>): unknown => {
    let node: unknown = dict;
    for (const p of parts) {
      if (typeof node !== "object" || node === null) return undefined;
      node = (node as Record<string, unknown>)[p];
    }
    return node;
  };

  let node = lookup(dictionaries[currentLocale]);
  if (typeof node !== "string" && currentLocale !== "en") {
    // missing key in the active locale → fall back to English
    node = lookup(en);
  }

  let result = typeof node === "string" ? node : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return result;
}
