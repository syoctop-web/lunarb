// Lunar Browser - Tab Management
// Each tab is a separate webview within the main window for true process isolation
// and minimal memory overhead per tab.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use parking_lot::Mutex;
use once_cell::sync::Lazy;

static TAB_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tab {
    pub id: u64,
    pub url: String,
    pub title: String,
    pub loading: bool,
    pub favicon: Option<String>,
}

#[derive(Default)]
pub struct TabState {
    pub tabs: Mutex<Vec<Tab>>,
    pub active_tab: Mutex<Option<u64>>,
}

static GLOBAL_STATE: Lazy<Mutex<Option<AppHandle>>> = Lazy::new(|| Mutex::new(None));

const CHROME_HEIGHT: f64 = 88.0; // tab bar + toolbar height (adjusted dynamically from frontend)

/// Create a new tab with the given URL.
/// The tab is a webview positioned below the browser chrome.
#[tauri::command]
pub fn create_tab(
    app: AppHandle,
    url: Option<String>,
    label: Option<String>,
) -> Result<Tab, String> {
    let tab_id = TAB_COUNTER.fetch_add(1, Ordering::SeqCst);
    let tab_label = label
        .unwrap_or_else(|| format!("tab-{}", tab_id));
    let target_url = url.unwrap_or_else(|| {
        "lunar://newtab".to_string()
    });

    // Get main window to position the webview inside it
    let main_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    let scale = main_window
        .scale_factor()
        .unwrap_or(1.0);
    let logical_size = main_window
        .inner_size()
        .map_err(|e| e.to_string())?;
    let width = logical_size.width as f64 / scale;
    let height = logical_size.height as f64 / scale - CHROME_HEIGHT;

    // Build webview as child of main window
    let parsed_url = normalize_url(&target_url);
    let webview_url: WebviewUrl = if parsed_url == "lunar://newtab" || parsed_url.is_empty() {
        WebviewUrl::App("newtab.html".into())
    } else {
        WebviewUrl::External(parsed_url.parse().map_err(|e: Box<dyn std::error::Error>| e.to_string())?)
    };

    let webview = WebviewWindowBuilder::new(
        &app,
        &tab_label,
        webview_url,
    )
    .title("")
    .inner_size(width, height)
    .position(0.0, CHROME_HEIGHT)
    .resizable(true)
    .focused(true)
    .decorations(false)
    .skip_taskbar(true)
    .always_on_bottom(false)
    .visible(true)
    .build()
    .map_err(|e| e.to_string())?;

    // Try to reparent to main window (platform-dependent)
    let _ = webview.reparent(&main_window);

    // Hide all webviews except the new one
    hide_other_tabs(&app, tab_id);

    // Tab metadata
    let tab = Tab {
        id: tab_id,
        url: target_url.clone(),
        title: "New Tab".to_string(),
        loading: true,
        favicon: None,
    };

    let state = app.state::<TabState>();
    state.tabs.lock().push(tab.clone());
    *state.active_tab.lock() = Some(tab_id);

    // Emit tab-created event to frontend
    let _ = app.emit("tab-created", &tab);
    let _ = app.emit("tabs-updated", list_tabs_internal(&app));

    Ok(tab)
}

fn hide_other_tabs(app: &AppHandle, except_id: u64) {
    let state = app.state::<TabState>();
    let tabs = state.tabs.lock();
    for tab in tabs.iter() {
        if tab.id != except_id {
            let label = format!("tab-{}", tab.id);
            if let Some(wv) = app.get_webview_window(&label) {
                let _ = wv.hide();
            }
        }
    }
}

#[tauri::command]
pub fn close_tab(app: AppHandle, tab_id: u64) -> Result<(), String> {
    let label = format!("tab-{}", tab_id);
    if let Some(wv) = app.get_webview_window(&label) {
        let _ = wv.close();
    }

    let state = app.state::<TabState>();
    let mut tabs = state.tabs.lock();
    tabs.retain(|t| t.id != tab_id);

    // If active tab was closed, switch to the last remaining tab
    let mut active = state.active_tab.lock();
    if *active == Some(tab_id) {
        *active = tabs.last().map(|t| t.id);
        if let Some(new_active) = *active {
            drop(active);
            drop(tabs);
            set_active_tab(app.clone(), new_active)?;
        }
    }

    let _ = app.emit("tabs-updated", list_tabs_internal(&app));
    Ok(())
}

#[tauri::command]
pub fn navigate_tab(app: AppHandle, tab_id: u64, url: String) -> Result<(), String> {
    let label = format!("tab-{}", tab_id);
    let wv = app
        .get_webview_window(&label)
        .ok_or(format!("Tab {} not found", tab_id))?;

    let parsed = normalize_url(&url);

    // For lunar://newtab, navigate to the embedded newtab page
    let eval_js = if parsed == "lunar://newtab" {
        // Use Tauri's asset protocol to load newtab.html
        format!("window.location.href = 'newtab.html';")
    } else {
        format!("window.location.href = {};", serde_json::to_string(&parsed).unwrap())
    };

    wv.eval(&eval_js).map_err(|e| e.to_string())?;

    // Update tab metadata
    let state = app.state::<TabState>();
    let mut tabs = state.tabs.lock();
    if let Some(tab) = tabs.iter_mut().find(|t| t.id == tab_id) {
        tab.url = parsed;
        tab.loading = true;
    }
    drop(tabs);
    let _ = app.emit("tabs-updated", list_tabs_internal(&app));
    Ok(())
}

