import { useSyncExternalStore } from "react";
import en, { type Dict } from "./en";
import ru from "./ru";

export type { Dict };

// Новый язык: добавить файл словаря и строку сюда
const dicts = { en, ru } as const;
export type Locale = keyof typeof dicts;
export const LOCALES = Object.keys(dicts) as Locale[];

const LS_KEY = "fd.locale";

function detect(): Locale {
  const saved = localStorage.getItem(LS_KEY);
  if (saved && saved in dicts) return saved as Locale;
  return navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

let locale: Locale = detect();
const listeners = new Set<() => void>();

export function t(key: keyof Dict, vars?: Record<string, string | number>): string {
  const raw = dicts[locale][key] ?? en[key];
  return vars ? raw.replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? "")) : raw;
}

export const getLocale = (): Locale => locale;

export function setLocale(next: Locale): void {
  if (next === locale) return;
  locale = next;
  localStorage.setItem(LS_KEY, next);
  applyToDocument();
  listeners.forEach((fn) => fn());
}

export function applyToDocument(): void {
  document.documentElement.lang = locale;
  document.title = t("appTitle");
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Подписка компонента на смену языка; возвращает текущую локаль */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale);
}
