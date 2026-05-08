import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  AccountEmptyIcon,
  ChevronDownIcon,
  CopyIcon,
  FilterIcon,
  PlusIcon,
  RefreshIcon,
  RefreshSingleIcon,
  SearchIcon,
  SwitchIcon,
  TrashIcon,
} from "../../../shared/ui/icons/AppIcons";
import {
  deleteAccount,
  exportAccountJson,
  importAccountFromJson,
  listAccounts,
  refreshAccount,
  refreshAllAccounts,
  startCodexAuthorization,
  switchAccount,
} from "../model/account-api";
import {
  upsertAccountSummary,
} from "../model/account-utils";
import type { StoredAccountSummary } from "../model/account-types";
import { AddAccountModal } from "./AddAccountModal";
import { ConfirmModal } from "./ConfirmModal";
import styles from "./AccountsPage.module.css";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { AnimatedText } from "../../../shared/ui/animated-text/AnimatedText";
import { useToast } from "../../../shared/ui/toast/ToastProvider";

const subscriptionOptions = ["all", "free", "go", "plus", "pro"] as const;

type SubscriptionFilter = (typeof subscriptionOptions)[number];

const COMPACT_BREAKPOINTS = [
  { max: 720, level: 1 },
  { max: 560, level: 2 },
  { max: 440, level: 3 },
] as const;
const DISPLAY_NAME_MAX_LENGTH = 28;
const COPY_FEEDBACK_TIMEOUT_MS = 1800;

function resolveCompactLevel(width: number): 0 | 1 | 2 | 3 {
  for (const breakpoint of COMPACT_BREAKPOINTS) {
    if (width < breakpoint.max) {
      return breakpoint.level;
    }
  }
  return 0;
}

function matchesSubscription(
  account: StoredAccountSummary,
  filter: SubscriptionFilter,
) {
  if (filter === "all") {
    return true;
  }

  return account.planType?.toLowerCase() === filter;
}

function matchesSearch(account: StoredAccountSummary, query: string) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  return (
    account.name?.toLowerCase().includes(normalizedQuery) === true ||
    account.email.toLowerCase().includes(normalizedQuery) ||
    account.accountId?.toLowerCase().includes(normalizedQuery) === true
  );
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function getDisplayName(account: StoredAccountSummary) {
  const fallbackName = account.email.split("@")[0] ?? account.email;
  const source = account.name?.trim() || fallbackName.trim() || account.email;
  return truncateText(source, DISPLAY_NAME_MAX_LENGTH);
}

function getPlanBadgeTone(planType: string | null) {
  switch (planType?.toLowerCase()) {
    case "free":
      return styles.planBadgeFree;
    case "go":
      return styles.planBadgeGo;
    case "plus":
      return styles.planBadgePlus;
    case "pro":
      return styles.planBadgePro;
    default:
      return styles.planBadgeDefault;
  }
}

function getRemainingUsagePercent(account: StoredAccountSummary) {
  if (typeof account.usage?.usedPercent !== "number") {
    return null;
  }

  return Math.max(0, Math.min(100, 100 - account.usage.usedPercent));
}

async function copyTextToClipboard(text: string, errorMessage: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back to a hidden textarea if clipboard API is unavailable.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.append(textarea);
  textarea.select();

  const success = document.execCommand("copy");
  textarea.remove();

  if (!success) {
    throw new Error(errorMessage);
  }
}

