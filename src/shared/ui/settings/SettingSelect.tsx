import { useRef, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { ChevronDownIcon } from "../icons/AppIcons";
import styles from "./SettingsControls.module.css";

export interface SelectOption<V extends string> {
  value: V;
  label: ReactNode;
  prefix?: ReactNode;
}

interface SettingSelectProps<V extends string> {
  label: ReactNode;
  description?: ReactNode;
  value: V;
  onChange: (value: V) => void;
  options: readonly SelectOption<V>[];
  innerClassName?: string;
  innerKey?: string;
}

export function SettingSelect<V extends string>({
  label,
  description,
  value,
  onChange,
  options,
  innerClassName,
  innerKey,
}: SettingSelectProps<V>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  const handleOutside = useCallback((e: PointerEvent) => {
    if (!containerRef.current?.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setIsOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener("pointerdown", handleOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handleOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [handleOutside, handleEscape]);

  return (
    <div className={styles.row}>
      <div className={styles.labelWrap}>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.description}>{description}</span>}
      </div>
      <div className={styles.selectWrap} ref={containerRef}>
        <button
          className={`${styles.selectButton} ${isOpen ? styles.selectButtonOpen : ""}`}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((v) => !v)}
        >
          <span
            className={`${styles.selectButtonInner} ${innerClassName ?? ""}`}
            key={innerKey}
          >
            {selected.prefix && <span className={styles.triggerPrefix}>{selected.prefix}</span>}
            <span>{selected.label}</span>
          </span>
          <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}>
            <ChevronDownIcon />
          </span>
        </button>

        <div className={`${styles.dropdown} ${isOpen ? styles.dropdownOpen : ""}`} role="listbox">
          {options.map((option, i) => {
            const isActive = option.value === value;
            return (
              <button
                key={option.value}
                className={`${styles.option} ${isActive ? styles.optionActive : ""}`}
                type="button"
                role="option"
                aria-selected={isActive}
                style={{ animationDelay: isOpen ? `${60 + i * 55}ms` : "0ms" }}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.prefix && <span className={styles.optionPrefix}>{option.prefix}</span>}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
