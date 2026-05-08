import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { createPortal } from "react-dom";
import styles from "./ToastProvider.module.css";

type ToastTone = "info" | "success" | "error";
type ToastPhase = "opening" | "open" | "closing";

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastItem extends ToastInput {
  id: string;
  tone: ToastTone;
  durationMs: number;
  phase: ToastPhase;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
}

const MAX_VISIBLE_TOASTS = 4;
const DEFAULT_DURATION_MS = 3400;
const COLLAPSE_DURATION_MS = 320;

const ToastContext = createContext<ToastContextValue | null>(null);

function createToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [visibleToasts, setVisibleToasts] = useState<ToastItem[]>([]);
  const [toastHeights, setToastHeights] = useState<Record<string, number>>({});
  const queueRef = useRef<ToastItem[]>([]);
  const innerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dismissTimeoutsRef = useRef<Map<string, number>>(new Map());
  const removalTimeoutsRef = useRef<Map<string, number>>(new Map());
  const openFrameRef = useRef<number | null>(null);

  const clearDismissTimeout = useCallback((toastId: string) => {
    const timeoutId = dismissTimeoutsRef.current.get(toastId);

    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      dismissTimeoutsRef.current.delete(toastId);
    }
  }, []);

  const clearRemovalTimeout = useCallback((toastId: string) => {
    const timeoutId = removalTimeoutsRef.current.get(toastId);

    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      removalTimeoutsRef.current.delete(toastId);
    }
  }, []);

  const flushQueue = useCallback(() => {
    setVisibleToasts((current) => {
      if (current.length >= MAX_VISIBLE_TOASTS || queueRef.current.length === 0) {
        return current;
      }

      const next = [...current];

      while (next.length < MAX_VISIBLE_TOASTS && queueRef.current.length > 0) {
        const queuedToast = queueRef.current.shift();

        if (queuedToast) {
          next.push(queuedToast);
        }
      }

      return next;
    });
  }, []);

  const removeToast = useCallback((toastId: string) => {
    clearDismissTimeout(toastId);
    clearRemovalTimeout(toastId);
    innerRefs.current.delete(toastId);

    setVisibleToasts((current) => current.filter((toast) => toast.id !== toastId));
    setToastHeights((current) => {
      const next = { ...current };
      delete next[toastId];
      return next;
    });

    window.setTimeout(() => {
      flushQueue();
    }, 0);
  }, [clearDismissTimeout, clearRemovalTimeout, flushQueue]);

  const dismissToast = useCallback((toastId: string) => {
    clearDismissTimeout(toastId);
    clearRemovalTimeout(toastId);

    setVisibleToasts((current) =>
      current.map((toast) =>
        toast.id === toastId && toast.phase !== "closing"
          ? { ...toast, phase: "closing" }
          : toast,
      ),
    );

    const timeoutId = window.setTimeout(() => {
      removeToast(toastId);
    }, COLLAPSE_DURATION_MS);

    removalTimeoutsRef.current.set(toastId, timeoutId);
  }, [clearDismissTimeout, clearRemovalTimeout, removeToast]);

  const showToast = useCallback((toast: ToastInput) => {
    const nextToast: ToastItem = {
      id: createToastId(),
      title: toast.title,
      description: toast.description,
      tone: toast.tone ?? "info",
      durationMs: toast.durationMs ?? DEFAULT_DURATION_MS,
      phase: "opening",
    };

    setVisibleToasts((current) => {
      if (current.length < MAX_VISIBLE_TOASTS) {
        return [...current, nextToast];
      }

      queueRef.current.push(nextToast);
      return current;
    });
  }, []);

  useLayoutEffect(() => {
    const nextHeights: Record<string, number> = {};
    let hasChanges = false;

    for (const toast of visibleToasts) {
      const element = innerRefs.current.get(toast.id);

      if (!element) {
        continue;
      }

      const nextHeight = Math.ceil(element.getBoundingClientRect().height);
      nextHeights[toast.id] = nextHeight;

      if (toastHeights[toast.id] !== nextHeight) {
        hasChanges = true;
      }
    }

    if (hasChanges) {
      setToastHeights((current) => ({ ...current, ...nextHeights }));
    }
  }, [toastHeights, visibleToasts]);

  useEffect(() => {
    const openingIds = visibleToasts
      .filter((toast) => toast.phase === "opening")
      .map((toast) => toast.id);

    if (openingIds.length === 0) {
      return undefined;
    }

    openFrameRef.current = window.requestAnimationFrame(() => {
      setVisibleToasts((current) =>
        current.map((toast) =>
          openingIds.includes(toast.id) && toast.phase === "opening"
            ? { ...toast, phase: "open" }
            : toast,
        ),
      );
    });

    return () => {
      if (openFrameRef.current !== null) {
        window.cancelAnimationFrame(openFrameRef.current);
        openFrameRef.current = null;
      }
    };
  }, [visibleToasts]);

  useEffect(() => {
    for (const toast of visibleToasts) {
      if (toast.phase !== "open" || dismissTimeoutsRef.current.has(toast.id)) {
        continue;
      }

      const timeoutId = window.setTimeout(() => {
        dismissToast(toast.id);
      }, toast.durationMs);

      dismissTimeoutsRef.current.set(toast.id, timeoutId);
    }
  }, [dismissToast, visibleToasts]);

  useEffect(() => {
    return () => {
      if (openFrameRef.current !== null) {
        window.cancelAnimationFrame(openFrameRef.current);
      }

      for (const timeoutId of dismissTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }

      for (const timeoutId of removalTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }

      dismissTimeoutsRef.current.clear();
      removalTimeoutsRef.current.clear();
      innerRefs.current.clear();
    };
  }, []);

  const contextValue = useMemo<ToastContextValue>(
    () => ({ showToast }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {createPortal(
        <div className={styles.viewport} aria-live="polite" aria-atomic="true">
          {visibleToasts.map((toast) => {
            const measuredHeight = toastHeights[toast.id] ?? 0;
            const maxHeight =
              toast.phase === "opening"
                ? 0
                : toast.phase === "closing"
                ? 0
                : measuredHeight > 0
                  ? measuredHeight
                  : 120;

            return (
              <div
                key={toast.id}
                className={`${styles.slot} ${
                  toast.phase === "opening"
                    ? styles.slotOpening
                    : toast.phase === "closing"
                      ? styles.slotClosing
                      : styles.slotOpen
                }`}
                style={{
                  maxHeight: `${maxHeight}px`,
                }}
              >
                <div
                  ref={(element) => {
                    if (element) {
                      innerRefs.current.set(toast.id, element);
                    } else {
                      innerRefs.current.delete(toast.id);
                    }
                  }}
                  className={`${styles.toast} ${styles[toast.tone]}`}
                  role="status"
                >
                  <div className={styles.content}>
                    <div className={styles.title}>{toast.title}</div>
                    {toast.description && (
                      <div className={styles.description}>{toast.description}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}
