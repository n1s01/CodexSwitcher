use std::{
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{
    engine::general_purpose::{URL_SAFE, URL_SAFE_NO_PAD},
    Engine,
};
use rand::{distributions::Alphanumeric, thread_rng, Rng};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, WebviewUrl, WindowEvent};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use url::Url;
use wreq::Client;
use wreq_util::Emulation;

#[cfg(target_os = "windows")]
use window_vibrancy::{apply_acrylic, apply_mica};
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

const ACCOUNTS_FILE_NAME: &str = ".accounts.json";
const AUTH_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
const AUTH_REDIRECT_URI: &str = "http://localhost:1455/auth/callback";
const AUTH_SCOPE: &str = "openid profile email offline_access";
const AUTH_PORT: u16 = 1455;
const AUTH_WINDOW_LABEL: &str = "codex-oauth";
const USAGE_ENDPOINT: &str = "https://chatgpt.com/backend-api/wham/usage";
const TOKEN_ENDPOINT: &str = "https://auth.openai.com/oauth/token";
const AUTHORIZE_ENDPOINT: &str = "https://auth.openai.com/oauth/authorize";
const AUTH_ORIGINATOR: &str = "codex_vscode";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsageSnapshot {
    #[serde(alias = "allowed")]
    allowed: bool,
    #[serde(alias = "limit_reached")]
    limit_reached: bool,
    #[serde(alias = "used_percent")]
    used_percent: Option<f64>,
    #[serde(alias = "limit_window_seconds")]
    limit_window_seconds: Option<u64>,
    #[serde(alias = "reset_after_seconds")]
    reset_after_seconds: Option<u64>,
    #[serde(alias = "reset_at")]
    reset_at: Option<u64>,
    #[serde(alias = "fetched_at")]
    fetched_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum AccountSource {
    Manual,
    Oauth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredAccount {
    #[serde(alias = "id")]
    id: String,
    #[serde(alias = "name")]
    name: Option<String>,
    #[serde(alias = "email")]
    email: String,
    #[serde(alias = "account_id")]
    account_id: Option<String>,
    #[serde(alias = "user_id")]
    user_id: Option<String>,
    #[serde(alias = "plan_type")]
    plan_type: Option<String>,
    #[serde(alias = "access_token")]
    access_token: String,
    #[serde(alias = "refresh_token")]
    refresh_token: Option<String>,
    #[serde(alias = "id_token")]
    id_token: Option<String>,
    #[serde(alias = "token_expires_at")]
    token_expires_at: u64,
    #[serde(alias = "last_refresh_at")]
    last_refresh_at: Option<u64>,
    #[serde(alias = "last_usage_sync_at")]
    last_usage_sync_at: Option<u64>,
    #[serde(alias = "usage")]
    usage: Option<UsageSnapshot>,
    #[serde(alias = "source")]
    source: AccountSource,
    #[serde(alias = "sync_error")]
    sync_error: Option<String>,
    #[serde(alias = "created_at", default)]
    created_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredAccountSummary {
    id: String,
    name: Option<String>,
    email: String,
    account_id: Option<String>,
    user_id: Option<String>,
    plan_type: Option<String>,
    token_expires_at: u64,
    last_refresh_at: Option<u64>,
    last_usage_sync_at: Option<u64>,
    usage: Option<UsageSnapshot>,
    source: AccountSource,
    sync_error: Option<String>,
    created_at: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    expires_in: u64,
    id_token: Option<String>,
    refresh_token: Option<String>,
    token_type: String,
    scope: Option<String>,
}

#[derive(Debug, Clone)]
struct TokenMetadata {
    name: Option<String>,
    email: String,
    account_id: Option<String>,
    user_id: Option<String>,
    plan_type: Option<String>,
    exp: u64,
}

#[derive(Debug, Clone)]
struct ImportedTokenSet {
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    account_id: Option<String>,
}

enum UsageFetchError {
    Unauthorized(String),
    Other(String),
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn fallback_account_email() -> String {
    "Неизвестный аккаунт".to_string()
}

fn accounts_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(ACCOUNTS_FILE_NAME))
}

fn load_accounts(app: &AppHandle) -> Result<Vec<StoredAccount>, String> {
    let path = accounts_file_path(app)?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if content.trim().is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn migrate_account_metadata(account: &mut StoredAccount) -> bool {
    let metadata = parse_token_metadata(&account.access_token, account.id_token.as_deref())
        .or_else(|_| parse_access_token_only_metadata(&account.access_token));

    let Ok(metadata) = metadata else {
        return false;
    };

    let mut changed = false;

    if account.name.is_none() && metadata.name.is_some() {
        account.name = metadata.name;
        changed = true;
    }

    if account.email == fallback_account_email() && !metadata.email.is_empty() {
        account.email = metadata.email;
        changed = true;
    }

    if account.account_id.is_none() && metadata.account_id.is_some() {
        account.account_id = metadata.account_id;
        changed = true;
    }

    if account.user_id.is_none() && metadata.user_id.is_some() {
        account.user_id = metadata.user_id;
        changed = true;
    }

    if account.plan_type.is_none() && metadata.plan_type.is_some() {
        account.plan_type = metadata.plan_type;
        changed = true;
    }

    if account.token_expires_at == 0 && metadata.exp > 0 {
        account.token_expires_at = metadata.exp;
        changed = true;
    }

    if account.id.is_empty() {
        account.id = account
            .account_id
            .clone()
            .or_else(|| account.user_id.clone())
            .unwrap_or_else(|| {
                thread_rng()
                    .sample_iter(&Alphanumeric)
                    .take(18)
                    .map(char::from)
                    .collect()
            });
        changed = true;
    }

    changed
}

fn migrate_accounts(accounts: &mut [StoredAccount]) -> bool {
    let mut changed = false;

    for account in accounts {
        changed |= migrate_account_metadata(account);
    }

    changed
}

fn save_accounts(app: &AppHandle, accounts: &[StoredAccount]) -> Result<(), String> {
    let path = accounts_file_path(app)?;
    let tmp_path = path.with_extension("tmp");
    let payload = serde_json::to_vec_pretty(accounts).map_err(|e| e.to_string())?;

    fs::write(&tmp_path, payload).map_err(|e| e.to_string())?;
    fs::rename(&tmp_path, &path).map_err(|e| e.to_string())
}

fn summary_from_account(account: &StoredAccount) -> StoredAccountSummary {
    StoredAccountSummary {
        id: account.id.clone(),
        name: account.name.clone(),
        email: account.email.clone(),
        account_id: account.account_id.clone(),
        user_id: account.user_id.clone(),
        plan_type: account.plan_type.clone(),
        token_expires_at: account.token_expires_at,
        last_refresh_at: account.last_refresh_at,
        last_usage_sync_at: account.last_usage_sync_at,
        usage: account.usage.clone(),
        source: account.source.clone(),
        sync_error: account.sync_error.clone(),
        created_at: account.created_at,
    }
}

fn decode_jwt_payload(token: &str) -> Result<Value, String> {
    let payload = token
        .split('.')
        .nth(1)
        .ok_or_else(|| "Не удалось разобрать JWT payload".to_string())?;

    let decoded = URL_SAFE_NO_PAD
        .decode(payload)
        .or_else(|_| URL_SAFE.decode(payload))
        .map_err(|e| e.to_string())?;

    serde_json::from_slice(&decoded).map_err(|e| e.to_string())
}

fn parse_token_metadata(
    access_token: &str,
    id_token: Option<&str>,
) -> Result<TokenMetadata, String> {
    let access_payload = decode_jwt_payload(access_token)?;
    let auth = access_payload
        .get("https://api.openai.com/auth")
        .and_then(Value::as_object);

    let id_payload = id_token.and_then(|token| decode_jwt_payload(token).ok());
    let id_profile = id_payload.as_ref().and_then(Value::as_object);
    let access_profile = access_payload
        .get("https://api.openai.com/profile")
        .and_then(Value::as_object);

    let email = id_profile
        .and_then(|profile| profile.get("email"))
        .and_then(Value::as_str)
        .or_else(|| {
            access_profile
                .and_then(|profile| profile.get("email"))
                .and_then(Value::as_str)
        })
        .map(ToOwned::to_owned)
        .unwrap_or_else(fallback_account_email);

    let name = id_profile
        .and_then(|profile| profile.get("name"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);

    let exp = access_payload
        .get("exp")
        .and_then(Value::as_u64)
        .ok_or_else(|| "В access_token нет поля exp".to_string())?;

    Ok(TokenMetadata {
        name,
        email,
        account_id: auth
            .and_then(|auth| auth.get("chatgpt_account_id"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        user_id: auth
            .and_then(|auth| auth.get("chatgpt_user_id"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        plan_type: auth
            .and_then(|auth| auth.get("chatgpt_plan_type"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        exp,
    })
}

fn parse_access_token_only_metadata(access_token: &str) -> Result<TokenMetadata, String> {
    let access_payload = decode_jwt_payload(access_token)?;
    let auth = access_payload
        .get("https://api.openai.com/auth")
        .and_then(Value::as_object);
    let access_profile = access_payload
        .get("https://api.openai.com/profile")
        .and_then(Value::as_object);

    let email = access_profile
        .and_then(|profile| profile.get("email"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .unwrap_or_else(fallback_account_email);

    let exp = access_payload
        .get("exp")
        .and_then(Value::as_u64)
        .ok_or_else(|| "В access_token нет поля exp".to_string())?;

    Ok(TokenMetadata {
        name: None,
        email,
        account_id: auth
            .and_then(|auth| auth.get("chatgpt_account_id"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        user_id: auth
            .and_then(|auth| auth.get("chatgpt_user_id"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        plan_type: auth
            .and_then(|auth| auth.get("chatgpt_plan_type"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        exp,
    })
}

fn parse_imported_tokens(raw_json: &str) -> Result<ImportedTokenSet, String> {
    let value: Value = serde_json::from_str(raw_json).map_err(|e| e.to_string())?;
    let tokens = value.get("tokens").unwrap_or(&value);

    let access_token = tokens
        .get("access_token")
        .and_then(Value::as_str)
        .or_else(|| value.get("access_token").and_then(Value::as_str))
        .ok_or_else(|| "В JSON нет access_token".to_string())?
        .to_string();

    let refresh_token = tokens
        .get("refresh_token")
        .and_then(Value::as_str)
        .or_else(|| value.get("refresh_token").and_then(Value::as_str))
        .map(ToOwned::to_owned);

    let id_token = tokens
        .get("id_token")
        .and_then(Value::as_str)
        .or_else(|| value.get("id_token").and_then(Value::as_str))
        .map(ToOwned::to_owned);

    let account_id = tokens
        .get("account_id")
        .and_then(Value::as_str)
        .or_else(|| value.get("account_id").and_then(Value::as_str))
        .map(ToOwned::to_owned);

    Ok(ImportedTokenSet {
        access_token,
        refresh_token,
        id_token,
        account_id,
    })
}

fn build_stored_account(
    source: AccountSource,
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    account_id_hint: Option<String>,
    token_expires_at_hint: Option<u64>,
) -> Result<StoredAccount, String> {
    let metadata = parse_token_metadata(&access_token, id_token.as_deref())
        .or_else(|_| parse_access_token_only_metadata(&access_token))?;
    let token_expires_at = token_expires_at_hint.unwrap_or(metadata.exp);
    let account_id = metadata.account_id.clone().or(account_id_hint);
    let id = account_id
        .clone()
        .or_else(|| metadata.user_id.clone())
        .unwrap_or_else(|| {
            thread_rng()
                .sample_iter(&Alphanumeric)
                .take(18)
                .map(char::from)
                .collect()
        });

    Ok(StoredAccount {
        id,
        name: metadata.name,
        email: metadata.email,
        account_id,
        user_id: metadata.user_id,
        plan_type: metadata.plan_type,
        access_token,
        refresh_token,
        id_token,
        token_expires_at,
        last_refresh_at: None,
        last_usage_sync_at: None,
        usage: None,
        source,
        sync_error: None,
        created_at: Some(now_unix()),
    })
}

fn upsert_account(accounts: &mut Vec<StoredAccount>, mut account: StoredAccount) {
    if let Some(index) = accounts
        .iter()
        .position(|existing| existing.id == account.id)
    {
        account.created_at = accounts[index].created_at;
        accounts[index] = account;
    } else {
        accounts.push(account);
    }

    accounts.sort_by(|left, right| left.email.to_lowercase().cmp(&right.email.to_lowercase()));
}

fn find_account_by_id<'a>(
    accounts: &'a [StoredAccount],
    id: &str,
) -> Result<&'a StoredAccount, String> {
    accounts
        .iter()
        .find(|account| account.id == id)
        .ok_or_else(|| "Аккаунт не найден".to_string())
}

fn build_http_client() -> Result<Client, String> {
    Client::builder()
        .emulation(Emulation::Chrome131)
        .build()
        .map_err(|e| e.to_string())
}

fn form_body(pairs: &[(&str, &str)]) -> String {
    let mut serializer = url::form_urlencoded::Serializer::new(String::new());
    for (key, value) in pairs {
        serializer.append_pair(key, value);
    }
    serializer.finish()
}

async fn fetch_usage_snapshot(
    client: &Client,
    access_token: &str,
) -> Result<UsageSnapshot, UsageFetchError> {
    let response = client
        .get(USAGE_ENDPOINT)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Accept", "application/json")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Referer", "https://chatgpt.com/")
        .header("Origin", "https://chatgpt.com")
        .send()
        .await
        .map_err(|e| UsageFetchError::Other(e.to_string()))?;

    if response.status().is_success() {
        let value = response
            .json::<Value>()
            .await
            .map_err(|e| UsageFetchError::Other(e.to_string()))?;

        let rate_limit = value.get("rate_limit");
        let primary_window = rate_limit.and_then(|rate| rate.get("primary_window"));

        return Ok(UsageSnapshot {
            allowed: rate_limit
                .and_then(|rate| rate.get("allowed"))
                .and_then(Value::as_bool)
                .unwrap_or(false),
            limit_reached: rate_limit
                .and_then(|rate| rate.get("limit_reached"))
                .and_then(Value::as_bool)
                .unwrap_or(false),
            used_percent: primary_window
                .and_then(|window| window.get("used_percent"))
                .and_then(Value::as_f64),
            limit_window_seconds: primary_window
                .and_then(|window| window.get("limit_window_seconds"))
                .and_then(Value::as_u64),
            reset_after_seconds: primary_window
                .and_then(|window| window.get("reset_after_seconds"))
                .and_then(Value::as_u64),
            reset_at: primary_window
                .and_then(|window| window.get("reset_at"))
                .and_then(Value::as_u64),
            fetched_at: now_unix(),
        });
    }

    let status = response.status().as_u16();
    let body = response.text().await.unwrap_or_default();

    if status == 401 {
        return Err(UsageFetchError::Unauthorized(body));
    }

    Err(UsageFetchError::Other(format!("HTTP {}: {}", status, body)))
}

async fn request_token_refresh(
    client: &Client,
    refresh_token: &str,
) -> Result<OAuthTokenResponse, String> {
    let request_body = form_body(&[
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("client_id", AUTH_CLIENT_ID),
        ("redirect_uri", AUTH_REDIRECT_URI),
    ]);

    let response = client
        .post(TOKEN_ENDPOINT)
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(request_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        let token_response = response
            .json::<OAuthTokenResponse>()
            .await
            .map_err(|e| e.to_string())?;
        return Ok(token_response);
    }

    let status = response.status().as_u16();
    let body = response.text().await.unwrap_or_default();
    Err(format!(
        "Не удалось обновить токен: HTTP {}: {}",
        status, body
    ))
}

fn apply_oauth_response(
    account: &mut StoredAccount,
    response: OAuthTokenResponse,
) -> Result<(), String> {
    let metadata = parse_token_metadata(&response.access_token, response.id_token.as_deref())
        .or_else(|_| parse_access_token_only_metadata(&response.access_token))?;
    let exp = metadata.exp;

    account.name = metadata.name.or_else(|| account.name.clone());
    account.email = metadata.email;
    account.account_id = metadata.account_id.or_else(|| account.account_id.clone());
    account.user_id = metadata.user_id.or_else(|| account.user_id.clone());
    account.plan_type = metadata.plan_type.or_else(|| account.plan_type.clone());
    account.access_token = response.access_token;
    account.refresh_token = response
        .refresh_token
        .or_else(|| account.refresh_token.clone());
    account.id_token = response.id_token.or_else(|| account.id_token.clone());
    account.token_expires_at = exp;
    account.last_refresh_at = Some(now_unix());
    account.sync_error = None;

    let _ = response.token_type;
    let _ = response.scope;

    Ok(())
}

async fn sync_account(client: &Client, account: &mut StoredAccount) {
    match fetch_usage_snapshot(client, &account.access_token).await {
        Ok(snapshot) => {
            account.last_usage_sync_at = Some(snapshot.fetched_at);
            account.usage = Some(snapshot);
            account.sync_error = None;
        }
        Err(UsageFetchError::Unauthorized(_)) => {
            if let Some(refresh_token) = account.refresh_token.clone() {
                match request_token_refresh(client, &refresh_token).await {
                    Ok(response) => {
                        if let Err(error) = apply_oauth_response(account, response) {
                            account.sync_error = Some(error);
                            return;
                        }

                        match fetch_usage_snapshot(client, &account.access_token).await {
                            Ok(snapshot) => {
                                account.last_usage_sync_at = Some(snapshot.fetched_at);
                                account.usage = Some(snapshot);
                                account.sync_error = None;
                            }
                            Err(UsageFetchError::Unauthorized(body)) => {
                                account.sync_error =
                                    Some(format!("Access token все еще не принят: {}", body));
                            }
                            Err(UsageFetchError::Other(error)) => {
                                account.sync_error = Some(error);
                            }
                        }
                    }
                    Err(error) => {
                        account.sync_error = Some(error);
                    }
                }
            } else {
                account.sync_error =
                    Some("Access token истек, а refresh_token отсутствует".to_string());
            }
        }
        Err(UsageFetchError::Other(error)) => {
            account.sync_error = Some(error);
        }
    }
}

fn build_authorize_url(state: &str, code_challenge: &str) -> Result<Url, String> {
    let mut url = Url::parse(AUTHORIZE_ENDPOINT).map_err(|e| e.to_string())?;
    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", AUTH_CLIENT_ID)
        .append_pair("redirect_uri", AUTH_REDIRECT_URI)
        .append_pair("scope", AUTH_SCOPE)
        .append_pair("code_challenge", code_challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("id_token_add_organizations", "true")
        .append_pair("codex_cli_simplified_flow", "true")
        .append_pair("originator", AUTH_ORIGINATOR)
        .append_pair("state", state);
    Ok(url)
}

fn generate_pkce_pair() -> (String, String, String) {
    let verifier: String = thread_rng()
        .sample_iter(&Alphanumeric)
        .take(96)
        .map(char::from)
        .collect();
    let state: String = thread_rng()
        .sample_iter(&Alphanumeric)
        .take(24)
        .map(char::from)
        .collect();
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    (state, verifier, challenge)
}

async fn send_callback_response(stream: &mut tokio::net::TcpStream, html: &str) {
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.shutdown().await;
}

async fn wait_for_oauth_callback(
    listener: TcpListener,
    expected_state: String,
) -> Result<String, String> {
    let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
    let mut buffer = [0_u8; 8192];
    let bytes_read = stream.read(&mut buffer).await.map_err(|e| e.to_string())?;
    let request = String::from_utf8_lossy(&buffer[..bytes_read]);
    let request_line = request
        .lines()
        .next()
        .ok_or_else(|| "Пустой callback запрос".to_string())?;
    let path = request_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| "Не удалось прочитать callback URL".to_string())?;
    let url = Url::parse(&format!("http://localhost{}", path)).map_err(|e| e.to_string())?;

    let error_message = url
        .query_pairs()
        .find_map(|(key, value)| (key == "error").then(|| value.to_string()));

    if let Some(error) = error_message {
        send_callback_response(
            &mut stream,
            "<html><body style='background:#121214;color:#fff;font-family:system-ui;padding:32px'>Авторизация не завершена. Можно закрыть окно и попробовать еще раз.</body></html>",
        )
        .await;
        return Err(format!("OAuth вернул ошибку: {}", error));
    }

    let params: std::collections::HashMap<String, String> =
        url.query_pairs().into_owned().collect();

    if params.get("state") != Some(&expected_state) {
        send_callback_response(
            &mut stream,
            "<html><body style='background:#121214;color:#fff;font-family:system-ui;padding:32px'>Состояние авторизации не совпало. Закройте окно и повторите вход.</body></html>",
        )
        .await;
        return Err("OAuth state не совпал".to_string());
    }

    let code = params
        .get("code")
        .cloned()
        .ok_or_else(|| "В callback нет authorization code".to_string())?;

    send_callback_response(
        &mut stream,
        "<html><body style='background:#121214;color:#fff;font-family:system-ui;padding:32px'>Авторизация завершена. Это окно можно закрыть.</body></html>",
    )
    .await;

    Ok(code)
}

async fn exchange_authorization_code(
    client: &Client,
    code: &str,
    code_verifier: &str,
) -> Result<OAuthTokenResponse, String> {
    let request_body = form_body(&[
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", AUTH_REDIRECT_URI),
        ("client_id", AUTH_CLIENT_ID),
        ("code_verifier", code_verifier),
    ]);

    let response = client
        .post(TOKEN_ENDPOINT)
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(request_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        response
            .json::<OAuthTokenResponse>()
            .await
            .map_err(|e| e.to_string())
    } else {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        Err(format!(
            "Не удалось обменять authorization code: HTTP {}: {}",
            status, body
        ))
    }
}

#[tauri::command]
fn list_accounts(app: AppHandle) -> Result<Vec<StoredAccountSummary>, String> {
    let mut accounts = load_accounts(&app)?;

    if migrate_accounts(&mut accounts) {
        save_accounts(&app, &accounts)?;
    }

    Ok(accounts.iter().map(summary_from_account).collect())
}

#[tauri::command]
fn export_account_json(app: AppHandle, id: String) -> Result<String, String> {
    let mut accounts = load_accounts(&app)?;

    if migrate_accounts(&mut accounts) {
        save_accounts(&app, &accounts)?;
    }

    let account = find_account_by_id(&accounts, &id)?;
    serde_json::to_string_pretty(account).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_account(app: AppHandle, id: String) -> Result<Vec<StoredAccountSummary>, String> {
    let mut accounts = load_accounts(&app)?;
    let initial_len = accounts.len();

    accounts.retain(|account| account.id != id);

    if accounts.len() == initial_len {
        return Err("Аккаунт не найден".to_string());
    }

    save_accounts(&app, &accounts)?;
    Ok(accounts.iter().map(summary_from_account).collect())
}

#[tauri::command]
async fn import_account_from_json(
    app: AppHandle,
    raw_json: String,
) -> Result<StoredAccountSummary, String> {
    let imported = parse_imported_tokens(&raw_json)?;
    let mut account = build_stored_account(
        AccountSource::Manual,
        imported.access_token,
        imported.refresh_token,
        imported.id_token,
        imported.account_id,
        None,
    )?;

    let client = build_http_client()?;
    sync_account(&client, &mut account).await;

    let mut accounts = load_accounts(&app)?;
    upsert_account(&mut accounts, account.clone());
    save_accounts(&app, &accounts)?;

    Ok(summary_from_account(&account))
}

#[tauri::command]
async fn refresh_all_accounts(app: AppHandle) -> Result<Vec<StoredAccountSummary>, String> {
    let mut accounts = load_accounts(&app)?;
    let client = build_http_client()?;

    for account in &mut accounts {
        sync_account(&client, account).await;
    }

    save_accounts(&app, &accounts)?;
    Ok(accounts.iter().map(summary_from_account).collect())
}

#[tauri::command]
async fn start_codex_authorization(app: AppHandle) -> Result<StoredAccountSummary, String> {
    if app.get_webview_window(AUTH_WINDOW_LABEL).is_some() {
        return Err("Окно авторизации уже открыто".to_string());
    }

    let listener = TcpListener::bind(("127.0.0.1", AUTH_PORT))
        .await
        .map_err(|_| {
            format!(
                "Порт {} уже занят. Закройте другое окно авторизации и попробуйте снова.",
                AUTH_PORT
            )
        })?;

    let (state, code_verifier, code_challenge) = generate_pkce_pair();
    let authorize_url = build_authorize_url(&state, &code_challenge)?;
    let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
    let cancel_sender = Arc::new(Mutex::new(Some(cancel_tx)));

    let auth_window = tauri::WebviewWindowBuilder::new(
        &app,
        AUTH_WINDOW_LABEL,
        WebviewUrl::External(authorize_url),
    )
    .title("Авторизация Codex")
    .focused(true)
    .inner_size(520.0, 760.0)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;

    let cancel_sender_clone = Arc::clone(&cancel_sender);
    auth_window.on_window_event(move |event| {
        if matches!(
            event,
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
        ) {
            if let Some(sender) = cancel_sender_clone
                .lock()
                .ok()
                .and_then(|mut guard| guard.take())
            {
                let _ = sender.send(());
            }
        }
    });

    let callback_future = wait_for_oauth_callback(listener, state);
    let code = tokio::select! {
        result = callback_future => result?,
        _ = cancel_rx => {
            let _ = auth_window.close();
            return Err("Авторизация отменена пользователем".to_string());
        }
    };

    let _ = auth_window.close();

    let client = build_http_client()?;
    let token_response = exchange_authorization_code(&client, &code, &code_verifier).await?;
    let expires_at = now_unix() + token_response.expires_in;

    let mut account = build_stored_account(
        AccountSource::Oauth,
        token_response.access_token,
        token_response.refresh_token,
        token_response.id_token,
        None,
        Some(expires_at),
    )?;

    account.last_refresh_at = Some(now_unix());
    sync_account(&client, &mut account).await;

    let mut accounts = load_accounts(&app)?;
    upsert_account(&mut accounts, account.clone());
    save_accounts(&app, &accounts)?;

    Ok(summary_from_account(&account))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                {
                    let _ = apply_vibrancy(
                        &window,
                        NSVisualEffectMaterial::HudWindow,
                        None,
                        Some(16.0),
                    );
                }

                #[cfg(target_os = "windows")]
                {
                    let _ = window.set_decorations(false);
                    let _ = apply_mica(&window, None)
                        .or_else(|_| apply_acrylic(&window, Some((18, 18, 18, 160))));
                    window_shadows_v2::set_shadows(app, true);
                }
            }

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_accounts,
            export_account_json,
            delete_account,
            import_account_from_json,
            refresh_all_accounts,
            start_codex_authorization
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
