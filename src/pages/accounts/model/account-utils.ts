import type { ParsedAccountImport, StoredAccountSummary } from "./account-types";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseAccountImport(raw: string): ParsedAccountImport | null {
  if (!raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const tokenBag = (parsed.tokens as Record<string, unknown> | undefined) ?? parsed;
    const accessToken =
      (tokenBag.access_token as string | undefined) ??
      (parsed.access_token as string | undefined) ??
      null;

    if (!accessToken) {
      return null;
    }

    const refreshToken =
      (tokenBag.refresh_token as string | undefined) ??
      (parsed.refresh_token as string | undefined) ??
      null;
    const accountId =
      (tokenBag.account_id as string | undefined) ??
      (parsed.account_id as string | undefined) ??
      null;

    const jwt = decodeJwtPayload(accessToken);
    const auth = jwt?.["https://api.openai.com/auth"] as
      | Record<string, unknown>
      | undefined;
    const profile = jwt?.["https://api.openai.com/profile"] as
      | Record<string, unknown>
      | undefined;

    return {
      name: null,
      accessToken,
      refreshToken,
      accountId,
      email: (profile?.email as string | undefined) ?? null,
      planType: (auth?.chatgpt_plan_type as string | undefined) ?? null,
      exp: typeof jwt?.exp === "number" ? jwt.exp : null,
    };
  } catch {
    return null;
  }
}

export function upsertAccountSummary(
  current: StoredAccountSummary[],
  next: StoredAccountSummary,
): StoredAccountSummary[] {
  const index = current.findIndex((account) => account.id === next.id);
  const draft = [...current];

  if (index >= 0) {
    draft[index] = next;
  } else {
    draft.push(next);
  }

  return draft.sort((left, right) => left.email.localeCompare(right.email, "ru"));
}

export function formatDateOnly(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

export function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "—";
  }

  return `${Math.round(value)}%`;
}
