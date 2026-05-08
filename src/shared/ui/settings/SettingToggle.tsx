import type { ReactNode } from "react";
import styles from "./SettingsControls.module.css";

interface SettingToggleProps {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SettingToggle({ label, description, checked, onChange }: SettingToggleProps) {
  return (
    <div className={styles.row}>
      <div className={styles.labelWrap}>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.description}>{description}</span>}
      </div>
      <button
        className={`${styles.toggle} ${checked ? styles.toggleOn : ""}`}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.toggleTrack} aria-hidden="true">
          <span className={styles.toggleThumb} />
        </span>
      </button>
    </div>
  );
}
