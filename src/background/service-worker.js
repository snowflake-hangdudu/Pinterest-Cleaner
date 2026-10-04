import { STORAGE_KEY, loadSettings, saveSettings, normalizeSettings, replaceSettings, clearSettings, incrementStats } from '../storage/settings.js';

const EXT = globalThis.browser ?? globalThis.chrome;
const TAB_PAUSE_KEY = 'pinterest.cleaner.pausedTabs';
let pausedTabs = {};
let tabQueue = Promise.resolve();
async function tabPause(tabId, value) {
  const operation = tabQueue.then(async () => {
    if (EXT.storage.session) pausedTabs = (await EXT.storage.session.get(TAB_PAUSE_KEY))[TAB_PAUSE_KEY] || {};
    if (typeof value === 'boolean') {
      if (value) pausedTabs[tabId] = true; else delete pausedTabs[tabId];
      if (EXT.storage.session) await EXT.storage.session.set({ [TAB_PAUSE_KEY]: pausedTabs });
    }
    return Boolean(pausedTabs[tabId]);
  });
  tabQueue = operation.catch(() => {});
  return operation;
}
EXT.tabs.onRemoved.addListener((tabId) => { tabPause(tabId, false).catch(() => {}); });

EXT.runtime.onInstalled.addListener(async () => {
  try {
    await loadSettings();
  } catch (error) {
    console.warn('[Pinterest Cleaner] init settings failed', error);
  }
});

EXT.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  if (message.type === 'PC_GET_TAB_PAUSE' || message.type === 'PC_PAUSE_TAB') {
    const tabId = sender.tab?.id ?? message.tabId;
    if (!Number.isInteger(tabId)) { sendResponse({ ok: false, error: 'No target tab' }); return false; }
    tabPause(tabId, message.type === 'PC_PAUSE_TAB' ? Boolean(message.paused) : undefined)
      .then(async (paused) => {
        if (message.type === 'PC_PAUSE_TAB') { try { await EXT.tabs.sendMessage(tabId, { type: 'PC_SET_TAB_PAUSE', paused }); } catch {} }
        sendResponse({ ok: true, paused });
      }).catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === 'PC_OPEN_OPTIONS') {
    EXT.runtime.openOptionsPage?.();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'PC_GET_SETTINGS') {
    loadSettings().then((settings) => sendResponse({ ok: true, settings })).catch((error) => {
      sendResponse({ ok: false, error: String(error?.message || error) });
    });
    return true;
  }

  if (message.type === 'PC_SAVE_SETTINGS') {
    saveSettings(message.patch || {})
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }

  if (['PC_REPLACE_SETTINGS', 'PC_CLEAR_SETTINGS', 'PC_BUMP_STATS'].includes(message.type)) {
    const operation = message.type === 'PC_REPLACE_SETTINGS' ? replaceSettings(message.value)
      : message.type === 'PC_CLEAR_SETTINGS' ? clearSettings() : incrementStats(message.reason, message.amount);
    operation.then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }

  if (message.type === 'PC_PING') {
    sendResponse({ ok: true, tabId: sender.tab?.id || null, storageKey: STORAGE_KEY });
    return true;
  }

  if (message.type === 'PC_NORMALIZE') {
    sendResponse({ ok: true, settings: normalizeSettings(message.value) });
    return true;
  }

  return false;
});
