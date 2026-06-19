// Lunar Browser - Bookmarks

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use parking_lot::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub id: String,
    pub url: String,
    pub title: String,
    pub favicon: Option<String>,
    pub folder: String,
    pub created_at: i64,
}

pub struct BookmarksState {
    pub entries: Mutex<Vec<Bookmark>>,
}

fn bookmarks_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir.join("bookmarks.json"))
}

pub fn init_db(app: &AppHandle) -> Result<(), String> {
    let path = bookmarks_path(app)?;
    if !path.exists() {
        fs::write(&path, "[]").map_err(|e| e.to_string())?;
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let entries: Vec<Bookmark> = serde_json::from_str(&content).unwrap_or_default();
    let state = app.state::<BookmarksState>();
    *state.entries.lock() = entries;
    Ok(())
}

fn save(app: &AppHandle) -> Result<(), String> {
    let path = bookmarks_path(app)?;
    let state = app.state::<BookmarksState>();
    let entries = state.entries.lock().clone();
    let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_bookmark(
    app: AppHandle,
    url: String,
    title: String,
    favicon: Option<String>,
) -> Result<Bookmark, String> {
    let state = app.state::<BookmarksState>();
    let bookmark = Bookmark {
        id: uuid::Uuid::new_v4().to_string(),
        url,
        title,
        favicon,
        folder: String::new(),
        created_at: chrono::Utc::now().timestamp(),
    };
    state.entries.lock().push(bookmark.clone());
    drop(state);
    save(&app)?;
    let _ = app.emit("bookmarks-updated", ());
    Ok(bookmark)
}

#[tauri::command]
pub fn get_bookmarks(app: AppHandle) -> Result<Vec<Bookmark>, String> {
    let state = app.state::<BookmarksState>();
    let entries = state.entries.lock();
    Ok(entries.clone())
}

#[tauri::command]
pub fn delete_bookmark(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<BookmarksState>();
    state.entries.lock().retain(|b| b.id != id);
    drop(state);
    save(&app)?;
    let _ = app.emit("bookmarks-updated", ());
    Ok(())
}

#[tauri::command]
pub fn is_bookmarked(app: AppHandle, url: String) -> Result<bool, String> {
    let state = app.state::<BookmarksState>();
    let entries = state.entries.lock();
    Ok(entries.iter().any(|b| b.url == url))
}
