// ===============================================
// LUNAR BROWSER - Main Application Logic
// ===============================================

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

// ============ STATE ============
let state = {
  tabs: [],
  activeTabId: null,
  settings: null,
  themes: [],
  bookmarks: [],
  history: [],
  urlBarFocused: false,
  selectedSuggestion: -1,
};

// ============ DOM ELEMENTS ============
const $ = (id) => document.getElementById(id);
const els = {
  tabsList: $('tabs-list'),
  newTabBtn: $('new-tab-btn'),
  urlBar: $('url-bar'),
  urlIcon: $('url-icon'),
  urlSuggestions: $('url-suggestions'),
  backBtn: $('back-btn'),
  forwardBtn: $('forward-btn'),
  reloadBtn: $('reload-btn'),
  homeBtn: $('home-btn'),
  bookmarkBtn: $('bookmark-btn'),
  historyBtn: $('history-btn'),
  bookmarksBtn: $('bookmarks-btn'),
  menuBtn: $('menu-btn'),
  bookmarksBar: $('bookmarks-bar'),
  bookmarksBarItems: $('bookmarks-bar-items'),
  loadingBar: $('loading-bar'),
  historyPanel: $('history-panel'),
  historyList: $('history-list'),
  historySearch: $('history-search'),
  bookmarksPanel: $('bookmarks-panel'),
  bookmarksList: $('bookmarks-list'),
  menuPanel: $('menu-panel'),
  settingsPanel: $('settings-panel'),
  winMin: $('win-min'),
  winMax: $('win-max'),
  winClose: $('win-close'),
};

// ============ INITIALIZATION ============
async function init() {
  await loadSettings();
  await loadThemes();
  await loadBookmarks();
  applyTheme(state.settings.theme);
  applyAccent(state.settings.accent_color);
  applyDensity(state.settings.density);
  applyFont(state.settings.font_family, state.settings.font_size);
  applyBookmarksBar();
  setupEventListeners();
  setupTauriListeners();
  setupKeyboardShortcuts();

  // Create first tab
  await createTab(state.settings.homepage || 'lunar://newtab');
}

// ============ SETTINGS ============
async function loadSettings() {
  try {
    state.settings = await invoke('get_settings');
  } catch (e) {
    console.error('Failed to load settings:', e);
    state.settings = {};
  }
}

async function saveSettings(newSettings) {
  state.settings = { ...state.settings, ...newSettings };
  await invoke('set_settings', { settings: state.settings });
  applySettingsToUI();
}

function applySettingsToUI() {
  const s = state.settings;
  document.documentElement.setAttribute('data-theme', s.theme);
  document.body.setAttribute('data-accent', s.accent_color);
  document.body.style.setProperty('--accent-override', s.accent_color);
  document.body.className = `density-${s.density}`;
  applyFont(s.font_family, s.font_size);
  applyBookmarksBar();
}

async function loadThemes() {
  try {
    state.themes = await invoke('get_themes');
    renderThemeGrid();
  } catch (e) {
    console.error('Failed to load themes:', e);
  }
}

function applyTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
}

function applyAccent(color) {
  document.body.setAttribute('data-accent', color);
  document.body.style.setProperty('--accent-override', color);
}

function applyDensity(density) {
  document.body.className = `density-${density}`;
}

function applyFont(family, size) {
  const fontMap = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    inter: '"Inter", -apple-system, system-ui, sans-serif',
    roboto: '"Roboto", -apple-system, system-ui, sans-serif',
    jetbrains: '"JetBrains Mono", "SF Mono", Consolas, monospace',
  };
  document.body.style.fontFamily = fontMap[family] || fontMap.system;
  document.body.style.fontSize = `${size}px`;
}

function applyBookmarksBar() {
  if (state.settings.show_bookmarks_bar) {
    els.bookmarksBar.classList.remove('hidden');
  } else {
    els.bookmarksBar.classList.add('hidden');
  }
}

