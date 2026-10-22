import { zhCN } from "./zh-CN";

export type UiLanguage = "zh-CN" | "en";
const STORAGE_KEY = "clab-ui-language";
let selectedLanguage: UiLanguage | undefined;

/** Browser builds of this fork default to Chinese; non-browser consumers retain English. */
export function getUiLanguage(): UiLanguage {
  if (selectedLanguage) return selectedLanguage;
  selectedLanguage = typeof window === "undefined" ? "en" : "zh-CN";
  try {
    const saved = globalThis.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh-CN") selectedLanguage = saved;
  } catch { /* Storage may be disabled; keep the in-memory preference. */ }
  if (typeof document !== "undefined") document.documentElement.lang = selectedLanguage;
  return selectedLanguage;
}

export function setUiLanguage(language: UiLanguage): void {
  selectedLanguage = language;
  try { globalThis.localStorage.setItem(STORAGE_KEY, language); } catch { /* Optional persistence. */ }
  if (typeof document !== "undefined") document.documentElement.lang = language;
}

/** Translate presentation copy only. Call sites never pass topology/configuration values or logs. */
export function uiText(message: string, values: Readonly<Record<string, unknown>> = {}): string {
  const key = message.trim();
  const translated = getUiLanguage() === "zh-CN" && Object.hasOwn(zhCN, key) ? zhCN[key] : undefined;
  const text = translated === undefined
    ? message
    : message.slice(0, message.length - message.trimStart().length) + translated + message.slice(message.trimEnd().length);
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder);
}
