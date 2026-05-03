import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import styles from "./ConfirmModal.module.css";

export interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmModal({
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const { t } = useI18n();
  const [closing, setClosing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const resolvedCancelLabel = cancelLabel ?? t("common.cancel");

  const close = () => {
    if (isPending) return;
    setClosing(true);
  };

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(onClose, 180);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isPending]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) close();
  };

  const handleConfirm = async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      await onConfirm();
      setClosing(true);
    } finally {
      setIsPending(false);
    }
  };

  return createPortal(
    <div
      ref={backdropRef}
      className={`${styles.backdrop} ${closing ? styles.closing : ""}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`${styles.modal} ${closing ? styles.closing : ""}`}>
        <div className={styles.body}>
          <div className={styles.title}>{title}</div>
          <div className={styles.description}>{description}</div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={close}
            disabled={isPending}
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.confirmButton} ${variant === "danger" ? styles.confirmDanger : styles.confirmDefault}`}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
