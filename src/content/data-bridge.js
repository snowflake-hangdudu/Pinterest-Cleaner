(() => {
  'use strict';
  const EXT = globalThis.browser ?? globalThis.chrome;
  const KEY = 'pinterest.cleaner.root.v1';
  let settings = null;
  let tabPaused = false;
  let previous = null;
  let reloadTimer;
  function publish(reload = false) {
    if (!settings) return;
    const value = JSON.stringify({
      enabled: settings.enabled !== false,
      ads: {
        enabled: settings.ads?.enabled !== false
      },
      contentTypes: {
        hideVideo: Boolean(settings.contentTypes?.hideVideo)
      },
      filterPages: {
        home: settings.filterPages?.home !== false,
        search: settings.filterPages?.search !== false,
        detail: settings.filterPages?.detail !== false
      },
      paused: tabPaused,
      pauseMode: settings.pause?.mode || 'off',
      pauseUntil: Number(settings.pause?.until) || 0,
      showFiltered: Boolean(settings.showFiltered)
    });
    window.dispatchEvent(new CustomEvent('pc:data-policy', { detail: value }));
    // Removed response items cannot be restored from the DOM. A changed policy
    // needs a fresh feed; stats/theme/language changes never cause navigation.
    if (reload && previous !== null && previous !== value) {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => location.reload(), 200);
    }
    previous = value;
  }
  window.addEventListener('pc:data-ready', () => publish());
  EXT.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[KEY]) return;
    settings = changes[KEY].newValue || {};
    publish(true);
  });
  EXT.runtime.onMessage.addListener((message) => {
    if (message?.type === 'PC_SET_SHOW_FILTERED' && settings) {
      settings = { ...settings, showFiltered: Boolean(message.value) };
      publish(true);
      return false;
    }
    if (message?.type !== 'PC_SET_TAB_PAUSE') return false;
    tabPaused = Boolean(message.paused);
    publish(true);
    return false;
  });
  Promise.all([
    EXT.storage.local.get(KEY),
    EXT.runtime.sendMessage({ type: 'PC_GET_TAB_PAUSE' }).catch(() => ({ paused: false }))
  ]).then(([data, pause]) => {
    if (settings === null) settings = data[KEY] || {};
    tabPaused = Boolean(pause?.paused);
    publish();
  }).catch(() => {});
})();
