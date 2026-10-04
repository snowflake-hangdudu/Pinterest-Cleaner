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
      filterPages: { ...base.filterPages, ...(source.filterPages || {}) },
      pageCleaner: { ...base.pageCleaner, ...(source.pageCleaner || {}) },
      keywordRules: Array.isArray(source.keywordRules) ? source.keywordRules : [],
      creatorRules: Array.isArray(source.creatorRules) ? source.creatorRules : [],
      domainRules: Array.isArray(source.domainRules) ? source.domainRules : [],
      whitelistRules: Array.isArray(source.whitelistRules) ? source.whitelistRules : [],
      stats: { ...base.stats, ...(source.stats || {}), day: source.stats?.day || todayKey() }
    };
  }

  PC.isPaused = (settings = PC.state) => {
    if (!settings.enabled || PC.tabPaused) return true;
    const pause = settings.pause || {};
    if (pause.mode === 'until_enable') return true;
    if (pause.mode === 'timed' && Number(pause.until) > Date.now()) return true;
    // Tab pauses are held separately by the background, never global settings.
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

  function persistStats() { /* daily reset is performed by the background writer */ }

  function bump(reason, amount = 1) {
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
      PC.state.stats[key] += amount;
      PC.state.sessionStats[key] += amount;
    }
    PC.state.stats.total += amount;
    PC.state.sessionStats.total += amount;
    EXT.runtime.sendMessage({ type: 'PC_BUMP_STATS', reason, amount }).catch((error) => PC.log('WARN', 'persist stats failed', error));
  }

  function processRoots(roots) {
    const settings = PC.state;
    if (!PC.diagnostics.lastHealth || Date.now() - (PC.diagnostics.healthAt || 0) >= 5000) {
      PC.diagnostics.lastHealth = PC.selectorRegistry.healthCheck(document);
      PC.diagnostics.healthAt = Date.now();
    }
    const health = PC.diagnostics.lastHealth;
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

    const pageType = location.pathname.startsWith('/search/')
      ? 'search'
      : location.pathname.startsWith('/pin/')
        ? 'detail'
        : 'home';
    const pages = effective.filterPages || {};
    const pageEnabled = pageType === 'search'
      ? pages.search !== false
      : pageType === 'detail'
        ? pages.detail !== false
        : pages.home !== false;

    if (!effective.enabled || PC.isPaused(effective) || !pageEnabled) {
      PC.renderer.restoreAll();
      PC.renderer.restoreModules();
      PC.layout?.requestCompact?.();
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
      const alreadyProcessed = element.getAttribute(PC.ATTR.processed) === '1';
      const wasHidden = element.getAttribute(PC.ATTR.filtered) === 'true';
      // Always re-check visible cards that still show promo chrome even after an early ALLOW.
      const forceRecheck = !wasHidden && (pin.promoted || (pin.labels || []).some((label) => PC.textHasPromotedLabel?.(label)));
      if (alreadyProcessed && PC.observer.wasProcessed(element, key) && !forceRecheck) continue;

      PC.diagnostics.counters.scanned += 1;
      const decision = PC.engine.decide(pin, effective);
      element.setAttribute(PC.ATTR.processed, '1');
      PC.observer.markProcessed(element, key);

      if (decision.action === 'HIDE') {
        const ok = PC.renderer.hide(element, decision);
        if (ok && !wasHidden) bump(decision.reason);
        else if (!ok) PC.diagnostics.counters.aborted += 1;
      } else if (wasHidden) {
        PC.renderer.restore(element);
      }
    }

    PC.renderer.applyShowFiltered(Boolean(effective.showFiltered));
    PC.layout?.requestCompact?.();
    updateEmptyNotice();
  }

  function updateEmptyNotice() {
    const id = 'pc-empty-video-notice';
    let notice = document.getElementById(id);
    let batch;
    try { batch = JSON.parse(document.documentElement.getAttribute('data-pc-empty-batch') || 'null'); } catch {}
    const active = batch?.url === location.href && PC.state.enabled && !PC.isPaused(PC.state)
      && PC.state.contentTypes?.hideVideo && !PC.state.showFiltered;
    const hasVisiblePins = Array.from(document.querySelectorAll('[data-test-id="pin"]'))
      .some((pin) => pin.getClientRects().length && getComputedStyle(pin).visibility !== 'hidden');
    if (!active || hasVisiblePins) { notice?.remove(); return; }
    if (notice || !document.body) return;
    notice = document.createElement('div');
    notice.id = id;
    notice.setAttribute('role', 'status');
    const chinese = String(PC.state.language || '').startsWith('zh');
    const text = document.createElement('p');
    text.textContent = chinese
      ? '当前结果已被过滤。视频也可能是普通内容，与广告无关。'
      : 'These results were filtered. Videos can be ordinary content, independently of ads.';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = chinese ? '关闭视频过滤并重新加载' : 'Show videos and reload';
    button.addEventListener('click', () => {
      button.disabled = true;
      EXT.runtime.sendMessage({ type: 'PC_SAVE_SETTINGS', patch: {
        contentTypes: { ...PC.state.contentTypes, hideVideo: false }
      } }).catch(() => { button.disabled = false; });
    });
    notice.append(text, button);
    document.body.append(notice);
  }

  window.addEventListener('pc:empty-batch', () => setTimeout(updateEmptyNotice, 250));

  PC.onRouteChange = () => {
    document.documentElement.removeAttribute('data-pc-empty-batch');
    document.getElementById('pc-empty-video-notice')?.remove();
    PC.renderer.restoreModules();
    processRoots([document]);
  };

  async function refreshFromStorage() {
    await loadState();
    PC.renderer.restoreModules();
    for (const el of document.querySelectorAll(`[${PC.ATTR.processed}]`)) {
      el.removeAttribute(PC.ATTR.processed);
    }
    processRoots([document]);
  }

  EXT.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[PC.STORAGE_KEY]) return;
    const { oldValue, newValue } = changes[PC.STORAGE_KEY];
    const withoutStats = (value) => { const { stats, ...rest } = value || {}; return rest; };
    if (JSON.stringify(withoutStats(oldValue)) === JSON.stringify(withoutStats(newValue))) {
      PC.state.stats = normalizeIncoming(newValue).stats;
      return;
    }
    refreshFromStorage();
  });

  EXT.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const reply = (payload) => {
      try { sendResponse(payload); } catch { /* channel closed */ }
    };

    if (!message || typeof message !== 'object') return false;

    if (message.type === 'PC_SET_TAB_PAUSE') {
      PC.tabPaused = Boolean(message.paused);
      refreshFromStorage().then(() => reply({ ok: true }));
      return true;
    }

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
    try { PC.tabPaused = Boolean((await EXT.runtime.sendMessage({ type: 'PC_GET_TAB_PAUSE' }))?.paused); } catch {}
    PC.observer.start((batch) => processRoots(batch));
    processRoots([document]);
    setInterval(() => {
      if (PC.state.pause?.mode === 'timed' && PC.state.pause.until <= Date.now()) {
        PC.state.pause = { mode: 'off', until: 0, tabOnly: false };
        EXT.runtime.sendMessage({ type: 'PC_SAVE_SETTINGS', patch: { pause: PC.state.pause } }).catch((error) => PC.log('WARN', 'resume failed', error));
        for (const el of document.querySelectorAll(`[${PC.ATTR.processed}]`)) el.removeAttribute(PC.ATTR.processed);
        processRoots([document]);
      }
    }, 1000);
    PC.log('INFO', 'content ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { boot(); }, { once: true });
  } else {
    boot();
  }
})();
