"use client";

import { useMemo, useState, useEffect } from "react";
import {
  DEFAULT_BM_LOCALE,
  getBmMessages,
  resolveBmLocale,
  type BmLocale,
  type BmMessages,
} from "@/components/betmind/i18n";

export function useBmLocale(): { locale: BmLocale; t: BmMessages; setLocale: (l: BmLocale) => void } {
  const [locale, setLocaleState] = useState<BmLocale>(DEFAULT_BM_LOCALE);

  useEffect(() => {
    setLocaleState(resolveBmLocale());
  }, []);

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