// ============ TABS ============
async function createTab(url) {
  try {
    const tab = await invoke('create_tab', { url });
    state.tabs.push(tab);
    state.activeTabId = tab.id;
    renderTabs();
    updateUrlBar(tab.url);
  } catch (e) {
    console.error('Failed to create tab:', e);
  }
}

async function closeTab(tabId, e) {
  if (e) e.stopPropagation();
  try {
    await invoke('close_tab', { tabId });
    state.tabs = state.tabs.filter(t => t.id !== tabId);
    if (state.activeTabId === tabId) {
      state.activeTabId = state.tabs.length > 0 ? state.tabs[state.tabs.length - 1].id : null;
    }
    renderTabs();
    if (state.tabs.length === 0) {
      await createTab(state.settings.homepage);
    } else if (state.activeTabId) {
      await setActiveTab(state.activeTabId);
    }
  } catch (e) {
    console.error('Failed to close tab:', e);
  }
}

async function setActiveTab(tabId) {
  try {
    await invoke('set_active_tab', { tabId });
    state.activeTabId = tabId;
    const tab = state.tabs.find(t => t.id === tabId);
    if (tab) updateUrlBar(tab.url);
    renderTabs();
  } catch (e) {
    console.error('Failed to set active tab:', e);
  }
}

function renderTabs() {
  els.tabsList.innerHTML = '';
  for (const tab of state.tabs) {
    const el = document.createElement('div');
    el.className = `tab ${tab.id === state.activeTabId ? 'active' : ''}`;
    el.dataset.tabId = tab.id;
    el.innerHTML = `
      <div class="tab-favicon">${getFaviconSvg(tab.url)}</div>
      <div class="tab-title">${escapeHtml(tab.title || 'New Tab')}</div>
      <button class="tab-close" title="Close tab">
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    `;
    el.addEventListener('click', () => setActiveTab(tab.id));
    el.querySelector('.tab-close').addEventListener('click', (e) => closeTab(tab.id, e));
    el.addEventListener('contextmenu', (e) => showTabContextMenu(e, tab));
    els.tabsList.appendChild(el);
  }
}

function getFaviconSvg(url) {
  if (url.startsWith('lunar://')) {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.3"/></svg>`;
  }
  try {
    const u = new URL(url);
    return `<img src="https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32" alt="" onerror="this.style.display='none'"/>`;
  } catch {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/></svg>`;
  }
}

// ============ NAVIGATION ============
async function navigateTo(url) {
  if (!state.activeTabId) return;
  if (!url) return;

  // Detect if it's a search query
  const finalUrl = normalizeUrl(url);
  try {
    await invoke('navigate_tab', { tabId: state.activeTabId, url: finalUrl });
    updateUrlBar(finalUrl);
    startLoading();
  } catch (e) {
    console.error('Failed to navigate:', e);
  }
}

function normalizeUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return 'about:blank';
  if (trimmed.startsWith('lunar://') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('about:') || trimmed.startsWith('file://')) {
    return trimmed;
  }
  // Looks like a URL?
  if (trimmed.includes('.') && !trimmed.includes(' ') && trimmed.split('.').length >= 2) {
    return `https://${trimmed}`;
  }
  // Search
  const engines = {
    google: 'https://www.google.com/search?q=',
    bing: 'https://www.bing.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    brave: 'https://search.brave.com/search?q=',
  };
  const engine = engines[state.settings.search_engine] || engines.google;
  return `${engine}${encodeURIComponent(trimmed)}`;
}

function updateUrlBar(url) {
  els.urlBar.value = url === 'lunar://newtab' ? '' : url;
  updateUrlIcon(url);
  updateBookmarkButton(url);
}

function updateUrlIcon(url) {
  const isSecure = url.startsWith('https://');
  const isLunar = url.startsWith('lunar://');
  if (isLunar) {
    els.urlIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.3"/></svg>`;
  } else if (isSecure) {
    els.urlIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2"/></svg>`;
    els.urlIcon.style.color = 'var(--success)';
  } else {
    els.urlIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2"/></svg>`;
    els.urlIcon.style.color = 'var(--text-tertiary)';
  }
}

