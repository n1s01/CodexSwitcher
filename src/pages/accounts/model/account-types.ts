export interface UsageSnapshot {
  allowed: boolean;
  limitReached: boolean;
  usedPercent: number | null;
  limitWindowSeconds: number | null;
  resetAfterSeconds: number | null;
  resetAt: number | null;
  fetchedAt: number;
}

export type AccountSource = "manual" | "oauth";

export interface StoredAccountSummary {
  id: string;
  name: string | null;
  email: string;
  accountId: string | null;
  userId: string | null;
  planType: string | null;
  tokenExpiresAt: number;
  lastRefreshAt: number | null;
  lastUsageSyncAt: number | null;
  usage: UsageSnapshot | null;
  source: AccountSource;
  syncError: string | null;
  createdAt: number | null;
}

export interface ParsedAccountImport {
  name: string | null;
  accessToken: string;
  refreshToken: string | null;
  accountId: string | null;
  email: string | null;
  planType: string | null;
  exp: number | null;
}
