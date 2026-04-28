import styles from "./Sidebar.module.css";
import { ChevronLeftIcon, ChevronRightIcon } from "../../shared/ui/icons/AppIcons";
import type { NavItem, TabId } from "../../features/navigation/model/types";
import { BrandBadge } from "./components/BrandBadge";
import { SidebarItem } from "./components/SidebarItem";

type SidebarProps = {
  items: NavItem[];
  activeTab: TabId;
  isCollapsed: boolean;
  onTabChange: (tab: TabId) => void;
  onToggleCollapse: () => void;
};

export function Sidebar({
  items,
  activeTab,
  isCollapsed,
  onTabChange,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""}`}>
      <nav className={styles.nav} aria-label="Основная навигация">
        {items.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            isActive={item.id === activeTab}
            isCollapsed={isCollapsed}
            onClick={() => onTabChange(item.id)}
          />
        ))}
      </nav>

      <div className={styles.bottom}>
        <BrandBadge isCollapsed={isCollapsed} />

        <button
          className={styles.collapseButton}
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Развернуть" : "Свернуть"}
          title={isCollapsed ? "Развернуть" : "Свернуть"}
        >
          <span className={styles.collapseButtonIcon}>
            {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </span>
          {!isCollapsed && (
            <span className={styles.collapseLabel}>Свернуть</span>
          )}
        </button>
      </div>
    </aside>
  );
}
