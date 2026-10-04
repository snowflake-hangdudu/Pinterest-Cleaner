(() => {
  'use strict';
  const PC = globalThis.PC;

  function allow() {
    return { action: 'ALLOW', reason: 'ALLOW' };
  }

  function hide(reason, extra = {}) {
    return { action: 'HIDE', reason, ...extra };
  }

  function pageFilterEnabled(settings, pageType) {
    const pages = settings?.filterPages || {};
    if (pageType === 'search') return pages.search !== false;
    if (pageType === 'detail') return pages.detail !== false;
    return pages.home !== false;
  }

  PC.engine = {
    decide(pin, settings) {
      if (!settings?.enabled) return allow();
      if (PC.isPaused?.(settings)) return allow();
      if (!pageFilterEnabled(settings, pin?.pageType || 'feed')) return allow();

      const whitelist = PC.detectors.whitelist(pin, settings);
      if (whitelist.matched) return { action: 'ALLOW', reason: 'WHITELIST', ruleId: whitelist.ruleId };

      const creator = PC.detectors.creator(pin, settings);
      if (creator.matched) return hide('CREATOR', { ruleId: creator.ruleId, confidence: creator.confidence });

      const domain = PC.detectors.domain(pin, settings);
      if (domain.matched) return hide('DOMAIN', { ruleId: domain.ruleId, confidence: domain.confidence });

      const keyword = PC.detectors.keyword(pin, settings);
      if (keyword.matched) return hide('KEYWORD', { ruleId: keyword.ruleId, confidence: keyword.confidence });

      const ad = PC.detectors.ad(pin, settings);
      if (ad.matched) return hide('AD', { confidence: ad.confidence });

      // The explicitly opened detail pin owns Pinterest's central reserved
      // area. Video filtering applies to recommendations, not this main panel.
      const openedDetail = pin.pageType === 'detail'
        && Boolean(pin.element?.closest?.('[data-test-id="closeup-lego-container"]')
          || pin.element?.querySelector?.('[data-test-id="closeup-lego-container"]'));
      const contentType = openedDetail ? { matched: false } : PC.detectors.contentType(pin, settings);
      if (contentType.matched) {
        if (settings.safeMode) return { action: 'UNCERTAIN', reason: 'CONTENT_TYPE' };
        return hide('CONTENT_TYPE', { confidence: contentType.confidence });
      }

      return allow();
    }
  };
})();
