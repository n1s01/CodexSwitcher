import { invoke } from "@tauri-apps/api/core";
import type { StoredAccountSummary } from "./account-types";

export function listAccounts() {
  return invoke<StoredAccountSummary[]>("list_accounts");
}

export function importAccountFromJson(rawJson: string) {
  return invoke<StoredAccountSummary>("import_account_from_json", { rawJson });
}

export function startCodexAuthorization() {
  return invoke<StoredAccountSummary>("start_codex_authorization");
}

export function refreshAllAccounts() {
  return invoke<StoredAccountSummary[]>("refresh_all_accounts");
}

export function exportAccountJson(id: string) {
  return invoke<string>("export_account_json", { id });
}

export function deleteAccount(id: string) {
  return invoke<StoredAccountSummary[]>("delete_account", { id });
}
