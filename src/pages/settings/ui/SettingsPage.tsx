import { useEffect, useState } from "react";
import { PagePanel } from "../../../shared/ui/page-panel/PagePanel";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useToast } from "../../../shared/ui/toast/ToastProvider";
import { AnimatedText } from "../../../shared/ui/animated-text/AnimatedText";
import { getCodexDirectoryPath, setCodexDirectoryPath, validateCodexDirectoryPath } from "../model/settings-api";
import { SettingToggle } from "../../../shared/ui/settings/SettingToggle";
import { SettingSelect, type SelectOption } from "../../../shared/ui/settings/SettingSelect";
import { SettingInput } from "../../../shared/ui/settings/SettingInput";
import type { Locale } from "../../../shared/i18n/messages";
import styles from "./SettingsPage.module.css";

const languageOptions: SelectOption<Locale>[] = [
  { value: "en", prefix: "🇬🇧", label: "English" },
  { value: "ru", prefix: "🇷🇺", label: "Русский" },
  { value: "zh", prefix: "🇨🇳", label: "中文" },
];

const localeIndex = (loc: Locale) => languageOptions.findIndex((o) => o.value === loc);

export function SettingsPage() {
  const { locale, setLocale, useTransparency, setUseTransparency, useAnimations, setUseAnimations, t } = useI18n();
  const { showToast } = useToast();
  const [codexDirectoryPath, setCodexDirectoryPath_] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [pathDirty, setPathDirty] = useState(false);
  const [pathValidationError, setPathValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [localeAnimDir, setLocaleAnimDir] = useState<"up" | "down" | null>(null);

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

  const handleLocaleChange = (next: Locale) => {
    const dir = localeIndex(next) > localeIndex(locale) ? "down" : "up";
    setLocaleAnimDir(dir);
    setTimeout(() => {
      setLocale(next);
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

  const handleCancelPathChanges = () => {
    setPathInput(codexDirectoryPath ?? "");
    setPathDirty(false);
    setPathValidationError(null);
  };

  return (
    <PagePanel title={t("settings.title")}>
      <section className={styles.page}>
        <div className={styles.settingsGrid}>
            <SettingSelect
              label={<AnimatedText>{t("settings.language.label")}</AnimatedText>}
              value={locale}
              onChange={handleLocaleChange}
              options={languageOptions}
              innerClassName={
                localeAnimDir ? styles[`localeAnim_${localeAnimDir}`] : undefined
              }
              innerKey={locale}
            />

            <SettingToggle
              label={<AnimatedText>{t("settings.transparency.label")}</AnimatedText>}
              checked={useTransparency}
              onChange={setUseTransparency}
            />

            <SettingToggle
              label={<AnimatedText>{t("settings.animations.label")}</AnimatedText>}
              checked={useAnimations}
              onChange={setUseAnimations}
            />

            <div>
              <SettingInput
                label={<AnimatedText>{t("settings.path.label")}</AnimatedText>}
                value={pathInput}
                onChange={handlePathInput}
                placeholder={t("settings.path.loading")}
                isDirty={pathDirty}
                isSaving={isSaving}
                saveLabel={t("settings.path.save")}
                cancelLabel={t("common.cancel")}
                onSave={handleSavePath}
                onCancel={handleCancelPathChanges}
              />
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
