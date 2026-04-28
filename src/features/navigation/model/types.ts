import type { ReactElement } from "react";

export type TabId = "home" | "accounts" | "settings";

export type NavItem = {
  id: TabId;
  label: string;
  description: string;
  icon: ReactElement;
};
