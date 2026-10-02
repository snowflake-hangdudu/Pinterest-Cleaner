import { STORAGE_KEY, loadSettings, saveSettings, normalizeSettings } from '../storage/settings.js';

const EXT = globalThis.browser ?? globalThis.chrome;

EXT.runtime.onInstalled.addListener(async () => {
  try {
    await loadSettings();
  } catch (error) {
    console.warn('[Pinterest Cleaner] init settings failed', error);
  }
});

EXT.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

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
