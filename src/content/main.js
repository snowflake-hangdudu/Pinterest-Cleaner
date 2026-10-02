(() => {
  'use strict';

  if (globalThis.__PC_INIT__) return;
  globalThis.__PC_INIT__ = true;

  const PC = globalThis.PC;
  const EXT = PC.EXT;

  PC.state = {
    ...structuredCloneSafe(PC.DEFAULT_SETTINGS),
    sessionStats: { ai: 0, ad: 0, keyword: 0, creator: 0, domain: 0, contentType: 0, pageCleaner: 0, total: 0 },
    showFiltered: false
  };

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function todayKey() {
    return PC.todayKey();
  }

  function normalizeIncoming(raw) {
    const base = structuredCloneSafe(PC.DEFAULT_SETTINGS);
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      ...base,
      ...source,
      pause: { ...base.pause, ...(source.pause || {}) },
      ai: { ...base.ai, ...(source.ai || {}) },
      ads: { ...base.ads, ...(source.ads || {}) },
      contentTypes: { ...base.contentTypes, ...(source.contentTypes || {}) },
      pageCleaner: { ...base.pageCleaner, ...(source.pageCleaner || {}) },
      keywordRules: Array.isArray(source.keywordRules) ? source.keywordRules : [],
      creatorRules: Array.isArray(source.creatorRules) ? source.creatorRules : [],
      domainRules: Array.isArray(source.domainRules) ? source.domainRules : [],
      whitelistRules: Array.isArray(source.whitelistRules) ? source.whitelistRules : [],
      stats: { ...base.stats, ...(source.stats || {}), day: source.stats?.day || todayKey() }
    };
  }

  PC.isPaused = (settings = PC.state) => {
    if (!settings.enabled) return true;
    const pause = settings.pause || {};
    if (pause.mode === 'until_enable') return true;
    if (pause.mode === 'timed' && Number(pause.until) > Date.now()) return true;
    if (pause.mode === 'tab' && pause.tabOnly) return true;
    return false;
  };

  async function loadState() {
    const data = await EXT.storage.local.get(PC.STORAGE_KEY);
    PC.state = {
      ...normalizeIncoming(data[PC.STORAGE_KEY]),
      sessionStats: PC.state.sessionStats
    };
    PC.state.showFiltered = Boolean(PC.state.showFiltered);
    maybeResetStats();
  }

  function maybeResetStats() {
    if (PC.state.stats.day !== todayKey()) {
      PC.state.stats = {
        day: todayKey(),
        ai: 0, ad: 0, keyword: 0, creator: 0, domain: 0, contentType: 0, pageCleaner: 0, total: 0
      };
      persistStats();
    }
  }

  let statsTimer = 0;
  function persistStats() {
    clearTimeout(statsTimer);
    statsTimer = setTimeout(async () => {
      try {
        const data = await EXT.storage.local.get(PC.STORAGE_KEY);
        const current = normalizeIncoming(data[PC.STORAGE_KEY]);
        current.stats = PC.state.stats;
        await EXT.storage.local.set({ [PC.STORAGE_KEY]: current });
      } catch (error) {
        PC.log('WARN', 'persist stats failed', error);
      }
    }, 400);
  }

  function bump(reason) {
    const map = {
      AI: 'ai',
      AD: 'ad',
      KEYWORD: 'keyword',
      CREATOR: 'creator',
      DOMAIN: 'domain',
      CONTENT_TYPE: 'contentType',
      PAGE_CLEANER: 'pageCleaner'
    };
    maybeResetStats();
    const key = map[reason];
    if (key) {
      PC.state.stats[key] += 1;
      PC.state.sessionStats[key] += 1;
    }
    PC.state.stats.total += 1;
    PC.state.sessionStats.total += 1;
    persistStats();
  }

  function processRoots(roots) {
    const settings = PC.state;
    const health = PC.selectorRegistry.healthCheck(document);
    if (!health.pinContainer && settings.safeMode !== true) {
      // soft safe mode when structure missing
      settings._autoSafe = true;
    } else {
      settings._autoSafe = false;
    }
    const effective = {
      ...settings,
      safeMode: settings.safeMode || settings._autoSafe
    };

    if (!effective.enabled || PC.isPaused(effective)) {
      PC.renderer.restoreAll();
      PC.renderer.restoreModules();
      return;
    }

    const candidates = new Set();
    for (const root of roots) {
      for (const node of PC.extractor.collectCandidates(root)) candidates.add(node);
    }

    for (const element of candidates) {
      const pin = PC.extractor.extract(element);
      if (!pin) continue;
      const key = pin.id || `${pin.title}|${pin.creator?.username}|${pin.source?.domain}`;
      if (PC.observer.wasProcessed(element, key) && element.getAttribute(PC.ATTR.processed) === '1') {
        // still re-evaluate if settings may have changed; fall through carefully
      }

      PC.diagnostics.counters.scanned += 1;
      const decision = PC.engine.decide(pin, effective);
      element.setAttribute(PC.ATTR.processed, '1');
      PC.observer.markProcessed(element, key);

      if (decision.action === 'HIDE') {
        const ok = PC.renderer.hide(element, decision);
        if (ok) bump(decision.reason);
        else PC.diagnostics.counters.aborted += 1;
      } else if (element.getAttribute(PC.ATTR.filtered) === 'true') {
        PC.renderer.restore(element);
      }
    }

    const moduleResult = PC.pageCleaner.run(effective);
    if (moduleResult.total > 0) bump('PAGE_CLEANER');

    PC.renderer.applyShowFiltered(Boolean(effective.showFiltered));
  }

  PC.onRouteChange = () => {
    PC.renderer.restoreModules();
    processRoots([document]);
  };

  async function refreshFromStorage() {
    await loadState();
    for (const el of document.querySelectorAll(`[${PC.ATTR.processed}]`)) {
      el.removeAttribute(PC.ATTR.processed);
    }
    processRoots([document]);
  }

  EXT.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[PC.STORAGE_KEY]) return;
    refreshFromStorage();
  });

  EXT.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const reply = (payload) => {
      try { sendResponse(payload); } catch { /* channel closed */ }
    };

    if (!message || typeof message !== 'object') return false;

    if (message.type === 'PC_GET_STATUS') {
      reply({
        ok: true,
        stats: PC.state.stats,
        sessionStats: PC.state.sessionStats,
        diagnostics: PC.diagnostics.snapshot(PC.state),
        paused: PC.isPaused(PC.state),
        enabled: PC.state.enabled,
        showFiltered: PC.state.showFiltered
      });
      return true;
    }

    if (message.type === 'PC_SET_SHOW_FILTERED') {
      PC.state.showFiltered = Boolean(message.value);
      PC.renderer.applyShowFiltered(PC.state.showFiltered);
      reply({ ok: true });
      return true;
    }

    if (message.type === 'PC_RESCAN') {
      refreshFromStorage().then(() => reply({ ok: true }));
      return true;
    }

    return false;
  });

  async function boot() {
    await loadState();
    PC.observer.start((batch) => processRoots(batch));
    processRoots([document]);
    PC.log('INFO', 'content ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { boot(); }, { once: true });
  } else {
    boot();
  }
})();
