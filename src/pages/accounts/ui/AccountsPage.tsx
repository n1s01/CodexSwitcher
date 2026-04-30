import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AccountEmptyIcon,
  ChevronDownIcon,
  CopyIcon,
  FilterIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  SwitchIcon,
  TrashIcon,
} from "../../../shared/ui/icons/AppIcons";
import {
  deleteAccount,
  exportAccountJson,
  importAccountFromJson,
  listAccounts,
  refreshAllAccounts,
  startCodexAuthorization,
} from "../model/account-api";
import {
  formatDateOnly,
  formatPercent,
  upsertAccountSummary,
} from "../model/account-utils";
import type { StoredAccountSummary } from "../model/account-types";
import { AddAccountModal } from "./AddAccountModal";
import { ConfirmModal } from "./ConfirmModal";
import styles from "./AccountsPage.module.css";

const subscriptionOptions = ["Все", "Free", "Go", "Plus", "Pro"] as const;

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Не удалось выполнить операцию.";
}

function matchesSubscription(
  account: StoredAccountSummary,
  filter: SubscriptionFilter,
) {
  if (filter === "Все") {
    return true;
  }

  return account.planType?.toLowerCase() === filter.toLowerCase();
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

async function copyTextToClipboard(text: string) {
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
    throw new Error("Не удалось скопировать JSON аккаунта.");
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

export function AccountsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] =
    useState<SubscriptionFilter>("Все");
  const [isSubscriptionMenuOpen, setIsSubscriptionMenuOpen] = useState(false);
  const [compactLevel, setCompactLevel] = useState<0 | 1 | 2 | 3>(0);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<StoredAccountSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(
    null,
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const pageRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);

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
    const account = await importAccountFromJson(rawJson);
    setAccounts((current) => upsertAccountSummary(current, account));
    setPageError(null);
  };

  const handleAuthorizeAccount = async () => {
    const account = await startCodexAuthorization();
    setAccounts((current) => upsertAccountSummary(current, account));
    setPageError(null);
  };

  const handleRefreshAccounts = async () => {
    setIsRefreshing(true);
    setPageError(null);

    try {
      const nextAccounts = await refreshAllAccounts();
      setAccounts(nextAccounts);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyAccount = async (accountId: string) => {
    try {
      const rawJson = await exportAccountJson(accountId);
      await copyTextToClipboard(rawJson);
      setPageError(null);
      setCopiedAccountId(accountId);

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
      aria-label="Аккаунты"
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
              aria-label={isSearchCollapsed ? "Открыть поиск" : "Поиск"}
              title={isSearchCollapsed ? "Поиск по почте" : undefined}
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
              placeholder="Поиск по почте или account id"
              aria-label="Поиск по почте или account id"
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
              aria-label={`Фильтр по подписке: ${subscriptionFilter}`}
              title="Фильтр по подписке"
            >
              <span className={styles.buttonIcon} aria-hidden="true">
                <FilterIcon />
              </span>
              <span className={styles.buttonText}>{subscriptionFilter}</span>
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
                aria-label="Выбор подписки"
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
                    <span className={styles.optionText}>{option}</span>
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
            aria-label="Добавить аккаунт"
            title="Добавить аккаунт"
            onClick={() => setIsModalOpen(true)}
          >
            <span className={styles.buttonIcon} aria-hidden="true">
              <PlusIcon />
            </span>
            <span className={styles.buttonText}>Добавить аккаунт</span>
          </button>

          <button
            className={`${styles.controlButton} ${
              !showRefreshLabel ? styles.controlButtonIconOnly : ""
            }`}
            type="button"
            aria-label="Обновить информацию"
            title="Обновить информацию"
            onClick={handleRefreshAccounts}
            disabled={isRefreshing || isLoading || !hasAccounts}
          >
            <span className={styles.buttonIcon} aria-hidden="true">
              <RefreshIcon />
            </span>
            <span className={styles.buttonText}>
              {isRefreshing ? "Обновляем..." : "Обновить информацию"}
            </span>
          </button>
        </div>
      </div>

      <div className={styles.accountsSurface}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyCopy}>
              <h2 className={styles.emptyTitle}>Загружаем аккаунты</h2>
              <p className={styles.emptyText}>
                Читаем локальное хранилище и готовим список аккаунтов.
              </p>
            </div>
          </div>
        ) : !hasVisibleAccounts ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon} aria-hidden="true">
              <AccountEmptyIcon />
            </div>
            <div className={styles.emptyCopy}>
              <h2 className={styles.emptyTitle}>
                {hasAccounts ? "Ничего не найдено" : "Аккаунтов пока нет"}
              </h2>
              <p className={styles.emptyText}>
                {hasAccounts
                  ? "Попробуйте изменить поиск или фильтр по подписке."
                  : "Добавленные аккаунты появятся здесь вместе с почтой, подпиской и актуальной информацией."}
              </p>
              {pageError && <p className={styles.errorText}>{pageError}</p>}
            </div>
          </div>
        ) : (
          <div className={styles.accountsContent}>
            {pageError && (
              <div className={styles.surfaceAlert}>{pageError}</div>
            )}

            <div className={styles.accountsHeader}>
              <div className={styles.accountsHeaderTitle}>
                Сохраненные аккаунты
              </div>
              <div className={styles.accountsHeaderMeta}>
                {filteredAccounts.length} из {accounts.length}
              </div>
            </div>

            <div className={styles.accountGrid}>
              {filteredAccounts.map((account) => {
                const displayName = getDisplayName(account);
                const remainingUsagePercent = getRemainingUsagePercent(account);
                const usageHint = account.syncError
                  ? account.syncError
                  : !account.usage
                    ? "Нет данных по лимиту."
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
                            {account.planType
                              ? account.planType.charAt(0).toUpperCase() +
                                account.planType.slice(1).toLowerCase()
                              : "Unknown"}
                          </span>
                        </div>

                        <div className={styles.cardEmail} title={account.email}>
                          {account.email}
                        </div>
                      </div>
                    </div>

                    <div className={styles.usageBlock}>
                      <span className={styles.usageLabel}>Использование</span>

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
                        <div className={styles.usageHint}>{usageHint}</div>
                      )}
                    </div>

                    <div className={styles.cardMeta}>
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardMetaLabel}>Добавлен</span>
                        <span className={styles.cardMetaValue}>
                          {formatDateOnly(account.createdAt)}
                        </span>
                      </div>
                      <div
                        className={styles.cardMetaDivider}
                        aria-hidden="true"
                      />
                      <div className={styles.cardMetaItem}>
                        <span className={styles.cardMetaLabel}>
                          Сброс лимита
                        </span>
                        <span className={styles.cardMetaValue}>
                          {formatDateOnly(account.usage?.resetAt)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={`${styles.actionButton} ${
                          copiedAccountId === account.id
                            ? styles.actionButtonActive
                            : ""
                        }`}
                        onClick={() => handleCopyAccount(account.id)}
                        title={
                          copiedAccountId === account.id
                            ? "Скопировано"
                            : "Скопировать JSON"
                        }
                        aria-label={
                          copiedAccountId === account.id
                            ? "Скопировано"
                            : "Скопировать JSON"
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
                        title="Переключиться на этот аккаунт"
                        aria-label="Переключиться"
                      >
                        <span className={styles.actionIcon}>
                          <SwitchIcon />
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                        onClick={() => setPendingDeleteId(account.id)}
                        disabled={deletingAccountId === account.id}
                        title="Удалить аккаунт"
                        aria-label="Удалить аккаунт"
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
              title="Удалить аккаунт?"
              description={`Аккаунт «${name}» будет удалён из списка аккаунтов.`}
              confirmLabel="Удалить"
              variant="danger"
              onConfirm={() => handleDeleteAccount(pendingDeleteId)}
              onClose={() => setPendingDeleteId(null)}
            />
          );
        })()}

      {pendingSwitchId &&
        (() => {
          const account = accounts.find((a) => a.id === pendingSwitchId);
          const name = account ? getDisplayName(account) : "";
          return (
            <ConfirmModal
              title="Переключить аккаунт?"
              description={`Если Codex запущен, он будет принудительно завершён для перезапуска с новой сессией.`}
              confirmLabel="Переключиться"
              variant="default"
              onConfirm={() => Promise.resolve()}
              onClose={() => setPendingSwitchId(null)}
            />
          );
        })()}
    </section>
  );
}
