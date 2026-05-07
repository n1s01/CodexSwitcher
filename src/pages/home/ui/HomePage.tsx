import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PagePanel } from "../../../shared/ui/page-panel/PagePanel";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { AnimatedText } from "../../../shared/ui/animated-text/AnimatedText";
import {
  importAccountFromJson,
  listAccounts,
  refreshAllAccounts,
  startCodexAuthorization,
} from "../../accounts/model/account-api";
import type { StoredAccountSummary } from "../../accounts/model/account-types";
import { upsertAccountSummary } from "../../accounts/model/account-utils";
import {
  AccountsIcon,
  CheckIcon,
  ChevronRightIcon,
  ExportIcon,
  PlusIcon,
  RefreshIcon,
} from "../../../shared/ui/icons/AppIcons";
import { AddAccountModal } from "../../accounts/ui/AddAccountModal";
import styles from "./HomePage.module.css";

const LOW_QUOTA_THRESHOLD = 20;
const ACCOUNT_LIST_LIMIT = 4;

type PlanKey = "free" | "go" | "plus" | "pro" | "unknown";

type HomePageProps = {
  onOpenAccounts?: () => void;
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getRemainingUsagePercent(account: StoredAccountSummary) {
  if (typeof account.usage?.usedPercent !== "number") {
    return null;
  }

  return clampPercent(100 - account.usage.usedPercent);
}

function getDisplayName(account: StoredAccountSummary) {
  return account.name?.trim() || account.email.split("@")[0] || account.email;
}

function getPlanKey(planType: string | null): PlanKey {
  const normalizedPlan = planType?.toLowerCase();

  if (
    normalizedPlan === "free" ||
    normalizedPlan === "go" ||
    normalizedPlan === "plus" ||
    normalizedPlan === "pro"
  ) {
    return normalizedPlan;
  }

  return "unknown";
}

function getPlanLabel(planType: string | null) {
  if (!planType) {
    return "Unknown";
  }

  return planType.charAt(0).toUpperCase() + planType.slice(1).toLowerCase();
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

export function HomePage({ onOpenAccounts }: HomePageProps) {
  const { t, formatPercent } = useI18n();
  const [accounts, setAccounts] = useState<StoredAccountSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const loadedAccounts = await listAccounts();

        if (!isMounted) {
          return;
        }

        setAccounts(loadedAccounts);
        setPageError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPageError(error instanceof Error ? error.message : t("accounts.error.generic"));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [t]);

  const handleRefreshQuota = async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setPageError(null);

    try {
      const refreshedAccounts = await refreshAllAccounts();
      setAccounts(refreshedAccounts);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : t("accounts.error.generic"));
    } finally {
      setIsRefreshing(false);
    }
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

  const stats = useMemo(() => {
    const planCounts: Record<PlanKey, number> = {
      free: 0,
      go: 0,
      plus: 0,
      pro: 0,
      unknown: 0,
    };
    const remainingValues: number[] = [];
    let availableAccounts = 0;
    let lowQuotaAccounts = 0;

    for (const account of accounts) {
      planCounts[getPlanKey(account.planType)] += 1;

      const remainingUsage = getRemainingUsagePercent(account);

      if (remainingUsage !== null) {
        remainingValues.push(remainingUsage);

        if (remainingUsage <= LOW_QUOTA_THRESHOLD) {
          lowQuotaAccounts += 1;
        }
      }

      if (account.usage?.allowed === true && account.usage.limitReached === false) {
        availableAccounts += 1;
      }

      if (account.usage?.limitReached === true) {
        lowQuotaAccounts += remainingUsage === null ? 1 : 0;
      }
    }

    const averageRemaining =
      remainingValues.length > 0
        ? remainingValues.reduce((sum, value) => sum + value, 0) / remainingValues.length
        : null;

    return {
      planCounts,
      averageRemaining,
      availableAccounts,
      lowQuotaAccounts,
    };
  }, [accounts]);

  const planSegments = useMemo(
    () =>
      (Object.entries(stats.planCounts) as [PlanKey, number][])
        .filter(([, count]) => count > 0)
        .map(([key, count]) => ({
          key,
          count,
          width: accounts.length > 0 ? (count / accounts.length) * 100 : 0,
        })),
    [accounts.length, stats.planCounts],
  );

  const rankedAccounts = useMemo(
    () =>
      accounts
        .map((account) => ({
          account,
          remainingUsage: getRemainingUsagePercent(account),
        }))
        .filter((item): item is { account: StoredAccountSummary; remainingUsage: number } =>
          item.remainingUsage !== null,
        )
        .sort((left, right) => right.remainingUsage - left.remainingUsage),
    [accounts],
  );

  const bestAccounts = rankedAccounts.slice(0, ACCOUNT_LIST_LIMIT);

  return (
    <PagePanel
      title={t("home.title")}
      subtitle={t("home.subtitle")}
    >
      <section className={styles.page} aria-label={t("home.title")}>
        {pageError && <div className={styles.alert}>{pageError}</div>}

        <div className={styles.actionRow}>
          <button
            className={styles.actionButton}
            type="button"
            onClick={() => setIsModalOpen(true)}
          >
            <span className={styles.actionIcon}><PlusIcon /></span>
            <span>{t("home.actions.add")}</span>
          </button>

          <button
            className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
            type="button"
            onClick={() => void handleRefreshQuota()}
            disabled={isRefreshing || isLoading || accounts.length === 0}
          >
            <RotatingIcon active={isRefreshing} className={styles.actionIcon}>
              <RefreshIcon />
            </RotatingIcon>
            <span>
              {isRefreshing ? t("home.actions.refreshing") : t("home.actions.refresh")}
            </span>
          </button>
        </div>

        <div className={styles.metricGrid}>
          <article className={`${styles.metricCard} ${styles.metricBlue}`}>
            <span className={styles.metricIcon}><AccountsIcon /></span>
            <span className={styles.metricLabel}>{t("home.metric.accounts")}</span>
            <strong className={styles.metricValue}>{isLoading ? "—" : accounts.length}</strong>
            <span className={styles.metricHint}>{t("home.metric.accountsHint")}</span>
          </article>

          <article className={`${styles.metricCard} ${styles.metricGreen}`}>
            <span className={styles.metricIcon}><CheckIcon /></span>
            <span className={styles.metricLabel}>{t("home.metric.available")}</span>
            <strong className={styles.metricValue}>{isLoading ? "—" : stats.availableAccounts}</strong>
            <span className={styles.metricHint}>{t("home.metric.availableHint")}</span>
          </article>

          <article className={`${styles.metricCard} ${styles.metricViolet}`}>
            <span className={styles.metricIcon}>%</span>
            <span className={styles.metricLabel}>{t("home.metric.averageLimit")}</span>
            <strong className={styles.metricValue}>{formatPercent(stats.averageRemaining)}</strong>
            <span className={styles.metricHint}>{t("home.metric.averageLimitHint")}</span>
          </article>

          <article className={`${styles.metricCard} ${styles.metricOrange}`}>
            <span className={styles.metricIcon}>!</span>
            <span className={styles.metricLabel}>{t("home.metric.lowQuota")}</span>
            <strong className={styles.metricValue}>{isLoading ? "—" : stats.lowQuotaAccounts}</strong>
            <span className={styles.metricHint}>{t("home.metric.lowQuotaHint")}</span>
          </article>
        </div>

        <div className={styles.contentGrid}>
          <article className={styles.surface}>
            <div className={styles.surfaceHeader}>
              <AnimatedText as="h3" className={styles.surfaceTitle}>{t("home.plans.title")}</AnimatedText>
              <span className={styles.surfaceMeta}>{isLoading ? "—" : accounts.length}</span>
            </div>

            {accounts.length === 0 ? (
              <div className={styles.emptyBlock}>
                {isLoading ? t("home.loading") : t("home.empty.accounts")}
              </div>
            ) : (
              <>
                <div className={styles.planBar} aria-hidden="true">
                  {planSegments.map((segment) => (
                    <span
                      key={segment.key}
                      className={`${styles.planSegment} ${styles[`plan_${segment.key}`]}`}
                      style={{ width: `${segment.width}%` }}
                    />
                  ))}
                </div>

                <div className={styles.planList}>
                  {planSegments.map((segment) => (
                    <div key={segment.key} className={styles.planRow}>
                      <span className={`${styles.planDot} ${styles[`plan_${segment.key}`]}`} />
                      <span className={styles.planName}>{t(`home.plan.${segment.key}`)}</span>
                      <span className={styles.planCount}>{segment.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>

          <article className={styles.surface}>
            <div className={styles.surfaceHeader}>
              <AnimatedText as="h3" className={styles.surfaceTitle}>{t("home.best.title")}</AnimatedText>
              <span className={styles.surfaceMeta}>{isLoading ? "—" : bestAccounts.length}</span>
            </div>

            {bestAccounts.length === 0 ? (
              <div className={styles.emptyBlock}>
                {isLoading ? t("home.loading") : t("home.best.empty")}
              </div>
            ) : (
              <div className={styles.accountList}>
                {bestAccounts.map(({ account, remainingUsage }) => (
                  <div key={account.id} className={styles.accountRow}>
                    <div className={styles.accountAvatar}>{getDisplayName(account).slice(0, 2).toUpperCase()}</div>
                    <div className={styles.accountCopy}>
                      <span className={styles.accountName}>{getDisplayName(account)}</span>
                      <span className={styles.accountMeta}>{getPlanLabel(account.planType)}</span>
                    </div>
                    <span className={styles.accountQuota}>{formatPercent(remainingUsage)}</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        <div className={styles.bottomGrid}>
          <button className={styles.linkPanel} type="button" onClick={onOpenAccounts}>
            <span>{t("home.actions.openAccounts")}</span>
            <span className={styles.linkIcon}><ChevronRightIcon /></span>
          </button>

          <button className={`${styles.linkPanel} ${styles.exportPanel}`} type="button">
            <span>{t("home.actions.export")}</span>
            <span className={styles.linkIcon}><ExportIcon /></span>
          </button>
        </div>

        {isModalOpen && (
          <AddAccountModal
            onClose={() => setIsModalOpen(false)}
            onAdd={handleImportAccount}
            onAuthorize={handleAuthorizeAccount}
          />
        )}
      </section>
    </PagePanel>
  );
}
