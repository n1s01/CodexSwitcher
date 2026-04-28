import { useState, type ReactNode } from "react";
import styles from "./App.module.css";
import "./styles.css";
import { navItems } from "../features/navigation/model/nav-items";
import type { TabId } from "../features/navigation/model/types";
import { AccountsPage } from "../pages/accounts/ui/AccountsPage";
import { HomePage } from "../pages/home/ui/HomePage";
import { SettingsPage } from "../pages/settings/ui/SettingsPage";
import { ChevronLeftIcon, ChevronRightIcon } from "../shared/ui/icons/AppIcons";
import logo from "../assets/logo.png";

const pageByTab: Record<TabId, ReactNode> = {
  home: <HomePage />,
  accounts: <AccountsPage />,
  settings: <SettingsPage />,
};

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ""}`}>
        <div className={`${styles.brand} ${!collapsed ? styles.brandExpanded : ""}`}>
          <img src={logo} className={styles.brandLogo} alt="CodexSwitcher logo" />
          {!collapsed && (
            <div className={styles.brandText}>
              <span className={styles.brandName}>CodexSwitcher</span>
              <span className={styles.brandSub}>Account manager</span>
            </div>
          )}
        </div>

        <div className={styles.divider} />

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${activeTab === item.id ? styles.navItemActive : ""} ${collapsed ? styles.navItemCollapsed : ""}`}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={activeTab === item.id ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
            </button>
          ))}
        </nav>

        <button
          className={`${styles.collapseBtn} ${collapsed ? styles.collapseBtnCollapsed : ""}`}
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Развернуть" : "Свернуть"}
          title={collapsed ? "Развернуть" : undefined}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          {!collapsed && <span className={styles.collapseBtnLabel}>Свернуть</span>}
        </button>
      </aside>

      <main className={styles.content}>
        {pageByTab[activeTab]}
      </main>
    </div>
  );
}
