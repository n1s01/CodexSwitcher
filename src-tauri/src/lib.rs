use tauri::Manager;
use wreq::Client;
use wreq_util::Emulation;

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
#[cfg(target_os = "windows")]
use window_vibrancy::{apply_acrylic, apply_mica};

#[tauri::command]
async fn fetch_chatgpt_usage(access_token: String) -> Result<serde_json::Value, String> {
    let client = Client::builder()
        .emulation(Emulation::Chrome131)
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get("https://chatgpt.com/backend-api/wham/usage")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Accept", "application/json")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Referer", "https://chatgpt.com/")
        .header("Origin", "https://chatgpt.com")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        response
            .json::<serde_json::Value>()
            .await
            .map_err(|e| e.to_string())
    } else {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        Err(format!("HTTP {}: {}", status, body))
    }
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
        .invoke_handler(tauri::generate_handler![fetch_chatgpt_usage])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