function startLoading() {
  els.loadingBar.classList.add('loading');
  els.reloadBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function stopLoading() {
  els.loadingBar.classList.remove('loading');
  els.reloadBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// ============ URL SUGGESTIONS ============
async function showSuggestions(query) {
  if (!query || query.length < 1) {
    els.urlSuggestions.classList.add('hidden');
    return;
  }
  const items = [];
  // Search history
  try {
    const results = await invoke('search_history', { query });
    results.slice(0, 5).forEach(r => {
      items.push({ type: 'history', title: r.title, url: r.url });
    });
  } catch {}
  // Search suggestion (google-style)
  items.push({ type: 'search', title: `${query} — Search`, url: normalizeUrl(query) });

  if (items.length === 0) {
    els.urlSuggestions.classList.add('hidden');
    return;
  }

  els.urlSuggestions.innerHTML = items.map((item, i) => `
    <div class="suggestion-item" data-url="${escapeHtml(item.url)}" data-index="${i}">
      <span class="suggestion-icon">${getSuggestionIcon(item.type)}</span>
      <div class="suggestion-text">
        <span class="suggestion-title">${escapeHtml(item.title)}</span>
        ${item.type === 'history' ? `<span class="suggestion-url">${escapeHtml(item.url)}</span>` : ''}
      </div>
    </div>
  `).join('');

  els.urlSuggestions.classList.remove('hidden');
  state.selectedSuggestion = -1;

  els.urlSuggestions.querySelectorAll('.suggestion-item').forEach(el => {
    el.addEventListener('click', () => {
      const url = el.dataset.url;
      els.urlBar.blur();
      els.urlSuggestions.classList.add('hidden');
      navigateTo(url);
    });
  });
}

function getSuggestionIcon(type) {
  if (type === 'history') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2"/></svg>`;
  }
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2"/></svg>`;
}

// ============ HISTORY ============
async function loadHistory() {
  try {
    const history = await invoke('get_history', { limit: 200 });
    state.history = history;
    renderHistory(history);
  } catch (e) {
    console.error('Failed to load history:', e);
  }
}

function renderHistory(items) {
  els.historyList.innerHTML = items.map(item => `
    <div class="history-item" data-url="${escapeHtml(item.url)}">
      <span class="suggestion-icon">${getFaviconSvg(item.url)}</span>
      <div class="history-item-content">
        <div class="history-item-title">${escapeHtml(item.title || item.url)}</div>
        <div class="history-item-url">${escapeHtml(item.url)}</div>
      </div>
      <span class="history-item-time">${formatTime(item.visited_at)}</span>
    </div>
  `).join('');

  els.historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      navigateTo(el.dataset.url);
      els.historyPanel.classList.add('hidden');
    });
  });
}

function formatTime(unix) {
  const d = new Date(unix * 1000);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString();
}

// ============ BOOKMARKS ============
async function loadBookmarks() {
  try {
    state.bookmarks = await invoke('get_bookmarks');
    renderBookmarksBar();
    renderBookmarksList();
  } catch (e) {
    console.error('Failed to load bookmarks:', e);
  }
}

function renderBookmarksBar() {
  els.bookmarksBarItems.innerHTML = state.bookmarks.slice(0, 20).map(b => `
    <button class="bookmark-item" data-url="${escapeHtml(b.url)}" title="${escapeHtml(b.title)}">
      ${getFaviconSvg(b.url)}
      <span>${escapeHtml(b.title)}</span>
    </button>
  `).join('');

  els.bookmarksBarItems.querySelectorAll('.bookmark-item').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.url));
  });
}

