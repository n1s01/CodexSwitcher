import type { Locale } from "../i18n/messages";

const SETTINGS_STORAGE_KEY = "codex-switcher:settings";

type StoredSettings = {
  locale: Locale;
  useTransparency: boolean;
  useAnimations: boolean;
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

    return {
      locale: parsed.locale,
      useTransparency: typeof parsed.useTransparency === "boolean" ? parsed.useTransparency : true,
      useAnimations: typeof parsed.useAnimations === "boolean" ? parsed.useAnimations : true,
    };
  } catch {
    return null;
  }
}

export function resolveInitialLocale(): Locale {
  return loadStoredSettings()?.locale ?? detectSystemLocale();
}

export function resolveInitialTransparency(): boolean {
  return loadStoredSettings()?.useTransparency ?? true;
}

export function resolveInitialAnimations(): boolean {
  return loadStoredSettings()?.useAnimations ?? true;
}

export function saveStoredSettings(settings: Partial<StoredSettings>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const current = loadStoredSettings() ?? { locale: detectSystemLocale(), useTransparency: true, useAnimations: true };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...current, ...settings }));
  } catch {
    // Ignore storage errors and keep the app functional.
  }
}
