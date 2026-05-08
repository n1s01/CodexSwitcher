import { HomeIcon, AccountsIcon, SettingsIcon } from "../../../shared/ui/icons/AppIcons";
import type { NavItem } from "./types";
import type { TranslationKey } from "../../../shared/i18n/messages";

type Translate = (key: TranslationKey) => string;

export function getNavItems(t: Translate): NavItem[] {
  return [
    { id: "home", label: t("app.navigation.home"), description: "", icon: <HomeIcon /> },
    { id: "accounts", label: t("app.navigation.accounts"), description: "", icon: <AccountsIcon /> },
    { id: "settings", label: t("app.navigation.settings"), description: "", icon: <SettingsIcon /> },
  ];
}