function renderBookmarksList() {
  els.bookmarksList.innerHTML = state.bookmarks.map(b => `
    <div class="bookmark-list-item" data-url="${escapeHtml(b.url)}" data-id="${b.id}">
      <span class="suggestion-icon">${getFaviconSvg(b.url)}</span>
      <div class="bookmark-item-content">
        <div class="bookmark-item-title">${escapeHtml(b.title)}</div>
        <div class="bookmark-item-url">${escapeHtml(b.url)}</div>
      </div>
      <button class="panel-close bookmark-delete" data-id="${b.id}" title="Remove">×</button>
    </div>
  `).join('');

  els.bookmarksList.querySelectorAll('.bookmark-list-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('bookmark-delete')) return;
      navigateTo(el.dataset.url);
      els.bookmarksPanel.classList.add('hidden');
    });
  });

  els.bookmarksList.querySelectorAll('.bookmark-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await invoke('delete_bookmark', { id: btn.dataset.id });
      await loadBookmarks();
      updateBookmarkButton(els.urlBar.value);
    });
  });
}

async function toggleBookmark() {
  const url = els.urlBar.value;
  if (!url) return;
  try {
    const isMarked = await invoke('is_bookmarked', { url });
    if (isMarked) {
      const bookmark = state.bookmarks.find(b => b.url === url);
      if (bookmark) await invoke('delete_bookmark', { id: bookmark.id });
    } else {
      const title = state.tabs.find(t => t.id === state.activeTabId)?.title || url;
      await invoke('add_bookmark', { url, title, favicon: null });
    }
    await loadBookmarks();
    updateBookmarkButton(url);
  } catch (e) {
    console.error('Failed to toggle bookmark:', e);
  }
}

function updateBookmarkButton(url) {
  const isMarked = state.bookmarks.some(b => b.url === url);
  els.bookmarkBtn.classList.toggle('active', isMarked);
}

