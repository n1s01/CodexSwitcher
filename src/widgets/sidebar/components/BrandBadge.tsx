import styles from "./BrandBadge.module.css";

type BrandBadgeProps = {
  isCollapsed: boolean;
};

export function BrandBadge({ isCollapsed }: BrandBadgeProps) {
  return (
    <div className={`${styles.brand} ${isCollapsed ? styles.collapsed : ""}`}>
      <div className={styles.logoMark} aria-hidden="true">
        <svg viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="4" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
          <circle cx="6" cy="6" r="1.5" fill="rgba(255,255,255,0.6)" />
        </svg>
      </div>
      {!isCollapsed && (
        <span className={styles.name}>CodexSwitcher</span>
      )}
    </div>
  );
}