#[tauri::command]
pub fn get_tab_url(app: AppHandle, tab_id: u64) -> Result<String, String> {
    let state = app.state::<TabState>();
    let tabs = state.tabs.lock();
    tabs.iter()
        .find(|t| t.id == tab_id)
        .map(|t| t.url.clone())
        .ok_or("Tab not found".to_string())
}

#[tauri::command]
pub fn set_tab_url(app: AppHandle, tab_id: u64, url: String) -> Result<(), String> {
    let state = app.state::<TabState>();
    let mut tabs = state.tabs.lock();
    if let Some(tab) = tabs.iter_mut().find(|t| t.id == tab_id) {
        tab.url = url;
        tab.loading = false;
    }
    drop(tabs);
    let _ = app.emit("tabs-updated", list_tabs_internal(&app));
    Ok(())
}

#[tauri::command]
pub fn go_back(app: AppHandle, tab_id: u64) -> Result<(), String> {
    let label = format!("tab-{}", tab_id);
    let wv = app
        .get_webview_window(&label)
        .ok_or("Tab not found")?;
    wv.eval("window.history.back();")
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn go_forward(app: AppHandle, tab_id: u64) -> Result<(), String> {
    let label = format!("tab-{}", tab_id);
    let wv = app
        .get_webview_window(&label)
        .ok_or("Tab not found")?;
    wv.eval("window.history.forward();")
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reload_tab(app: AppHandle, tab_id: u64) -> Result<(), String> {
    let label = format!("tab-{}", tab_id);
    let wv = app
        .get_webview_window(&label)
        .ok_or("Tab not found")?;
    wv.eval("window.location.reload();")
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stop_loading(app: AppHandle, tab_id: u64) -> Result<(), String> {
    let label = format!("tab-{}", tab_id);
    let wv = app
        .get_webview_window(&label)
        .ok_or("Tab not found")?;
    wv.eval("window.stop();")
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_active_tab(app: AppHandle) -> Result<Option<u64>, String> {
    let state = app.state::<TabState>();
    Ok(*state.active_tab.lock())
}

#[tauri::command]
pub fn set_active_tab(app: AppHandle, tab_id: u64) -> Result<(), String> {
    // Hide all webviews except the new active one
    let state = app.state::<TabState>();
    let tabs = state.tabs.lock();

    for tab in tabs.iter() {
        let label = format!("tab-{}", tab.id);
        if let Some(wv) = app.get_webview_window(&label) {
            if tab.id == tab_id {
                let _ = wv.show();
                let _ = wv.set_focus();
            } else {
                let _ = wv.hide();
            }
        }
    }
    drop(tabs);

    *state.active_tab.lock() = Some(tab_id);
    let _ = app.emit("active-tab-changed", tab_id);
    Ok(())
}

#[tauri::command]
pub fn list_tabs(app: AppHandle) -> Result<Vec<Tab>, String> {
    Ok(list_tabs_internal(&app))
}

fn list_tabs_internal(app: &AppHandle) -> Vec<Tab> {
    let state = app.state::<TabState>();
    state.tabs.lock().clone()
}

#[tauri::command]
pub fn open_devtools(app: AppHandle, tab_id: u64) -> Result<(), String> {
    let label = format!("tab-{}", tab_id);
    let wv = app
        .get_webview_window(&label)
        .ok_or("Tab not found")?;
    #[cfg(debug_assertions)]
    {
        wv.open_devtools();
        Ok(())
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = wv;
        Err("DevTools only available in debug builds".to_string())
    }
}

/// Normalize user input to a proper URL.
/// "example.com" -> "https://example.com"
/// "search terms" -> "https://www.google.com/search?q=..."
pub fn normalize_url(input: &str) -> String {
    let trimmed = input.trim();

    // Empty
    if trimmed.is_empty() {
        return "about:blank".to_string();
    }

    // Internal Lunar pages
    if trimmed.starts_with("lunar://") {
        return trimmed.to_string();
    }

    // Already has a scheme
    if trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("about:")
        || trimmed.starts_with("file://")
        || trimmed.starts_with("chrome://")
    {
        return trimmed.to_string();
    }

    // Looks like a URL (contains a dot, no spaces)
    let looks_like_url = trimmed.contains('.')
        && !trimmed.contains(' ')
        && trimmed.split('.').count() >= 2;

    if looks_like_url {
        format!("https://{}", trimmed)
    } else {
        // Treat as a search query
        format!(
            "https://www.google.com/search?q={}",
            urlencoding::encode(trimmed)
        )
    }
}

// We need urlencoding - add it to Cargo.toml dependencies
