import { PagePanel } from "../../../shared/ui/page-panel/PagePanel";
import { useI18n } from "../../../shared/i18n/I18nProvider";

export function SettingsPage() {
  const { t } = useI18n();

  return <PagePanel title={t("settings.title")} />;
}
