import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseAccountImport } from "../model/account-utils";
import styles from "./AddAccountModal.module.css";

interface ValidationState {
  accessToken: boolean;
  refreshToken: boolean;
  accountId: boolean;
  email: string | null;
  planType: string | null;
  exp: string | null;
}

function validate(raw: string): ValidationState | null {
  const parsed = parseAccountImport(raw);

  if (!parsed) {
    return null;
  }

  return {
    accessToken: Boolean(parsed.accessToken),
    refreshToken: Boolean(parsed.refreshToken),
    accountId: Boolean(parsed.accountId),
    email: parsed.email,
    planType: parsed.planType,
    exp:
      typeof parsed.exp === "number"
        ? new Date(parsed.exp * 1000).toLocaleString("ru-RU")
        : null,
  };
}

interface AddAccountModalProps {
  onClose: () => void;
  onAdd: (rawJson: string) => Promise<void>;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Что-то пошло не так. Попробуйте еще раз.";
}

export function AddAccountModal({
  onClose,
  onAdd,
}: AddAccountModalProps) {
  const [closing, setClosing] = useState(false);
  const [raw, setRaw] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const validation = validate(raw);
  const canAdd = Boolean(validation?.accessToken);

  const hasContent = raw.trim().length > 0;
  const isValidJson = hasContent && validation !== null;
  const isInvalidJson = hasContent && validation === null;
  const isBusy = isSubmittingImport;

  const close = () => {
    if (isBusy) {
      return;
    }
    setClosing(true);
  };

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(onClose, 180);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) close();
  };

  const handleAdd = async () => {
    if (!canAdd || isBusy) {
      return;
    }

    setSubmitError(null);
    setIsSubmittingImport(true);

    try {
      await onAdd(raw);
      setClosing(true);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setIsSubmittingImport(false);
    }
  };

  return createPortal(
    <div
      ref={backdropRef}
      className={`${styles.backdrop} ${closing ? styles.closing : ""}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Добавить аккаунт"
    >
      <div className={`${styles.modal} ${closing ? styles.closing : ""}`}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Добавить аккаунт</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={close}
            aria-label="Закрыть"
            disabled={isBusy}
          >
            <svg className={styles.closeIcon} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        {/* JSON field */}
        <div className={styles.body}>
          <div className={styles.fieldLabel}>Данные авторизации</div>
          <div
            className={`${styles.textareaWrap} ${
              isValidJson ? styles.valid : isInvalidJson ? styles.invalid : ""
            }`}
          >
            <textarea
              className={styles.textarea}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={'Вставьте JSON с токенами\n{"tokens": {"access_token": "...", ...}}'}
              spellCheck={false}
              autoFocus
              disabled={isBusy}
            />
          </div>

          {/* Validation feedback */}
          {validation && (
            <div className={styles.validationList}>
              <div className={`${styles.validationRow} ${validation.accessToken ? styles.ok : styles.missing}`}>
                <span className={styles.validationDot} />
                access_token
              </div>
              <div className={`${styles.validationRow} ${validation.refreshToken ? styles.ok : styles.missing}`}>
                <span className={styles.validationDot} />
                refresh_token
              </div>
              <div className={`${styles.validationRow} ${validation.accountId ? styles.ok : styles.missing}`}>
                <span className={styles.validationDot} />
                account_id
              </div>

              {(validation.email || validation.planType || validation.exp) && (
                <div className={styles.validationExtra}>
                  {validation.email && (
                    <span className={`${styles.validationChip} ${styles.visible}`}>
                      {validation.email}
                    </span>
                  )}
                  {validation.planType && (
                    <span className={`${styles.validationChip} ${styles.visible}`}>
                      {validation.planType}
                    </span>
                  )}
                  {validation.exp && (
                    <span className={`${styles.validationChip} ${styles.visible}`}>
                      до {validation.exp}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className={styles.divider}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerLabel}>или</span>
          <div className={styles.dividerLine} />
        </div>

        {/* Auto section */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.autoButton}
            onClick={() => {}}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3l2 2" />
            </svg>
            Найти автоматически
          </button>
          <span className={styles.autoDesc}>
            Найдёт уже готовую авторизацию, если вы входили через&nbsp;Codex самостоятельно
          </span>
          {submitError && (
            <div className={`${styles.statusBox} ${styles.statusError}`}>
              {submitError}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={close}
            disabled={isBusy}
          >
            Отмена
          </button>
          <button
            type="button"
            className={styles.addButton}
            disabled={!canAdd || isBusy}
            onClick={handleAdd}
          >
            {isSubmittingImport ? "Сохраняем..." : "Добавить"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