// ============ SETTINGS UI ============
function renderThemeGrid() {
  const grid = $('theme-grid');
  if (!grid) return;
  grid.innerHTML = state.themes.map(theme => `
    <div class="theme-card ${theme.id === state.settings.theme ? 'active' : ''}" data-theme="${theme.id}">
      <div class="theme-card-preview">
        <div class="theme-card-preview-bg" style="background:${theme.bg_primary}"></div>
        <div class="theme-card-preview-bg" style="background:${theme.bg_secondary}"></div>
        <div class="theme-card-preview-accent" style="background:${theme.accent}"></div>
      </div>
      <div class="theme-card-name" style="color:${theme.text_primary};background:${theme.bg_secondary}">${theme.name}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', async () => {
      const themeId = card.dataset.theme;
      const theme = state.themes.find(t => t.id === themeId);
      applyTheme(themeId);
      applyAccent(theme.accent);
      await saveSettings({ theme: themeId, accent_color: theme.accent });
      grid.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === themeId));
      renderAccentSwatches();
    });
  });
}

function renderAccentSwatches() {
  document.querySelectorAll('.accent-swatch:not(.custom-color)').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === state.settings.accent_color);
  });
}

function populateSettingsInputs() {
  const s = state.settings;
  $('search-engine').value = s.search_engine;
  $('homepage').value = s.homepage;
  $('show-home-btn').checked = s.show_home_button;
  $('show-bookmarks-bar').checked = s.show_bookmarks_bar;
  $('animations-enabled').checked = s.animations;
  $('block-ads').checked = s.block_ads;
  $('dnt').checked = s.do_not_track;
  $('auto-clear').checked = s.auto_clear_data;
  $('confirm-close').checked = s.confirm_before_close;
  $('hw-accel').checked = s.hardware_acceleration;
  $('smooth-scroll').checked = s.smooth_scrolling;
  $('default-zoom').value = s.default_zoom * 100;
  $('zoom-label').textContent = `${Math.round(s.default_zoom * 100)}%`;
  $('restore-session').checked = s.restore_session;
  $('font-family').value = s.font_family;
  $('font-size').value = s.font_size;
  $('font-size-label').textContent = `${s.font_size}px`;
  $('custom-css').value = s.custom_css;
  $('custom-accent').value = s.accent_color;
  document.querySelectorAll('.density-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.density === s.density);
  });
  renderAccentSwatches();
  renderThemeGrid();
}

function setupSettingsListeners() {
  // Sidebar tabs
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      $(`settings-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // Theme grid (delegated)
  $('theme-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.theme-card');
    if (card) {
      const theme = state.themes.find(t => t.id === card.dataset.theme);
      applyTheme(card.dataset.theme);
      applyAccent(theme.accent);
      saveSettings({ theme: card.dataset.theme, accent_color: theme.accent });
      populateSettingsInputs();
    }
  });

  // Accent swatches
  document.querySelectorAll('.accent-swatch:not(.custom-color)').forEach(sw => {
    sw.addEventListener('click', async () => {
      const color = sw.dataset.color;
      applyAccent(color);
      await saveSettings({ accent_color: color });
      renderAccentSwatches();
    });
  });

  $('custom-accent').addEventListener('change', async (e) => {
    applyAccent(e.target.value);
    await saveSettings({ accent_color: e.target.value });
    renderAccentSwatches();
  });

  // Density
  document.querySelectorAll('.density-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      applyDensity(btn.dataset.density);
      await saveSettings({ density: btn.dataset.density });
      document.querySelectorAll('.density-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Form inputs
  $('search-engine').addEventListener('change', e => saveSettings({ search_engine: e.target.value }));
  $('homepage').addEventListener('change', e => saveSettings({ homepage: e.target.value }));
  $('show-home-btn').addEventListener('change', e => saveSettings({ show_home_button: e.target.checked }));
  $('show-bookmarks-bar').addEventListener('change', e => { saveSettings({ show_bookmarks_bar: e.target.checked }); applyBookmarksBar(); });
  $('animations-enabled').addEventListener('change', e => saveSettings({ animations: e.target.checked }));
  $('block-ads').addEventListener('change', e => saveSettings({ block_ads: e.target.checked }));
  $('dnt').addEventListener('change', e => saveSettings({ do_not_track: e.target.checked }));
  $('auto-clear').addEventListener('change', e => saveSettings({ auto_clear_data: e.target.checked }));
  $('confirm-close').addEventListener('change', e => saveSettings({ confirm_before_close: e.target.checked }));
  $('hw-accel').addEventListener('change', e => saveSettings({ hardware_acceleration: e.target.checked }));
  $('smooth-scroll').addEventListener('change', e => saveSettings({ smooth_scrolling: e.target.checked }));
  $('default-zoom').addEventListener('input', e => {
    const zoom = e.target.value / 100;
    $('zoom-label').textContent = `${e.target.value}%`;
    saveSettings({ default_zoom: zoom });
  });
  $('restore-session').addEventListener('change', e => saveSettings({ restore_session: e.target.checked }));
  $('font-family').addEventListener('change', e => { applyFont(e.target.value, state.settings.font_size); saveSettings({ font_family: e.target.value }); });
  $('font-size').addEventListener('input', e => {
    const size = parseInt(e.target.value);
    $('font-size-label').textContent = `${size}px`;
    applyFont(state.settings.font_family, size);
    saveSettings({ font_size: size });
  });
  $('custom-css').addEventListener('change', e => {
    saveSettings({ custom_css: e.target.value });
    applyCustomCss(e.target.value);
  });

  $('reset-settings').addEventListener('click', async () => {
    if (!confirm('Reset all settings to defaults?')) return;
    state.settings = await invoke('reset_settings');
    applySettingsToUI();
    populateSettingsInputs();
  });
}

function applyCustomCss(css) {
  let style = document.getElementById('user-custom-styles');
  if (!style) {
    style = document.createElement('style');
    style.id = 'user-custom-styles';
    document.head.appendChild(style);
  }
  style.textContent = css || '';
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
  // Tab buttons
  els.newTabBtn.addEventListener('click', () => createTab('lunar://newtab'));

  // Navigation buttons
  els.backBtn.addEventListener('click', async () => {
    if (state.activeTabId) await invoke('go_back', { tabId: state.activeTabId });
  });
  els.forwardBtn.addEventListener('click', async () => {
    if (state.activeTabId) await invoke('go_forward', { tabId: state.activeTabId });
  });
  els.reloadBtn.addEventListener('click', async () => {
    if (state.activeTabId) {
      startLoading();
      await invoke('reload_tab', { tabId: state.activeTabId });
    }
  });
  els.homeBtn.addEventListener('click', () => navigateTo(state.settings.homepage));

  // URL bar
  els.urlBar.addEventListener('focus', () => {
    els.urlBar.select();
    state.urlBarFocused = true;
  });
  els.urlBar.addEventListener('blur', () => {
    setTimeout(() => {
      els.urlSuggestions.classList.add('hidden');
      state.urlBarFocused = false;
    }, 150);
  });
  els.urlBar.addEventListener('input', (e) => {
    showSuggestions(e.target.value);
  });
  els.urlBar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      els.urlSuggestions.classList.add('hidden');
      navigateTo(els.urlBar.value);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = els.urlSuggestions.querySelectorAll('.suggestion-item');
      if (items.length === 0) return;
      let idx = state.selectedSuggestion;
      if (e.key === 'ArrowDown') idx = (idx + 1) % items.length;
      else idx = idx <= 0 ? items.length - 1 : idx - 1;
      state.selectedSuggestion = idx;
      items.forEach((it, i) => it.classList.toggle('selected', i === idx));
      const sel = items[idx];
      if (sel) els.urlBar.value = sel.dataset.url;
    } else if (e.key === 'Escape') {
      els.urlBar.blur();
      els.urlSuggestions.classList.add('hidden');
    }
  });

  // Bookmark button
  els.bookmarkBtn.addEventListener('click', toggleBookmark);

  // History/bookmarks/menu buttons
  els.historyBtn.addEventListener('click', () => {
    els.bookmarksPanel.classList.add('hidden');
    els.menuPanel.classList.add('hidden');
    els.historyPanel.classList.toggle('hidden');
    if (!els.historyPanel.classList.contains('hidden')) loadHistory();
  });
  els.bookmarksBtn.addEventListener('click', () => {
    els.historyPanel.classList.add('hidden');
    els.menuPanel.classList.add('hidden');
    els.bookmarksPanel.classList.toggle('hidden');
    if (!els.bookmarksPanel.classList.contains('hidden')) loadBookmarks();
  });
  els.menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    els.historyPanel.classList.add('hidden');
    els.bookmarksPanel.classList.add('hidden');
    els.menuPanel.classList.toggle('hidden');
  });

  // History search
  els.historySearch.addEventListener('input', async (e) => {
    const results = await invoke('search_history', { query: e.target.value });
    renderHistory(results);
  });

  // Clear history
  $('clear-history-btn').addEventListener('click', async () => {
    if (!confirm('Clear all browsing history?')) return;
    await invoke('clear_history');
    loadHistory();
  });

  // Panel close buttons
  document.querySelectorAll('.panel-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      if (target) $(target).classList.add('hidden');
    });
  });

  // Menu items
  $('menu-new-tab').addEventListener('click', () => { createTab('lunar://newtab'); hideAllPanels(); });
  $('menu-new-window').addEventListener('click', () => { createTab('lunar://newtab'); hideAllPanels(); });
  $('menu-history').addEventListener('click', () => { hideAllPanels(); els.historyPanel.classList.remove('hidden'); loadHistory(); });
  $('menu-bookmarks').addEventListener('click', () => { hideAllPanels(); els.bookmarksPanel.classList.remove('hidden'); loadBookmarks(); });
  $('menu-zoom-in').addEventListener('click', () => { zoomActiveTab(0.1); hideAllPanels(); });
  $('menu-zoom-out').addEventListener('click', () => { zoomActiveTab(-0.1); hideAllPanels(); });
  $('menu-settings').addEventListener('click', () => { hideAllPanels(); openSettings(); });
  $('menu-devtools').addEventListener('click', () => {
    if (state.activeTabId) invoke('open_devtools', { tabId: state.activeTabId });
    hideAllPanels();
  });

  // Window controls
  els.winMin.addEventListener('click', () => invoke('window_minimize'));
  els.winMax.addEventListener('click', () => invoke('window_toggle_maximize'));
  els.winClose.addEventListener('click', () => invoke('window_close'));

  // Close panels when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#menu-panel') && !e.target.closest('#menu-btn')) {
      els.menuPanel.classList.add('hidden');
    }
    if (!e.target.closest('#tab-context-menu')) {
      $('tab-context-menu').classList.add('hidden');
    }
  });

  // Settings listeners
  setupSettingsListeners();
}

