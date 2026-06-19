// Lunar Browser - Main Entry Point
// A fast, beautiful, customizable browser built in Rust with Tauri 2 + WebView2

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod tab;
mod settings;
mod history;
mod bookmarks;
mod theme;

use tauri::Manager;
use tab::TabState;
use history::HistoryState;
use bookmarks::BookmarksState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp(None)
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .manage(TabState::default())
        .manage(HistoryState {
            entries: parking_lot::Mutex::new(Vec::new()),
            loaded: parking_lot::Mutex::new(false),
        })
        .manage(BookmarksState {
            entries: parking_lot::Mutex::new(Vec::new()),
        })
        .setup(|app| {
            // Initialize data directories
            settings::init_storage(app.handle())?;
            history::init_db(app.handle())?;
            bookmarks::init_db(app.handle())?;

            // The main window is created from tauri.conf.json
            // We just need to make sure it has the right label
            if let Some(window) = app.get_webview_window("main") {
                // Show the window
                window.show()?;
                log::info!("Lunar browser started");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Tab operations
            tab::create_tab,
            tab::close_tab,
            tab::navigate_tab,
            tab::get_tab_url,
            tab::set_tab_url,
            tab::go_back,
            tab::go_forward,
            tab::reload_tab,
            tab::stop_loading,
            tab::get_active_tab,
            tab::set_active_tab,
            tab::list_tabs,
            tab::open_devtools,
            // Settings operations
            settings::get_settings,
            settings::set_settings,
            settings::reset_settings,
            // History operations
            history::add_history,
            history::get_history,
            history::search_history,
            history::delete_history,
            history::clear_history,
            // Bookmark operations
            bookmarks::add_bookmark,
            bookmarks::get_bookmarks,
            bookmarks::delete_bookmark,
            bookmarks::is_bookmarked,
            // Theme operations
            theme::get_themes,
            theme::apply_theme,
            // Window operations
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_start_dragging,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lunar browser");
}

#[tauri::command]
fn window_minimize(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_toggle_maximize(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unminimize().map_err(|e| e.to_string())?;
        window
            .maximize()
            .map_err(|e| e.to_string())?;
    } else {
        window.maximize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn window_close(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_start_dragging(window: tauri::WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}
