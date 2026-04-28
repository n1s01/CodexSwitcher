import { HomeIcon, AccountsIcon, SettingsIcon } from "../../../shared/ui/icons/AppIcons";
import type { NavItem } from "./types";

export const navItems: NavItem[] = [
  { id: "home",     label: "Главная",   description: "", icon: <HomeIcon /> },
  { id: "accounts", label: "Аккаунты",  description: "", icon: <AccountsIcon /> },
  { id: "settings", label: "Настройки", description: "", icon: <SettingsIcon /> },
];
