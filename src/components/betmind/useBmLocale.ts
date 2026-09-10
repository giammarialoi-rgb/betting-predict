"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_BM_LOCALE,
  getBmMessages,
  resolveBmLocale,
  type BmLocale,
  type BmMessages,
} from "@/components/betmind/i18n";

export function useBmLocale(): { locale: BmLocale; t: BmMessages; setLocale: (l: BmLocale) => void } {
  const [locale, setLocaleState] = useState<BmLocale>(() =>
    typeof window === "undefined" ? DEFAULT_BM_LOCALE : resolveBmLocale(),
  );

  const setLocale = (l: BmLocale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem("bm_locale", l);
    } catch {
      /* ignore */
    }
  };

  const t = useMemo(() => getBmMessages(locale), [locale]);
  return { locale, t, setLocale };
}
