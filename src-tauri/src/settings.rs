// Lunar Browser - Settings & Customization
// Persists user preferences in a JSON file.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,              // "lunar-dark", "lunar-light", "midnight", "sunset", "forest", "ocean"
    pub accent_color: String,       // hex color
    pub search_engine: String,      // "google", "bing", "duckduckgo", "brave"
    pub homepage: String,
    pub tab_bar_position: String,   // "top" | "bottom"
    pub show_home_button: bool,
    pub show_bookmarks_bar: bool,
    pub density: String,            // "compact" | "comfortable" | "spacious"
    pub font_family: String,        // "system" | "inter" | "roboto" | "jetbrains"
    pub font_size: i32,             // 12 - 24
    pub animations: bool,
    pub hardware_acceleration: bool,
    pub block_ads: bool,            // basic host-based ad blocking
    pub do_not_track: bool,
    pub auto_clear_data: bool,
    pub default_zoom: f64,          // 0.5 - 2.0
    pub smooth_scrolling: bool,
    pub show_favicons: bool,
    pub confirm_before_close: bool,
    pub restore_session: bool,
    pub custom_css: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "lunar-dark".to_string(),
            accent_color: "#7c5cff".to_string(),
            search_engine: "google".to_string(),
            homepage: "lunar://newtab".to_string(),
            tab_bar_position: "top".to_string(),
            show_home_button: true,
            show_bookmarks_bar: true,
            density: "comfortable".to_string(),
            font_family: "system".to_string(),
            font_size: 14,
            animations: true,
            hardware_acceleration: true,
            block_ads: true,
            do_not_track: true,
            auto_clear_data: false,
            default_zoom: 1.0,
            smooth_scrolling: true,
            show_favicons: true,
            confirm_before_close: false,
            restore_session: true,
            custom_css: String::new(),
        }
    }
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir.join("settings.json"))
}

pub fn init_storage(app: &AppHandle) -> Result<(), String> {
    let path = settings_path(app)?;
    if !path.exists() {
        let default = Settings::default();
        let json = serde_json::to_string_pretty(&default).map_err(|e| e.to_string())?;
        fs::write(&path, json).map_err(|e| e.to_string())?;
        log::info!("Created default settings at {:?}", path);
    }
    Ok(())
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let path = settings_path(&app)?;
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let path = settings_path(&app)?;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    let _ = app.emit("settings-changed", &settings);
    Ok(())
}

#[tauri::command]
pub fn reset_settings(app: AppHandle) -> Result<Settings, String> {
    let default = Settings::default();
    let path = settings_path(&app)?;
    let json = serde_json::to_string_pretty(&default).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    let _ = app.emit("settings-changed", &default);
    Ok(default)
}
