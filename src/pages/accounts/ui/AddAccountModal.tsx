import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { parseAccountImport } from "../model/account-utils";
import styles from "./AddAccountModal.module.css";

interface ValidationState {
  accessToken: boolean;
  refreshToken: boolean;
  accountId: boolean;
  email: string | null;
  planType: string | null;
  exp: number | null;
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
    exp: typeof parsed.exp === "number" ? parsed.exp : null,
  };
}

interface AddAccountModalProps {
  onClose: () => void;
  onAdd: (rawJson: string) => Promise<void>;
  onAuthorize: () => Promise<void>;
}

type AuthStage = "idle" | "opening" | "waiting" | "saving";

export function AddAccountModal({
  onClose,
  onAdd,
  onAuthorize,
}: AddAccountModalProps) {
  const { t, formatDateTime } = useI18n();
  const [closing, setClosing] = useState(false);
  const [raw, setRaw] = useState("");
  const [authStage, setAuthStage] = useState<AuthStage>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const authStageTimerRef = useRef<number | null>(null);

  const validation = validate(raw);
  const canAdd = Boolean(validation?.accessToken);

  const hasContent = raw.trim().length > 0;
  const isValidJson = hasContent && validation !== null;
  const isInvalidJson = hasContent && validation === null;
  const isBusy = authStage !== "idle" || isSubmittingImport;
  const localizedValidation = validation
    ? {
        ...validation,
        exp: validation.exp
          ? t("accounts.modal.validUntil", {
              value: formatDateTime(validation.exp),
            })
          : null,
      }
    : null;

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }

    return t("accounts.modal.error");
  };

  const close = (force = false) => {
    if (isBusy && !force) {
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
    return () => {
      if (authStageTimerRef.current !== null) {
        window.clearTimeout(authStageTimerRef.current);
      }
    };
  }, []);

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

  const handleAuthorize = async () => {
    if (isBusy) {
      return;
    }

    setSubmitError(null);
    setAuthStage("opening");

    authStageTimerRef.current = window.setTimeout(() => {
      setAuthStage("waiting");
      authStageTimerRef.current = null;
    }, 480);

    try {
      await onAuthorize();

      if (authStageTimerRef.current !== null) {
        window.clearTimeout(authStageTimerRef.current);
        authStageTimerRef.current = null;
      }

      setAuthStage("saving");

      window.setTimeout(() => {
        setClosing(true);
      }, 180);
    } catch (error) {
      if (authStageTimerRef.current !== null) {
        window.clearTimeout(authStageTimerRef.current);
        authStageTimerRef.current = null;
      }

      setAuthStage("idle");
      setSubmitError(getErrorMessage(error));
    }
  };

  const authStatusText =
    authStage === "opening"
      ? t("accounts.modal.opening")
      : authStage === "waiting"
        ? t("accounts.modal.waiting")
        : authStage === "saving"
          ? t("accounts.modal.saving")
          : null;

  return createPortal(
    <div
      ref={backdropRef}
      className={`${styles.backdrop} ${closing ? styles.closing : ""}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={t("accounts.modal.add.aria")}
    >
      <div className={`${styles.modal} ${closing ? styles.closing : ""}`}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>{t("accounts.modal.add.title")}</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => close()}
            aria-label={t("app.window.close")}
            disabled={isBusy}
          >
            <svg className={styles.closeIcon} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        {/* JSON field */}
        <div className={styles.body}>
          <div className={styles.fieldLabel}>{t("accounts.modal.authData")}</div>
          <div
            className={`${styles.textareaWrap} ${
              isValidJson ? styles.valid : isInvalidJson ? styles.invalid : ""
            }`}
          >
            <textarea
              className={styles.textarea}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={t("accounts.modal.placeholder")}
              spellCheck={false}
              autoFocus
              disabled={isBusy}
            />
          </div>

          {/* Validation feedback */}
          {localizedValidation && (
            <div className={styles.validationList}>
              <div className={`${styles.validationRow} ${localizedValidation.accessToken ? styles.ok : styles.missing}`}>
                <span className={styles.validationDot} />
                access_token
              </div>
              <div className={`${styles.validationRow} ${localizedValidation.refreshToken ? styles.ok : styles.missing}`}>
                <span className={styles.validationDot} />
                refresh_token
              </div>
              <div className={`${styles.validationRow} ${localizedValidation.accountId ? styles.ok : styles.missing}`}>
                <span className={styles.validationDot} />
                account_id
              </div>

              {(localizedValidation.email || localizedValidation.planType || localizedValidation.exp) && (
                <div className={styles.validationExtra}>
                  {localizedValidation.email && (
                    <span className={`${styles.validationChip} ${styles.visible}`}>
                      {localizedValidation.email}
                    </span>
                  )}
                  {localizedValidation.planType && (
                    <span className={`${styles.validationChip} ${styles.visible}`}>
                      {localizedValidation.planType}
                    </span>
                  )}
                  {localizedValidation.exp && (
                    <span className={`${styles.validationChip} ${styles.visible}`}>
                      {localizedValidation.exp}
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
          <span className={styles.dividerLabel}>{t("common.or")}</span>
          <div className={styles.dividerLine} />
        </div>

        {/* Auto section */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.autoButton}
            onClick={handleAuthorize}
            disabled={isBusy}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3l2 2" />
            </svg>
            {t("accounts.modal.authorize")}
          </button>
          <span className={styles.autoDesc}>
            {t("accounts.modal.authorizeDescription")}
          </span>
          {(authStatusText || submitError) && (
            <div
              className={`${styles.statusBox} ${submitError ? styles.statusError : ""}`}
            >
              {submitError ?? authStatusText}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={() => close()}
            disabled={isBusy}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={styles.addButton}
            disabled={!canAdd || isBusy}
            onClick={handleAdd}
          >
            {isSubmittingImport ? t("common.saving") : t("accounts.modal.addAction")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