function getAvatarText(account: StoredAccountSummary) {
  const source = account.name?.trim() || account.email.trim();

  if (!source) {
    return "??";
  }

  const words = source
    .replace(/[@._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return source.slice(0, 2).toUpperCase();
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function RotatingIcon({
  active,
  className,
  children,
}: {
  active: boolean;
  className: string;
  children: ReactNode;
}) {
  const frameRef = useRef<number | null>(null);
  const angleRef = useRef(0);
  const previousTimeRef = useRef<number | null>(null);
  const [angle, setAngle] = useState(0);
  const [transition, setTransition] = useState("transform 420ms cubic-bezier(0.22, 1, 0.36, 1)");

  useEffect(() => {
    if (!active) {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      previousTimeRef.current = null;

      const currentAngle = angleRef.current;
      const normalizedAngle = currentAngle % 360;
      const settleAngle = normalizedAngle === 0 ? currentAngle : currentAngle + (360 - normalizedAngle);

      setTransition("transform 420ms cubic-bezier(0.16, 1, 0.3, 1)");
      angleRef.current = settleAngle;
      setAngle(settleAngle);
      return undefined;
    }

    setTransition("none");

    const step = (time: number) => {
      const previousTime = previousTimeRef.current ?? time;
      const delta = time - previousTime;
      previousTimeRef.current = time;

      angleRef.current += delta * 0.42;
      setAngle(angleRef.current);
      frameRef.current = window.requestAnimationFrame(step);
    };

    frameRef.current = window.requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      previousTimeRef.current = null;
    };
  }, [active]);

  return (
    <span
      className={className}
      style={{
        transform: `rotate(${angle}deg)`,
        transition,
        willChange: active ? "transform" : undefined,
      }}
    >
      {children}
    </span>
  );
}

export function AccountsPage() {
  const { t, formatDateTime, formatPercent } = useI18n();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] =
    useState<SubscriptionFilter>("all");
  const [isSubscriptionMenuOpen, setIsSubscriptionMenuOpen] = useState(false);
  const [compactLevel, setCompactLevel] = useState<0 | 1 | 2 | 3>(0);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<StoredAccountSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingAccountIds, setRefreshingAccountIds] = useState<string[]>(
    [],
  );
  const [pageError, setPageError] = useState<string | null>(null);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(
    null,
  );
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(
    null,
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const pageRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);
  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return t("accounts.error.generic");
  };

  useLayoutEffect(() => {
    const page = pageRef.current;

    if (!page) {
      return undefined;
    }

    setCompactLevel(resolveCompactLevel(page.getBoundingClientRect().width));

    const observer = new ResizeObserver(([entry]) => {
      setCompactLevel(resolveCompactLevel(entry.contentRect.width));
    });

    observer.observe(page);

    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        setIsReady(true);
      });
    });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    void (async () => {
      try {
        const loadedAccounts = await listAccounts();
        setAccounts(loadedAccounts);
      } catch (error) {
        setPageError(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (compactLevel < 3) {
      setIsSearchExpanded(false);
    }
  }, [compactLevel]);

  useEffect(() => {
    if (isSearchExpanded) {
      searchInputRef.current?.focus();
    }
  }, [isSearchExpanded]);

  useEffect(() => {
    if (!isSubscriptionMenuOpen && !isSearchExpanded) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!filterRef.current?.contains(target)) {
        setIsSubscriptionMenuOpen(false);
      }

      if (!toolbarRef.current?.contains(target)) {
        setIsSearchExpanded(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSubscriptionMenuOpen(false);
        setIsSearchExpanded(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSearchExpanded, isSubscriptionMenuOpen]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleSelectSubscription = (option: SubscriptionFilter) => {
    setSubscriptionFilter(option);
    setIsSubscriptionMenuOpen(false);
  };

  const handleFilterToggle = () => {
    setIsSubscriptionMenuOpen((current) => !current);
  };

  const handleSearchIconClick = () => {
    if (compactLevel < 3) {
      return;
    }
    setIsSearchExpanded((current) => !current);
  };

  const handleImportAccount = async (rawJson: string) => {
    const importedAccounts = await importAccountFromJson(rawJson);
    setAccounts((current) =>
      importedAccounts.reduce(
        (nextAccounts, account) => upsertAccountSummary(nextAccounts, account),
        current,
      ),
    );
    setPageError(null);
    showToast({
      tone: "success",
      title: t("accounts.toast.importedTitle"),
      description: t("accounts.toast.importedDescription", {
        count: importedAccounts.length,
      }),
    });
  };

  const handleAuthorizeAccount = async () => {
    const account = await startCodexAuthorization();
    setAccounts((current) => upsertAccountSummary(current, account));
    setPageError(null);
  };

  const handleRefreshAccounts = async (silent = false) => {
    if (isRefreshingRef.current) {
      return;
    }

    setIsRefreshing(true);

    if (!silent) {
      setPageError(null);
    }

    try {
      const nextAccounts = await refreshAllAccounts();
      setAccounts(nextAccounts);

      if (!silent) {
        showToast({
          tone: "success",
          title: t("accounts.toast.refreshedTitle"),
          description: t("accounts.toast.refreshedDescription", {
            count: nextAccounts.length,
          }),
        });
      }

      if (!silent) {
        setPageError(null);
      }
    } catch (error) {
      setPageError(getErrorMessage(error));

      if (!silent) {
        showToast({
          tone: "error",
          title: t("accounts.toast.refreshFailedTitle"),
          description: getErrorMessage(error),
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshAccount = async (accountId: string) => {
    setRefreshingAccountIds((current) =>
      current.includes(accountId) ? current : [...current, accountId],
    );
    setPageError(null);

    try {
      const nextAccount = await refreshAccount(accountId);
      setAccounts((current) => upsertAccountSummary(current, nextAccount));
      showToast({
        tone: "success",
        title: t("accounts.toast.refreshedOneTitle"),
        description: t("accounts.toast.refreshedOneDescription", {
          name: getDisplayName(nextAccount),
        }),
      });
    } catch (error) {
      setPageError(getErrorMessage(error));
      showToast({
        tone: "error",
        title: t("accounts.toast.refreshFailedTitle"),
        description: getErrorMessage(error),
      });
    } finally {
      setRefreshingAccountIds((current) =>
        current.filter((currentId) => currentId !== accountId),
      );
    }
  };

  const handleCopyAccount = async (accountId: string) => {
    try {
      const rawJson = await exportAccountJson(accountId);
      await copyTextToClipboard(rawJson, t("accounts.copy.error"));
      setPageError(null);
      setCopiedAccountId(accountId);
      showToast({
        tone: "info",
        title: t("accounts.copy.done"),
        description: t("accounts.copy.doneDescription"),
        durationMs: 2200,
      });

      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }

      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCopiedAccountId((current) =>
          current === accountId ? null : current,
        );
      }, COPY_FEEDBACK_TIMEOUT_MS);
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    setDeletingAccountId(accountId);
    setPageError(null);

    try {
      const nextAccounts = await deleteAccount(accountId);
      setAccounts(nextAccounts);
      setCopiedAccountId((current) => (current === accountId ? null : current));
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setDeletingAccountId((current) =>
        current === accountId ? null : current,
      );
    }
  };

  const handleSwitchAccount = async (accountId: string) => {
    setSwitchingAccountId(accountId);
    setPageError(null);

    try {
      await switchAccount(accountId);
      setPendingSwitchId(null);
    } catch (error) {
      setPageError(getErrorMessage(error));
      throw error;
    } finally {
      setSwitchingAccountId((current) =>
        current === accountId ? null : current,
      );
    }
  };

  const filteredAccounts = accounts.filter(
    (account) =>
      matchesSubscription(account, subscriptionFilter) &&
      matchesSearch(account, searchQuery.trim()),
  );

  const showAddLabel = compactLevel === 0;
  const showRefreshLabel = compactLevel === 0;
  const showFilterLabel = compactLevel < 2;
  const isSearchCollapsed = compactLevel >= 3 && !isSearchExpanded;
  const forceFilterCollapsed = compactLevel >= 3 && isSearchExpanded;

  const compactClassName =
    compactLevel === 0
      ? ""
      : compactLevel === 1
        ? styles.pageCompact1
        : compactLevel === 2
          ? styles.pageCompact2
          : styles.pageCompact3;

  const hasAccounts = accounts.length > 0;
  const hasVisibleAccounts = filteredAccounts.length > 0;

  return (
    <section
      ref={pageRef}
      className={`${styles.page} ${compactClassName}`}
      data-ready={isReady ? "" : undefined}
      aria-label={t("accounts.page.aria")}
    >
      <div
        className={`${styles.toolbar} ${isSearchExpanded ? styles.toolbarSearchExpanded : ""}`}
        ref={toolbarRef}
      >
        <div className={styles.leftGroup}>
          <label
            className={`${styles.searchField} ${isSearchCollapsed ? styles.searchFieldCollapsed : ""}`}
          >
            <button
              type="button"
              className={styles.searchIconButton}
              onClick={handleSearchIconClick}
              tabIndex={isSearchCollapsed ? 0 : -1}
              aria-label={isSearchCollapsed ? t("accounts.search.open") : t("accounts.search.label")}
              title={isSearchCollapsed ? t("accounts.search.title") : undefined}
            >
              <span className={styles.fieldIcon} aria-hidden="true">
                <SearchIcon />
              </span>
            </button>
            <input
              ref={searchInputRef}
              className={styles.searchInput}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("accounts.search.placeholder")}
              aria-label={t("accounts.search.placeholder")}
              aria-hidden={isSearchCollapsed}
              tabIndex={isSearchCollapsed ? -1 : 0}
            />
          </label>

          <div
            className={`${styles.filterWrap} ${
              !showFilterLabel || forceFilterCollapsed
                ? styles.filterWrapIconOnly
                : ""
            }`}
            ref={filterRef}
          >
            <button
              className={`${styles.controlButton} ${styles.filterButton} ${
                !showFilterLabel || forceFilterCollapsed
                  ? styles.controlButtonIconOnly
                  : ""
              }`}
              type="button"
              onClick={handleFilterToggle}
              aria-haspopup="listbox"
              aria-expanded={isSubscriptionMenuOpen}
              aria-label={t("accounts.filter.label", {
                value: t(`accounts.subscription.${subscriptionFilter}`),
              })}
              title={t("accounts.filter.title")}
            >
              <span className={styles.buttonIcon} aria-hidden="true">
                <FilterIcon />
              </span>
              <span className={styles.buttonText}>
                <AnimatedText>{t(`accounts.subscription.${subscriptionFilter}`)}</AnimatedText>
              </span>
              <span
                className={`${styles.chevron} ${isSubscriptionMenuOpen ? styles.chevronOpen : ""}`}
                aria-hidden="true"
              >
                <ChevronDownIcon />
              </span>
            </button>

            {isSubscriptionMenuOpen && (
              <div
                className={styles.filterMenu}
                role="listbox"
                aria-label={t("accounts.filter.menu")}
              >
                {subscriptionOptions.map((option) => (
                  <button
                    key={option}
                    className={`${styles.filterOption} ${
                      option === subscriptionFilter
                        ? styles.filterOptionActive
                        : ""
                    }`}
                    type="button"
                    role="option"
                    aria-selected={option === subscriptionFilter}
                    onClick={() => handleSelectSubscription(option)}
                  >
                    <span
                      className={styles.optionStatusDot}
                      aria-hidden="true"
                    />
                    <span className={styles.optionText}>
                      <AnimatedText>{t(`accounts.subscription.${option}`)}</AnimatedText>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.rightGroup}>
          <button
            className={`${styles.controlButton} ${styles.primaryButton} ${
              !showAddLabel ? styles.controlButtonIconOnly : ""
            }`}
            type="button"
            aria-label={t("accounts.actions.add")}
            title={t("accounts.actions.add")}
            onClick={() => setIsModalOpen(true)}
          >
            <span className={styles.buttonIcon} aria-hidden="true">
              <PlusIcon />
            </span>
            <span className={styles.buttonText}><AnimatedText>{t("accounts.actions.add")}</AnimatedText></span>
          </button>

          <button
            className={`${styles.controlButton} ${
              !showRefreshLabel ? styles.controlButtonIconOnly : ""
            }`}
            type="button"
            aria-label={t("accounts.actions.refresh")}
            title={t("accounts.actions.refresh")}
            onClick={() => void handleRefreshAccounts()}
            disabled={isRefreshing || isLoading || !hasAccounts}
          >
            <RotatingIcon active={isRefreshing} className={styles.buttonIcon}>
              <RefreshIcon />
            </RotatingIcon>
            <span className={styles.buttonText}>
              <AnimatedText>
                {isRefreshing
                  ? t("accounts.actions.refreshing")
                  : t("accounts.actions.refresh")}
              </AnimatedText>
            </span>
          </button>
        </div>
      </div>

      <div className={styles.accountsSurface}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyCopy}>
              <AnimatedText as="h2" className={styles.emptyTitle}>{t("accounts.state.loadingTitle")}</AnimatedText>
              <AnimatedText as="p" className={styles.emptyText}>
                {t("accounts.state.loadingText")}
              </AnimatedText>
            </div>
          </div>
        ) : !hasVisibleAccounts ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon} aria-hidden="true">
              <AccountEmptyIcon />
            </div>
            <div className={styles.emptyCopy}>
              <AnimatedText as="h2" className={styles.emptyTitle}>
                {hasAccounts
                  ? t("accounts.state.emptyFilteredTitle")
                  : t("accounts.state.emptyTitle")}
              </AnimatedText>
              <AnimatedText as="p" className={styles.emptyText}>
                {hasAccounts
                  ? t("accounts.state.emptyFilteredText")
                  : t("accounts.state.emptyText")}
              </AnimatedText>
              {pageError && <AnimatedText as="p" className={styles.errorText}>{pageError}</AnimatedText>}
            </div>
          </div>
        ) : (
          <div className={styles.accountsContent}>
            {pageError && (
              <div className={styles.surfaceAlert}>{pageError}</div>
            )}

            <div className={styles.accountsHeader}>
              <AnimatedText as="div" className={styles.accountsHeaderTitle}>
                {t("accounts.header.saved")}
              </AnimatedText>
              <AnimatedText as="div" className={styles.accountsHeaderMeta}>
                {t("accounts.header.meta", {
                  visible: filteredAccounts.length,
                  total: accounts.length,
                })}
              </AnimatedText>
            </div>

            <div className={styles.accountGrid}>
              {filteredAccounts.map((account) => {
                const displayName = getDisplayName(account);
                const remainingUsagePercent = getRemainingUsagePercent(account);
                const isAccountRefreshing = refreshingAccountIds.includes(
                  account.id,
                );
                const usageHint = account.syncError
                  ? account.syncError
                  : !account.usage
                    ? t("accounts.usage.missing")
                    : null;

                return (
                  <article key={account.id} className={styles.accountCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.avatarBadge} aria-hidden="true">
                        {getAvatarText(account)}
                      </div>

                      <div className={styles.cardTitleWrap}>
                        <div className={styles.cardTitleRow}>
                          <div
                            className={styles.cardTitle}
                            title={account.name || account.email}
                          >
                            {displayName}
                          </div>

                          <span
                            className={`${styles.planBadge} ${getPlanBadgeTone(account.planType)}`}
                          >
                            <AnimatedText>
                              {account.planType
                                ? account.planType.charAt(0).toUpperCase() +
                                  account.planType.slice(1).toLowerCase()
                                : t("common.unknown")}
                            </AnimatedText>
                          </span>
                        </div>

                        <div className={styles.cardEmail} title={account.email}>
                          {account.email}
                        </div>
                      </div>
                    </div>

                    <div className={styles.usageBlock}>
                      <span className={styles.usageLabel}><AnimatedText>{t("accounts.usage.label")}</AnimatedText></span>

                      <div className={styles.usageBarRow}>
                        <div className={styles.usageBar} aria-hidden="true">
                          <div
                            className={styles.usageBarFill}
                            style={{ width: `${remainingUsagePercent ?? 0}%` }}
                          />
                        </div>
                        <span className={styles.usageValue}>
                          {formatPercent(remainingUsagePercent)}
                        </span>
                      </div>

                      {usageHint && (
                        <AnimatedText as="div" className={styles.usageHint}>{usageHint}</AnimatedText>
                      )}
                    </div>

                    <div className={styles.cardMeta}>
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardMetaLabel}><AnimatedText>{t("accounts.meta.added")}</AnimatedText></span>
                        <span className={styles.cardMetaValue}>
                          {formatDateTime(account.createdAt)}
                        </span>
                      </div>
                      <div
                        className={styles.cardMetaDivider}
                        aria-hidden="true"
                      />
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardMetaLabel}>
                          <AnimatedText>{t("accounts.meta.limitReset")}</AnimatedText>
                        </span>
                        <span className={styles.cardMetaValue}>
                          {formatDateTime(account.usage?.resetAt)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={() => handleRefreshAccount(account.id)}
                        disabled={isRefreshing || isAccountRefreshing}
                        title={t("accounts.actions.refreshOne")}
                        aria-label={t("accounts.actions.refreshOne")}
                      >
                        <RotatingIcon
                          active={isAccountRefreshing}
                          className={styles.actionIcon}
                        >
                          <RefreshSingleIcon />
                        </RotatingIcon>
                      </button>

                      <button
                        type="button"
                        className={`${styles.actionButton} ${
                          copiedAccountId === account.id
                            ? styles.actionButtonActive
                            : ""
                        }`}
                        onClick={() => handleCopyAccount(account.id)}
                        disabled={isRefreshing || isAccountRefreshing}
                        title={
                          copiedAccountId === account.id
                            ? t("accounts.copy.done")
                            : t("accounts.copy.transfer")
                        }
                        aria-label={
                          copiedAccountId === account.id
                            ? t("accounts.copy.done")
                            : t("accounts.copy.transfer")
                        }
                      >
                        <span className={styles.actionIcon}>
                          <CopyIcon />
                        </span>
                      </button>

                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={() => setPendingSwitchId(account.id)}
                        disabled={
                          isRefreshing ||
                          isAccountRefreshing ||
                          switchingAccountId === account.id
                        }
                        title={t("accounts.switch.title")}
                        aria-label={t("accounts.switch.aria")}
                      >
                        <span className={styles.actionIcon}>
                          <SwitchIcon />
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                        onClick={() => setPendingDeleteId(account.id)}
                        disabled={
                          isRefreshing ||
                          isAccountRefreshing ||
                          deletingAccountId === account.id
                        }
                        title={t("accounts.delete.title")}
                        aria-label={t("accounts.delete.aria")}
                      >
                        <span className={styles.actionIcon}>
                          <TrashIcon />
                        </span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <AddAccountModal
          onClose={() => setIsModalOpen(false)}
          onAdd={handleImportAccount}
          onAuthorize={handleAuthorizeAccount}
        />
      )}

      {pendingDeleteId &&
        (() => {
          const account = accounts.find((a) => a.id === pendingDeleteId);
          const name = account ? getDisplayName(account) : "";
          return (
            <ConfirmModal
              title={t("accounts.confirm.deleteTitle")}
              description={t("accounts.confirm.deleteDescription", { name })}
              confirmLabel={t("accounts.confirm.deleteAction")}
              variant="danger"
              onConfirm={() => handleDeleteAccount(pendingDeleteId)}
              onClose={() => setPendingDeleteId(null)}
            />
          );
        })()}

      {pendingSwitchId &&
        (() => {
          const account = accounts.find((a) => a.id === pendingSwitchId);
          const name = account
            ? getDisplayName(account)
            : t("accounts.confirm.fallbackName");
          return (
            <ConfirmModal
              title={t("accounts.confirm.switchTitle")}
              description={t("accounts.confirm.switchDescription", { name })}
              confirmLabel={t("accounts.confirm.switchAction")}
              variant="default"
              onConfirm={() => handleSwitchAccount(pendingSwitchId)}
              onClose={() => setPendingSwitchId(null)}
            />
          );
        })()}
    </section>
  );
}
