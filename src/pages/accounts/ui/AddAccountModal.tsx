import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./AddAccountModal.module.css";

interface ParsedAccount {
  access_token: string;
  refresh_token: string | null;
  account_id: string | null;
  email: string | null;
  plan_type: string | null;
  exp: string | null;
}

interface ValidationState {
  access_token: boolean;
  refresh_token: boolean;
  account_id: boolean;
  email: string | null;
  plan_type: string | null;
  exp: string | null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function parseInput(raw: string): ParsedAccount | null {
  if (!raw.trim()) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;

    // Support both flat {"access_token": ...} and nested {"tokens": {"access_token": ...}}
    const tokens = (obj.tokens as Record<string, unknown> | undefined) ?? obj;
    const accessToken =
      (tokens.access_token as string | undefined) ??
      (obj.access_token as string | undefined) ??
      null;
    const refreshToken =
      (tokens.refresh_token as string | undefined) ??
      (obj.refresh_token as string | undefined) ??
      null;
    const accountId =
      (tokens.account_id as string | undefined) ??
      (obj.account_id as string | undefined) ??
      null;

    if (!accessToken) return null;

    const jwt = decodeJwtPayload(accessToken);
    const auth = jwt?.["https://api.openai.com/auth"] as
      | Record<string, unknown>
      | undefined;
    const profile = jwt?.["https://api.openai.com/profile"] as
      | Record<string, unknown>
      | undefined;
    const email = (profile?.email as string) ?? null;
    const planType = (auth?.chatgpt_plan_type as string) ?? null;
    const exp =
      typeof jwt?.exp === "number"
        ? new Date(jwt.exp * 1000).toLocaleString("ru-RU")
        : null;

    return { access_token: accessToken, refresh_token: refreshToken, account_id: accountId, email, plan_type: planType, exp };
  } catch {
    return null;
  }
}

function validate(parsed: ParsedAccount | null): ValidationState | null {
  if (!parsed) return null;
  return {
    access_token: Boolean(parsed.access_token),
    refresh_token: Boolean(parsed.refresh_token),
    account_id: Boolean(parsed.account_id),
    email: parsed.email,
    plan_type: parsed.plan_type,
    exp: parsed.exp,
  };
}

interface AddAccountModalProps {
  onClose: () => void;
  onAdd: (account: ParsedAccount) => void;
}

export function AddAccountModal({ onClose, onAdd }: AddAccountModalProps) {
  const [closing, setClosing] = useState(false);
  const [raw, setRaw] = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);

  const parsed = parseInput(raw);
  const validation = validate(parsed);
  const canAdd = Boolean(validation?.access_token);

  const hasContent = raw.trim().length > 0;
  const isValidJson = hasContent && parsed !== null;
  const isInvalidJson = hasContent && parsed === null;

  const close = () => {
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

  const handleAdd = () => {
    if (parsed) onAdd(parsed);
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
            />
          </div>

          {/* Validation feedback */}
          {validation && (
            <div className={styles.validationList}>
              <div className={`${styles.validationRow} ${validation.access_token ? styles.ok : styles.missing}`}>
                <span className={styles.validationDot} />
                access_token
              </div>
              <div className={`${styles.validationRow} ${validation.refresh_token ? styles.ok : styles.missing}`}>
                <span className={styles.validationDot} />
                refresh_token
              </div>
              <div className={`${styles.validationRow} ${validation.account_id ? styles.ok : styles.missing}`}>
                <span className={styles.validationDot} />
                account_id
              </div>

              {(validation.email || validation.plan_type || validation.exp) && (
                <div className={styles.validationExtra}>
                  {validation.email && (
                    <span className={`${styles.validationChip} ${styles.visible}`}>
                      {validation.email}
                    </span>
                  )}
                  {validation.plan_type && (
                    <span className={`${styles.validationChip} ${styles.visible}`}>
                      {validation.plan_type}
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
          <button type="button" className={styles.autoButton} onClick={() => {}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3l2 2" />
            </svg>
            Найти автоматически
          </button>
          <span className={styles.autoDesc}>
            Найдёт уже готовую авторизацию, если вы входили через&nbsp;Codex самостоятельно
          </span>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={close}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.addButton}
            disabled={!canAdd}
            onClick={handleAdd}
          >
            Добавить
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
