(() => {
  'use strict';
  const PC = globalThis.PC;

  function allow() {
    return { action: 'ALLOW', reason: 'ALLOW' };
  }

  function hide(reason, extra = {}) {
    return { action: 'HIDE', reason, ...extra };
  }

  PC.engine = {
    decide(pin, settings) {
      if (!settings?.enabled) return allow();
      if (PC.isPaused?.(settings)) return allow();

      const whitelist = PC.detectors.whitelist(pin, settings);
      if (whitelist.matched) {
        return { action: 'ALLOW', reason: 'WHITELIST', ruleId: whitelist.ruleId, confidence: whitelist.confidence };
      }

      const creator = PC.detectors.creator(pin, settings);
      if (creator.matched) return hide('CREATOR', { ruleId: creator.ruleId, confidence: creator.confidence });

      const domain = PC.detectors.domain(pin, settings);
      if (domain.matched) return hide('DOMAIN', { ruleId: domain.ruleId, confidence: domain.confidence });

      const keyword = PC.detectors.keyword(pin, settings);
      if (keyword.matched) return hide('KEYWORD', { ruleId: keyword.ruleId, confidence: keyword.confidence });

      const ai = PC.detectors.ai(pin, settings);
      if (ai.matched) {
        if (settings.safeMode && ai.confidence === 'low') return { action: 'UNCERTAIN', reason: 'AI', confidence: ai.confidence };
        return hide('AI', { confidence: ai.confidence, detail: ai.reason });
      }

      const ad = PC.detectors.ad(pin, settings);
      if (ad.matched) return hide('AD', { confidence: ad.confidence });

      const contentType = PC.detectors.contentType(pin, settings);
      if (contentType.matched) {
        if (settings.safeMode) return { action: 'UNCERTAIN', reason: 'CONTENT_TYPE' };
        return hide('CONTENT_TYPE', { confidence: contentType.confidence });
      }

      return allow();
    }
  };
})();
