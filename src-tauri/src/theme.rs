// Lunar Browser - Theme System
// Predefined themes + user custom accent colors.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub is_dark: bool,
    pub bg_primary: String,
    pub bg_secondary: String,
    pub bg_tertiary: String,
    pub text_primary: String,
    pub text_secondary: String,
    pub border: String,
    pub accent: String,
    pub accent_hover: String,
    pub danger: String,
    pub success: String,
    pub warning: String,
}

pub fn builtin_themes() -> Vec<Theme> {
    vec![
        Theme {
            id: "lunar-dark".into(),
            name: "Lunar Dark".into(),
            is_dark: true,
            bg_primary: "#0d0d12".into(),
            bg_secondary: "#16161d".into(),
            bg_tertiary: "#1f1f2a".into(),
            text_primary: "#e8e8f0".into(),
            text_secondary: "#9494a8".into(),
            border: "#2a2a36".into(),
            accent: "#7c5cff".into(),
            accent_hover: "#9276ff".into(),
            danger: "#ff5470".into(),
            success: "#3ad29f".into(),
            warning: "#ffb454".into(),
        },
        Theme {
            id: "lunar-light".into(),
            name: "Lunar Light".into(),
            is_dark: false,
            bg_primary: "#fafafc".into(),
            bg_secondary: "#ffffff".into(),
            bg_tertiary: "#f0f0f3".into(),
            text_primary: "#1a1a25".into(),
            text_secondary: "#6c6c7a".into(),
            border: "#e0e0e6".into(),
            accent: "#7c5cff".into(),
            accent_hover: "#6b4dee".into(),
            danger: "#e63950".into(),
            success: "#0fa968".into(),
            warning: "#e89500".into(),
        },
        Theme {
            id: "midnight".into(),
            name: "Midnight".into(),
            is_dark: true,
            bg_primary: "#000000".into(),
            bg_secondary: "#0a0a0a".into(),
            bg_tertiary: "#161616".into(),
            text_primary: "#f5f5f7".into(),
            text_secondary: "#86868b".into(),
            border: "#1d1d1f".into(),
            accent: "#0a84ff".into(),
            accent_hover: "#3d9bff".into(),
            danger: "#ff453a".into(),
            success: "#32d74b".into(),
            warning: "#ffd60a".into(),
        },
        Theme {
            id: "sunset".into(),
            name: "Sunset".into(),
            is_dark: true,
            bg_primary: "#1a0f1f".into(),
            bg_secondary: "#251530".into(),
            bg_tertiary: "#321d3f".into(),
            text_primary: "#fde4d3".into(),
            text_secondary: "#b69ab5".into(),
            border: "#3d2647".into(),
            accent: "#ff6b6b".into(),
            accent_hover: "#ff8585".into(),
            danger: "#ff3366".into(),
            success: "#7fdb9a".into(),
            warning: "#ffd166".into(),
        },
        Theme {
            id: "forest".into(),
            name: "Forest".into(),
            is_dark: true,
            bg_primary: "#0c1410".into(),
            bg_secondary: "#141d18".into(),
            bg_tertiary: "#1d2820".into(),
            text_primary: "#e8f0e8".into(),
            text_secondary: "#8aa595".into(),
            border: "#26332a".into(),
            accent: "#5cb85c".into(),
            accent_hover: "#73c873".into(),
            danger: "#d9534f".into(),
            success: "#5cb85c".into(),
            warning: "#f0ad4e".into(),
        },
        Theme {
            id: "ocean".into(),
            name: "Ocean".into(),
            is_dark: true,
            bg_primary: "#0a1929".into(),
            bg_secondary: "#0f2438".into(),
            bg_tertiary: "#152e44".into(),
            text_primary: "#d4e8f5".into(),
            text_secondary: "#7ba3c0".into(),
            border: "#1e3a52".into(),
            accent: "#00b4d8".into(),
            accent_hover: "#00d4ff".into(),
            danger: "#ff4d6d".into(),
            success: "#06d6a0".into(),
            warning: "#ffd166".into(),
        },
        Theme {
            id: "rose".into(),
            name: "Rose Quartz".into(),
            is_dark: true,
            bg_primary: "#1a0e16".into(),
            bg_secondary: "#251521".into(),
            bg_tertiary: "#321d2c".into(),
            text_primary: "#fde4ee".into(),
            text_secondary: "#b56e8a".into(),
            border: "#3d2640".into(),
            accent: "#e63992".into(),
            accent_hover: "#ff5cad".into(),
            danger: "#ff3366".into(),
            success: "#06d6a0".into(),
            warning: "#ffb454".into(),
        },
        Theme {
            id: "graphite".into(),
            name: "Graphite".into(),
            is_dark: true,
            bg_primary: "#1c1c1c".into(),
            bg_secondary: "#242424".into(),
            bg_tertiary: "#2e2e2e".into(),
            text_primary: "#e0e0e0".into(),
            text_secondary: "#9e9e9e".into(),
            border: "#383838".into(),
            accent: "#ff4081".into(),
            accent_hover: "#ff6b9a".into(),
            danger: "#f44336".into(),
            success: "#4caf50".into(),
            warning: "#ff9800".into(),
        },
    ]
}

#[tauri::command]
pub fn get_themes() -> Result<Vec<Theme>, String> {
    Ok(builtin_themes())
}

#[tauri::command]
pub fn apply_theme(_app: tauri::AppHandle, theme_id: String) -> Result<Theme, String> {
    builtin_themes()
        .into_iter()
        .find(|t| t.id == theme_id)
        .ok_or(format!("Theme '{}' not found", theme_id))
}
