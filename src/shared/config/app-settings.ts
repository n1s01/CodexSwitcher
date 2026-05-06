import type { Locale } from "../i18n/messages";

const SETTINGS_STORAGE_KEY = "codex-switcher:settings";

type StoredSettings = {
  locale: Locale;
};

function isLocale(value: string): value is Locale {
  return value === "ru" || value === "en" || value === "zh";
}

function mapLanguageTagToLocale(languageTag: string | null | undefined): Locale | null {
  if (!languageTag) {
    return null;
  }

  const normalized = languageTag.toLowerCase();

  if (normalized.startsWith("ru")) {
    return "ru";
  }

  if (normalized.startsWith("zh")) {
    return "zh";
  }

  if (normalized.startsWith("en")) {
    return "en";
  }

  return null;
}

export function detectSystemLocale(): Locale {
  const preferredLanguages =
    typeof navigator === "undefined"
      ? []
      : [...(navigator.languages ?? []), navigator.language].filter(Boolean);

  for (const language of preferredLanguages) {
    const locale = mapLanguageTagToLocale(language);

    if (locale) {
      return locale;
    }
  }

  return "en";
}

export function loadStoredSettings(): StoredSettings | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredSettings>;

    if (!parsed.locale || !isLocale(parsed.locale)) {
      return null;
    }

    return { locale: parsed.locale };
  } catch {
    return null;
  }
}

export function resolveInitialLocale(): Locale {
  return loadStoredSettings()?.locale ?? detectSystemLocale();
}

export function saveStoredSettings(settings: StoredSettings) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors and keep the app functional.
  }
}
