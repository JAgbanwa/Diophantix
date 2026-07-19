"use client";

import { useCallback, useEffect, useState } from "react";
import { I18N } from "@/lib/i18n-translations";

export type LangCode = keyof typeof I18N;

export const LANG_OPTIONS: { code: LangCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ak", label: "Twi" },
  { code: "sw", label: "Kiswahili" },
  { code: "yo", label: "Yorùbá" },
  { code: "ig", label: "Igbo" },
  { code: "ha", label: "Hausa" },
  { code: "ga", label: "Ga" },
  { code: "ar", label: "العربية" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "fa", label: "فارسی" },
];

const STORAGE_KEY = "ecs-lang";

function isLangCode(v: string): v is LangCode {
  return v in I18N;
}

export function useI18n() {
  const [lang, setLangState] = useState<LangCode>("en");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const stored = localStorage.getItem(STORAGE_KEY) || "en";
      if (isLangCode(stored)) setLangState(stored);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" || lang === "fa" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((code: LangCode) => {
    if (!I18N[code]) return;
    setLangState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const t = useCallback(
    (key: string) => (I18N[lang] || I18N.en)[key] || I18N.en[key] || key,
    [lang],
  );

  return { lang, setLang, t };
}
