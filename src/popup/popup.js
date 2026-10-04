import { applyTranslations, languageOptionLabelKey, resolveLanguage, themeDisplayName, translate } from '../shared/i18n.js';
import { loadSettings, saveSettings } from '../storage/settings.js';
import {
  applyTheme,
  loadThemeDefinitions,
  renderThemePicker,
  resolveTheme,
  syncThemePicker
} from '../ui/theme.js';

const EXT = globalThis.browser ?? globalThis.chrome;
const byId = (id) => document.getElementById(id);

const featurePanel = byId('feature-panel');
const settingsPanel = byId('settings-panel');
const openSettings = byId('open-settings');
const backFeature = byId('back-feature');
const themePicker = byId('theme-picker');
const themeStatus = byId('theme-status');
const languageSelect = byId('language-select');
const powerDot = byId('power-dot');

const switches = {
  enabled: byId('enabled'),
  adsEnabled: byId('ads-enabled'),
  hideVideo: byId('hide-video'),
  showFiltered: byId('show-filtered')
};
const filterPages = byId('filter-pages');

let settings = null;
let language = 'en';
let themes = [];
let writing = false;

function t(key, vars) {
  return translate(language, key, vars);
}

function showStatus(el, message, tone = 'info') {
  if (!el) return;
  el.textContent = message || '';
  el.dataset.tone = tone;
  el.classList.toggle('hidden', !message);
}

function setSwitch(button, on) {
  button.classList.toggle('on', on);
  button.setAttribute('aria-checked', String(on));
}

function themeLabel(id, fallback) {
  return themeDisplayName(id, language, fallback);
}

function selectView(name) {
  const showSettings = name === 'settings';
  featurePanel.classList.toggle('is-active', !showSettings);
  settingsPanel.classList.toggle('is-active', showSettings);
  featurePanel.toggleAttribute('inert', showSettings);
  settingsPanel.toggleAttribute('inert', !showSettings);
  openSettings.classList.toggle('is-active', !showSettings);
  backFeature.classList.toggle('is-active', showSettings);
  openSettings.toggleAttribute('inert', showSettings);
  backFeature.toggleAttribute('inert', !showSettings);
  if (showSettings) backFeature.focus();
  else openSettings.focus();
}

function renderLanguageOptions() {
  for (const option of languageSelect.options) {
    option.textContent = t(languageOptionLabelKey(option.value));
  }
  languageSelect.value = resolveLanguage(settings.language);
}

function paintTheme(themeId) {
  applyTheme(document.body, themeId, themes);
  syncThemePicker(themePicker, themes, themeId, themeLabel);
}

function render() {
  if (!settings) return;
  language = resolveLanguage(settings.language);
  applyTranslations(document, language);
  renderLanguageOptions();
  paintTheme(settings.theme);
  setSwitch(switches.enabled, settings.enabled);
  setSwitch(switches.adsEnabled, settings.ads.enabled);
  setSwitch(switches.hideVideo, Boolean(settings.contentTypes?.hideVideo));
  setSwitch(switches.showFiltered, Boolean(settings.showFiltered));
  syncFilterPages();
  powerDot.classList.toggle('is-on', settings.enabled);
  powerDot.classList.toggle('is-off', !settings.enabled);
  document.body.classList.toggle('is-paused', settings.pause?.mode && settings.pause.mode !== 'off');
}

async function persist(patch) {
  writing = true;
  try {
    settings = await saveSettings(patch);
    render();
    const [tab] = await EXT.tabs?.query?.({ active: true, currentWindow: true }) || [];
    if (tab?.id) {
      try { await EXT.tabs.sendMessage(tab.id, { type: 'PC_RESCAN' }); } catch { /* ignore */ }
    }
  } catch {
    showStatus(themeStatus, t('saveFailed'), 'error');
  } finally {
    writing = false;
  }
}

function bindSwitch(button, read, write) {
  button.addEventListener('click', () => {
    const next = !read();
    setSwitch(button, next);
    write(next);
  });
}

bindSwitch(switches.enabled, () => settings.enabled, (enabled) => persist({
  enabled,
  pause: enabled ? { mode: 'off', until: 0, tabOnly: false } : settings.pause
}));
bindSwitch(switches.adsEnabled, () => settings.ads.enabled, (enabled) => persist({ ads: { ...settings.ads, enabled } }));
bindSwitch(switches.hideVideo, () => Boolean(settings.contentTypes?.hideVideo), (hideVideo) => persist({
  contentTypes: { ...settings.contentTypes, hideVideo }
}));
bindSwitch(switches.showFiltered, () => Boolean(settings.showFiltered), (showFiltered) => persist({ showFiltered }));

function syncFilterPages() {
  const cfg = settings?.filterPages || {};
  for (const button of filterPages.querySelectorAll('[data-page]')) {
    const on = cfg[button.dataset.page] !== false;
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', String(on));
  }
}

filterPages.addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (!button || !settings) return;
  const key = button.dataset.page;
  const cfg = { ...settings.filterPages };
  const next = cfg[key] === false;
  if (!next) {
    const othersOn = ['home', 'search', 'detail'].some((item) => item !== key && cfg[item] !== false);
    if (!othersOn) return;
  }
  cfg[key] = next;
  persist({ filterPages: cfg });
});

languageSelect.addEventListener('change', () => persist({ language: languageSelect.value }));

themePicker.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-theme-id]');
  if (!button || !settings) return;
  const nextTheme = button.dataset.themeId;
  const previous = settings.theme;
  paintTheme(nextTheme);
  showStatus(themeStatus, t('saving'), 'info');
  try {
    settings = await saveSettings({ theme: nextTheme });
    syncThemePicker(themePicker, themes, settings.theme, themeLabel);
    showStatus(themeStatus, t('saved'), 'ok');
  } catch {
    paintTheme(previous);
    showStatus(themeStatus, t('saveFailed'), 'error');
  }
});

openSettings.addEventListener('click', () => selectView('settings'));
backFeature.addEventListener('click', () => selectView('feature'));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && settingsPanel.classList.contains('is-active')) {
    selectView('feature');
  }
});

const OPEN_SECTION_KEY = 'pc.options.openSection';

async function openOptionsSection(section) {
  const target = section || 'home';
  // Chrome options_ui often drops URL hash; pass the section via storage instead.
  await EXT.storage.local.set({ [OPEN_SECTION_KEY]: target });
  try {
    await EXT.runtime.openOptionsPage();
  } catch {
    const base = EXT.runtime.getURL('src/options/options.html');
    await EXT.tabs.create({ url: `${base}#${target}` });
  }
}

byId('open-full-settings').addEventListener('click', () => openOptionsSection('home'));

EXT.storage?.onChanged?.addListener((changes, area) => {
  if (area !== 'local' || writing || !changes['pinterest.cleaner.root.v1']) return;
  loadSettings().then((value) => {
    settings = value;
    render();
  }).catch(() => {});
});

Promise.all([loadSettings(), loadThemeDefinitions()])
  .then(([value, themeList]) => {
    settings = value;
    themes = themeList;
    renderThemePicker(themePicker, themes);
    paintTheme(resolveTheme(settings.theme, themes)?.id || 'obsidian');
    render();
  })
  .catch(() => {
    showStatus(themeStatus, translate('en', 'loadFailed'), 'error');
  });