function hideAllPanels() {
  els.menuPanel.classList.add('hidden');
  els.historyPanel.classList.add('hidden');
  els.bookmarksPanel.classList.add('hidden');
}

function openSettings() {
  populateSettingsInputs();
  els.settingsPanel.classList.remove('hidden');
}

function zoomActiveTab(delta) {
  // Tauri 2 webview zoom API
  // Each tab webview can have its own zoom
  console.log('Zoom adjust:', delta);
}

// ============ TAB CONTEXT MENU ============
function showTabContextMenu(e, tab) {
  e.preventDefault();
  const menu = $('tab-context-menu');
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  menu.classList.remove('hidden');
  menu.dataset.tabId = tab.id;
}

// ============ TAURI EVENT LISTENERS ============
function setupTauriListeners() {
  listen('tabs-updated', (event) => {
    state.tabs = event.payload;
    renderTabs();
  });

  listen('active-tab-changed', (event) => {
    state.activeTabId = event.payload;
    const tab = state.tabs.find(t => t.id === event.payload);
    if (tab) updateUrlBar(tab.url);
    renderTabs();
  });

  listen('settings-changed', (event) => {
    state.settings = event.payload;
    applySettingsToUI();
  });

  listen('bookmarks-updated', () => {
    loadBookmarks();
  });
}

