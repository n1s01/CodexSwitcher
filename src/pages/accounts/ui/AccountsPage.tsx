import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AccountEmptyIcon,
  ChevronDownIcon,
  FilterIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
} from "../../../shared/ui/icons/AppIcons";
import { AddAccountModal } from "./AddAccountModal";
import styles from "./AccountsPage.module.css";

const subscriptionOptions = ["Все", "Free", "Go", "Plus", "Pro"] as const;

type SubscriptionFilter = (typeof subscriptionOptions)[number];

const COMPACT_BREAKPOINTS = [
  { max: 720, level: 1 },
  { max: 560, level: 2 },
  { max: 440, level: 3 },
] as const;

function resolveCompactLevel(width: number): 0 | 1 | 2 | 3 {
  for (const breakpoint of COMPACT_BREAKPOINTS) {
    if (width < breakpoint.max) {
      return breakpoint.level;
    }
  }
  return 0;
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
  const pageRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
              placeholder="Поиск по почте"
              aria-label="Поиск по почте"
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
          >
            <span className={styles.buttonIcon} aria-hidden="true">
              <RefreshIcon />
            </span>
            <span className={styles.buttonText}>Обновить информацию</span>
          </button>
        </div>
      </div>

      <div className={styles.accountsSurface}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            <AccountEmptyIcon />
          </div>
          <div className={styles.emptyCopy}>
            <h2 className={styles.emptyTitle}>Аккаунтов пока нет</h2>
            <p className={styles.emptyText}>
              Добавленные аккаунты появятся здесь вместе с почтой, подпиской и
              актуальной информацией.
            </p>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <AddAccountModal
          onClose={() => setIsModalOpen(false)}
          onAdd={(account) => {
            console.log("account added", account);
            setIsModalOpen(false);
          }}
        />
      )}
    </section>
  );
}
