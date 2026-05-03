import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { messages, type Locale, type TranslationKey } from "./messages";

type TranslationValue = string | number;
type TranslationParams = Record<string, TranslationValue>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  formatDateTime: (timestamp: number | null | undefined) => string;
  formatDateTimeFromMs: (timestamp: number | null | undefined) => string;
  formatPercent: (value: number | null | undefined) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: TranslationParams) {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

function resolveDateLocale(locale: Locale) {
  switch (locale) {
    case "ru":
    default:
      return "ru-RU";
  }
}

export function I18nProvider({
  children,
  defaultLocale = "ru",
}: PropsWithChildren<{ defaultLocale?: Locale }>) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = messages[locale];
    const dateLocale = resolveDateLocale(locale);

    return {
      locale,
      setLocale,
      t: (key, params) => interpolate(dictionary[key], params),
      formatDateTime: (timestamp) => {
        if (!timestamp) {
          return "—";
        }

        return new Intl.DateTimeFormat(dateLocale, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(timestamp * 1000));
      },
      formatDateTimeFromMs: (timestamp) => {
        if (!timestamp) {
          return "—";
        }

        return new Intl.DateTimeFormat(dateLocale, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(timestamp));
      },
      formatPercent: (value) => {
        if (typeof value !== "number") {
          return "—";
        }

        return `${Math.round(value)}%`;
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return context;
}
