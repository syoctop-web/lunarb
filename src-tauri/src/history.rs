// Lunar Browser - History
// SQLite-like history stored as JSON for portability (no extra deps needed)

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use parking_lot::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub url: String,
    pub title: String,
    pub visited_at: i64, // unix timestamp
    pub visit_count: i32,
}

pub struct HistoryState {
    pub entries: Mutex<Vec<HistoryEntry>>,
    pub loaded: Mutex<bool>,
}

fn history_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir.join("history.json"))
}

pub fn init_db(app: &AppHandle) -> Result<(), String> {
    let path = history_path(app)?;
    if !path.exists() {
        fs::write(&path, "[]").map_err(|e| e.to_string())?;
    }

    // Load into memory
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let entries: Vec<HistoryEntry> =
        serde_json::from_str(&content).unwrap_or_default();

    let state = app.state::<HistoryState>();
    *state.entries.lock() = entries;
    *state.loaded.lock() = true;
    Ok(())
}

fn save(app: &AppHandle) -> Result<(), String> {
    let path = history_path(app)?;
    let state = app.state::<HistoryState>();
    let entries = state.entries.lock().clone();
    let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_history(
    app: AppHandle,
    url: String,
    title: String,
) -> Result<(), String> {
    let state = app.state::<HistoryState>();
    let mut entries = state.entries.lock();

    // If the same URL was the most recent visit, just bump visit_count
    if let Some(last) = entries.last_mut() {
        if last.url == url {
            last.visit_count += 1;
            last.visited_at = chrono::Utc::now().timestamp();
            last.title = title.clone();
            drop(entries);
            return save(&app);
        }
    }

    let entry = HistoryEntry {
        id: uuid::Uuid::new_v4().to_string(),
        url,
        title,
        visited_at: chrono::Utc::now().timestamp(),
        visit_count: 1,
    };
    entries.push(entry);

    // Cap history at 5000 entries to keep memory low
    if entries.len() > 5000 {
        let excess = entries.len() - 5000;
        entries.drain(0..excess);
    }

    drop(entries);
    save(&app)
}

#[tauri::command]
pub fn get_history(app: AppHandle, limit: Option<usize>) -> Result<Vec<HistoryEntry>, String> {
    let state = app.state::<HistoryState>();
    let entries = state.entries.lock();
    let limit = limit.unwrap_or(100);
    Ok(entries.iter().rev().take(limit).cloned().collect())
}

#[tauri::command]
pub fn search_history(app: AppHandle, query: String) -> Result<Vec<HistoryEntry>, String> {
    let state = app.state::<HistoryState>();
    let entries = state.entries.lock();
    let q = query.to_lowercase();
    Ok(entries
        .iter()
        .rev()
        .filter(|e| e.url.to_lowercase().contains(&q) || e.title.to_lowercase().contains(&q))
        .take(100)
        .cloned()
        .collect())
}

#[tauri::command]
pub fn delete_history(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<HistoryState>();
    let mut entries = state.entries.lock();
    entries.retain(|e| e.id != id);
    drop(entries);
    save(&app)
}

#[tauri::command]
pub fn clear_history(app: AppHandle) -> Result<(), String> {
    let state = app.state::<HistoryState>();
    *state.entries.lock() = Vec::new();
    save(&app)
}