// ============ KEYBOARD SHORTCUTS ============
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 't') {
      e.preventDefault();
      createTab('lunar://newtab');
    } else if (ctrl && e.key === 'w') {
      e.preventDefault();
      if (state.activeTabId) closeTab(state.activeTabId);
    } else if (ctrl && e.key === 'l') {
      e.preventDefault();
      els.urlBar.focus();
    } else if (ctrl && e.key === 'd') {
      e.preventDefault();
      toggleBookmark();
    } else if (ctrl && e.key === 'h') {
      e.preventDefault();
      els.historyPanel.classList.toggle('hidden');
      if (!els.historyPanel.classList.contains('hidden')) loadHistory();
    } else if (ctrl && e.key === ',') {
      e.preventDefault();
      openSettings();
    } else if (e.key === 'F5') {
      e.preventDefault();
      if (state.activeTabId) invoke('reload_tab', { tabId: state.activeTabId });
    } else if (e.key === 'F12') {
      e.preventDefault();
      if (state.activeTabId) invoke('open_devtools', { tabId: state.activeTabId });
    } else if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      if (state.activeTabId) invoke('go_back', { tabId: state.activeTabId });
    } else if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      if (state.activeTabId) invoke('go_forward', { tabId: state.activeTabId });
    } else if (ctrl && e.key === '=' ) {
      e.preventDefault();
      zoomActiveTab(0.1);
    } else if (ctrl && e.key === '-') {
      e.preventDefault();
      zoomActiveTab(-0.1);
    } else if (ctrl && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      // Reopen closed tab (TODO)
    }
  });
}

// ============ HELPERS ============
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============ START ============
init();
