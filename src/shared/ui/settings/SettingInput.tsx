import type { ReactNode, KeyboardEvent } from "react";
import { CheckIcon, CloseIcon } from "../icons/AppIcons";
import styles from "./SettingsControls.module.css";

interface SettingInputProps {
  label: ReactNode;
  description?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDirty: boolean;
  isSaving: boolean;
  saveLabel: string;
  cancelLabel: string;
  onSave: () => void;
  onCancel: () => void;
  validationError?: ReactNode;
}

export function SettingInput({
  label,
  description,
  value,
  onChange,
  placeholder,
  isDirty,
  isSaving,
  saveLabel,
  cancelLabel,
  onSave,
  onCancel,
  validationError,
}: SettingInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSave();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className={styles.row}>
      <div className={styles.labelWrap}>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.description}>{description}</span>}
      </div>
      <div className={styles.inputWrap}>
        <input
          className={`${styles.input} ${validationError ? styles.inputError : ""}`}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder={placeholder}
        />
        <div className={`${styles.actions} ${isDirty ? styles.actionsVisible : ""}`}>
          <button
            className={`${styles.actionButton} ${styles.actionConfirm} ${isSaving ? styles.actionButtonSaving : ""}`}
            type="button"
            onClick={onSave}
            disabled={!isDirty || isSaving}
            aria-label={saveLabel}
            title={saveLabel}
          >
            <CheckIcon />
          </button>
          <button
            className={`${styles.actionButton} ${styles.actionCancel}`}
            type="button"
            onClick={onCancel}
            disabled={!isDirty || isSaving}
            aria-label={cancelLabel}
            title={cancelLabel}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
