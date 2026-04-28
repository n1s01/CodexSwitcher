import styles from "./SidebarItem.module.css";
import type { NavItem } from "../../../features/navigation/model/types";

type SidebarItemProps = {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
};

export function SidebarItem({ item, isActive, isCollapsed, onClick }: SidebarItemProps) {
  return (
    <button
      className={`${styles.navItem} ${isActive ? styles.active : ""} ${
        isCollapsed ? styles.collapsed : ""
      }`}
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      title={isCollapsed ? item.label : undefined}
    >
      <span className={styles.icon}>{item.icon}</span>
      {!isCollapsed && <span className={styles.label}>{item.label}</span>}
    </button>
  );
}
