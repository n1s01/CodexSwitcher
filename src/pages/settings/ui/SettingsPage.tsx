import { useEffect, useMemo, useRef, useState } from "react";
import { PagePanel } from "../../../shared/ui/page-panel/PagePanel";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useToast } from "../../../shared/ui/toast/ToastProvider";
import { CheckIcon, ChevronDownIcon, CloseIcon } from "../../../shared/ui/icons/AppIcons";
import { AnimatedText } from "../../../shared/ui/animated-text/AnimatedText";
import { getCodexDirectoryPath, setCodexDirectoryPath, validateCodexDirectoryPath } from "../model/settings-api";
import type { Locale } from "../../../shared/i18n/messages";
import styles from "./SettingsPage.module.css";

type LanguageOption = {
  locale: Locale;
  flag: string;
  label: string;
  nativeLabel: string;
};

const languageOptions: LanguageOption[] = [
  { locale: "en", flag: "🇬🇧", label: "English", nativeLabel: "English" },
  { locale: "ru", flag: "🇷🇺", label: "Russian", nativeLabel: "Русский" },
  { locale: "zh", flag: "🇨🇳", label: "Chinese", nativeLabel: "中文" },
];

export function SettingsPage() {
  const { locale, setLocale, t } = useI18n();
  const { showToast } = useToast();
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [codexDirectoryPath, setCodexDirectoryPath_] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [pathDirty, setPathDirty] = useState(false);
  const [pathValidationError, setPathValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [localeAnimDir, setLocaleAnimDir] = useState<"up" | "down" | null>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  const selectedLanguage = useMemo(
    () => languageOptions.find((o) => o.locale === locale) ?? languageOptions[0],
    [locale],
  );

  const localeIndex = (loc: Locale) => languageOptions.findIndex((o) => o.locale === loc);

  useEffect(() => {
    let isMounted = true;
    getCodexDirectoryPath()
      .then((path) => {
        if (!isMounted) return;
        setCodexDirectoryPath_(path);
        setPathInput(path);
      })
      .catch(() => {
        if (!isMounted) return;
      });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!languageMenuRef.current?.contains(e.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsLanguageMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleLocaleChange = (next: Locale) => {
    const dir = localeIndex(next) > localeIndex(locale) ? "down" : "up";
    setLocaleAnimDir(dir);
    setTimeout(() => {
      setLocale(next);
      setIsLanguageMenuOpen(false);
      setTimeout(() => setLocaleAnimDir(null), 320);
    }, 10);
  };

  const handlePathInput = (value: string) => {
    setPathInput(value);
    setPathDirty(value !== codexDirectoryPath);
    setPathValidationError(null);
  };

  const handleSavePath = async () => {
    if (!pathDirty || isSaving) return;
    setIsSaving(true);
    setPathValidationError(null);

    try {
      const validation = await validateCodexDirectoryPath(pathInput);

      if (!validation.valid) {
        const fileList = validation.missing_files.join(", ");
        setPathValidationError(
          t("settings.path.invalidDescription").replace("{files}", fileList),
        );
        return;
      }

      await setCodexDirectoryPath(pathInput);
      setCodexDirectoryPath_(pathInput);
      setPathDirty(false);
      showToast({
        title: t("settings.path.saved"),
        description: t("settings.path.savedDescription"),
        tone: "success",
      });
    } catch {
      setPathValidationError("Failed to save path");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSavePath();
    if (e.key === "Escape") handleCancelPathChanges();
  };

  const handleCancelPathChanges = () => {
    setPathInput(codexDirectoryPath ?? "");
    setPathDirty(false);
    setPathValidationError(null);
  };

  return (
    <PagePanel title={t("settings.title")}>
      <section className={styles.page}>
        <div className={styles.settingsGrid}>
          {/* Left: Language */}
          <div>
            <div className={styles.settingRow}>
              <AnimatedText className={styles.settingLabel}>{t("settings.language.label")}</AnimatedText>
              <div className={styles.languageMenu} ref={languageMenuRef}>
                <button
                  className={`${styles.languageButton} ${isLanguageMenuOpen ? styles.languageButtonOpen : ""}`}
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={isLanguageMenuOpen}
                  onClick={() => setIsLanguageMenuOpen((v) => !v)}
                >
                  <span
                    className={`${styles.languageButtonInner} ${localeAnimDir ? styles[`localeAnim_${localeAnimDir}`] : ""}`}
                    key={locale}
                  >
                    <span className={styles.flagBadge}>{selectedLanguage.flag}</span>
                    <span className={styles.languageName}>{selectedLanguage.nativeLabel}</span>
                  </span>
                  <span className={`${styles.chevron} ${isLanguageMenuOpen ? styles.chevronOpen : ""}`}>
                    <ChevronDownIcon />
                  </span>
                </button>

                <div className={`${styles.dropdown} ${isLanguageMenuOpen ? styles.dropdownOpen : ""}`} role="listbox">
                  {languageOptions.map((option, i) => {
                    const isActive = option.locale === locale;
                    return (
                      <button
                        key={option.locale}
                        className={`${styles.option} ${isActive ? styles.optionActive : ""}`}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        style={{ transitionDelay: isLanguageMenuOpen ? `${i * 28}ms` : "0ms" }}
                        onClick={() => handleLocaleChange(option.locale)}
                      >
                        <span className={styles.optionStatusDot} />
                        <span className={styles.flagBadge}>{option.flag}</span>
                        <span className={styles.languageName}>{option.nativeLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Path */}
          <div className={styles.pathColumn}>
            <div className={styles.settingRow}>
              <AnimatedText className={styles.settingLabel}>{t("settings.path.label")}</AnimatedText>
              <div className={styles.pathInputWrap}>
                <input
                  className={styles.pathInput}
                  type="text"
                  value={pathInput}
                  onChange={(e) => handlePathInput(e.target.value)}
                  onKeyDown={handlePathKeyDown}
                  spellCheck={false}
                  placeholder={t("settings.path.loading")}
                />
                <div className={`${styles.pathActions} ${pathDirty ? styles.pathActionsVisible : ""}`}>
                  <button
                    className={`${styles.pathActionButton} ${styles.pathActionConfirm} ${isSaving ? styles.pathActionButtonSaving : ""}`}
                    type="button"
                    onClick={handleSavePath}
                    disabled={!pathDirty || isSaving}
                    aria-label={t("settings.path.save")}
                    title={t("settings.path.save")}
                  >
                    <CheckIcon />
                  </button>
                  <button
                    className={`${styles.pathActionButton} ${styles.pathActionCancel}`}
                    type="button"
                    onClick={handleCancelPathChanges}
                    disabled={!pathDirty || isSaving}
                    aria-label={t("common.cancel")}
                    title={t("common.cancel")}
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>
            </div>
            {pathValidationError && (
              <div className={styles.pathValidationError}>
                <span className={styles.pathValidationDot} />
                <AnimatedText className={styles.pathValidationTitle}>{t("settings.path.invalidTitle")}</AnimatedText>
                <AnimatedText className={styles.pathValidationText}>{pathValidationError}</AnimatedText>
              </div>
            )}
          </div>
        </div>
      </section>
    </PagePanel>
  );
}
