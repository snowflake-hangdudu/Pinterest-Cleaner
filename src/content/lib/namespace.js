(() => {
  'use strict';
  const root = (globalThis.PC = globalThis.PC || {});
  root.STORAGE_KEY = 'pinterest.cleaner.root.v1';
  root.SCHEMA_VERSION = 1;
  root.ATTR = {
    filtered: 'data-pc-filtered',
    reason: 'data-pc-reason',
    rule: 'data-pc-rule',
    processed: 'data-pc-processed',
    module: 'data-pc-module',
    slot: 'data-pc-collapsed-slot'
  };
  root.EXT = typeof browser !== 'undefined' ? browser : chrome;

  root.todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  root.DEFAULT_SETTINGS = Object.freeze({
    schemaVersion: 1,
    enabled: true,
    language: 'en',
    theme: 'obsidian',
    pause: { mode: 'off', until: 0, tabOnly: false },
    showFiltered: false,
    safeMode: false,
    diagnostics: false,
    logLevel: 'WARN',
    ai: { enabled: true, mode: 'standard' },
    ads: {
      enabled: true,
      promoted: true,
      sponsored: true,
      shoppingAds: true,
      feedPromoted: true,
      searchPromoted: true,
      detailPromoted: true
    },
    contentTypes: {
      hideVideo: false,
      hideGif: false,
      hideShopping: false,
      hideIdeaPin: false
    },
    filterPages: {
      home: true,
      search: true,
      detail: true
    },
    pageCleaner: {
      hidePromoModules: true,
      hideShoppingRecs: false,
      hideRelatedRecs: false,
      hideRelatedProducts: false,
      hideInterruptModals: false
    },
    keywordRules: [],
    creatorRules: [],
    domainRules: [],
    whitelistRules: [],
    stats: { day: '', ai: 0, ad: 0, keyword: 0, creator: 0, domain: 0, contentType: 0, pageCleaner: 0, total: 0 }
  });

  root.clampText = (value, max = 4000) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

  root.log = (level, ...args) => {
    const order = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3, TRACE: 4 };
    const current = root.state?.logLevel || 'WARN';
    if ((order[level] ?? 1) > (order[current] ?? 1) && !root.state?.diagnostics) return;
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn('[Pinterest Cleaner]', ...args);
  };
})();
