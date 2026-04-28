import styles from "./Sidebar.module.css";
import {
  SidebarCollapseIcon,
  SidebarExpandIcon,
} from "../../shared/ui/icons/AppIcons";
import type { NavItem, TabId } from "../../features/navigation/model/types";
import logo from "../../assets/logo.png";

type SidebarProps = {
  items: NavItem[];
  activeTab: TabId;
  isCollapsed: boolean;
  motionState: "idle" | "expanding" | "collapsing";
  width: number;
  disableTransition: boolean;
  onTabChange: (tab: TabId) => void;
  onToggleCollapse: () => void;
};

export function Sidebar({
  items,
  activeTab,
  isCollapsed,
  motionState,
  width,
  disableTransition,
  onTabChange,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <aside
      className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""} ${
        motionState === "expanding" ? styles.expanding : ""
      } ${motionState === "collapsing" ? styles.collapsing : ""}`}
      style={{
        width: `${width}px`,
        transition: disableTransition ? "none" : undefined,
      }}
    >
      <div className={styles.brand}>
        <img src={logo} className={styles.brandLogo} alt="CodexSwitcher logo" />
        <div className={styles.brandText} aria-hidden={isCollapsed}>
          <span className={styles.brandName}>CodexSwitcher</span>
          <span className={styles.brandSub}>Account manager</span>
        </div>
      </div>

      <div className={styles.divider} />

      <nav className={styles.nav} aria-label="Основная навигация">
        {items.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${item.id === activeTab ? styles.navItemActive : ""}`}
            type="button"
            onClick={() => onTabChange(item.id)}
            aria-current={item.id === activeTab ? "page" : undefined}
            aria-label={isCollapsed ? item.label : undefined}
            title={isCollapsed ? item.label : undefined}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel} aria-hidden={isCollapsed}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <button
        className={styles.collapseButton}
        type="button"
        onClick={onToggleCollapse}
        aria-label={isCollapsed ? "Развернуть" : "Свернуть"}
        title={isCollapsed ? "Развернуть" : "Свернуть"}
      >
        <span className={styles.collapseButtonIconStack} aria-hidden="true">
          <span
            className={`${styles.collapseButtonIcon} ${styles.collapseButtonIconExpand}`}
          >
            <SidebarExpandIcon />
          </span>
          <span
            className={`${styles.collapseButtonIcon} ${styles.collapseButtonIconCollapse}`}
          >
            <SidebarCollapseIcon />
          </span>
        </span>
        <span className={styles.collapseLabel} aria-hidden={isCollapsed}>
          Свернуть
        </span>
      </button>
    </aside>
  );
}
