(() => {
  'use strict';
  const PC = globalThis.PC;

  function noMatch(detector = 'unknown') {
    return { matched: false, confidence: 'low', reason: 'UNKNOWN', detector };
  }

  function safeDetect(name, fn, pin) {
    try {
      return fn(pin);
    } catch (error) {
      PC.log('WARN', `${name} failed`, error);
      PC.diagnostics?.report?.(name, error);
      return noMatch(name);
    }
  }

  function fieldText(pin, fields) {
    const map = {
      title: pin.title || '',
      description: pin.description || '',
      alt: pin.alt || '',
      creator: `${pin.creator?.username || ''} ${pin.creator?.name || ''}`
    };
    return fields.map((field) => map[field] || '').join('\n');
  }

  function matchKeyword(rule, pin) {
    if (!rule.enabled || !rule.keywords?.length) return false;
    let haystack = fieldText(pin, rule.fields || ['title', 'description', 'alt', 'creator']);
    let needles = rule.keywords.slice();
    if (!rule.caseSensitive) {
      haystack = haystack.toLowerCase();
      needles = needles.map((k) => k.toLowerCase());
    }

    const testOne = (keyword) => {
      if (rule.matchType === 'exact') return haystack.split(/\n/).some((line) => line.trim() === keyword);
      if (rule.matchType === 'regex') {
        try {
          return new RegExp(keyword, rule.caseSensitive ? '' : 'i').test(haystack);
        } catch {
          return false;
        }
      }
      return haystack.includes(keyword);
    };

    return rule.operator === 'AND' ? needles.every(testOne) : needles.some(testOne);
  }

  function domainMatches(rule, domain) {
    if (!rule.enabled || !rule.pattern || !domain) return false;
    const pattern = rule.pattern.replace(/^www\./, '').toLowerCase();
    if (rule.matchType === 'exact') return domain === pattern;
    if (rule.matchType === 'subdomain') return domain === pattern || domain.endsWith(`.${pattern}`);
    if (rule.matchType === 'wildcard') {
      const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      try {
        return new RegExp(`^${escaped}$`, 'i').test(domain);
      } catch {
        return false;
      }
    }
    return false;
  }

  PC.detectors = {
    whitelist(pin, settings) {
      return safeDetect('whitelist', (p) => {
        for (const rule of settings.whitelistRules || []) {
          if (!rule.enabled || !rule.value) continue;
          if (rule.type === 'creator') {
            const value = rule.value.replace(/^@/, '').toLowerCase();
            const username = (p.creator?.username || '').toLowerCase();
            const name = (p.creator?.name || '').toLowerCase();
            if (username === value || name === value || username.includes(value)) {
              return { matched: true, confidence: 'high', reason: 'WHITELIST', detector: 'whitelist', ruleId: rule.id };
            }
          }
          if (rule.type === 'domain') {
            const domain = p.source?.domain || '';
            if (domain && (domain === rule.value.toLowerCase() || domain.endsWith(`.${rule.value.toLowerCase()}`))) {
              return { matched: true, confidence: 'high', reason: 'WHITELIST', detector: 'whitelist', ruleId: rule.id };
            }
          }
          if (rule.type === 'keyword') {
            const blob = `${p.title || ''} ${p.description || ''} ${p.alt || ''}`.toLowerCase();
            if (blob.includes(rule.value.toLowerCase())) {
              return { matched: true, confidence: 'high', reason: 'WHITELIST', detector: 'whitelist', ruleId: rule.id };
            }
          }
        }
        return noMatch('whitelist');
      }, pin);
    },

    ai(pin, settings) {
      return safeDetect('ai', (p) => {
        if (!settings.ai?.enabled) return noMatch('ai');
        const mode = settings.ai.mode || 'standard';
        if (p.pinterestAI || PC.textHasAny(p.labels.join(' '), PC.AI_OFFICIAL) || PC.textHasAny(p.textBlob, PC.AI_OFFICIAL)) {
          return { matched: true, confidence: 'high', reason: 'PINTEREST_AI_LABEL', detector: 'ai' };
        }
        if (mode === 'strict') return noMatch('ai');

        const structured = p.labels.some((label) => /ai|gen[_-]?ai|generated/i.test(label))
          || Boolean(p.element.querySelector('[data-test-id*="ai" i]'));
        if (structured) {
          return { matched: true, confidence: 'medium', reason: 'STRUCTURED_AI_SIGNAL', detector: 'ai' };
        }
        if (mode === 'standard') return noMatch('ai');

        if (PC.textHasAny(p.textBlob, PC.AI_HEURISTICS)) {
          return { matched: true, confidence: 'low', reason: 'AI_KEYWORD_HEURISTIC', detector: 'ai' };
        }
        return noMatch('ai');
      }, pin);
    },

    ad(pin, settings) {
      return safeDetect('ad', (p) => {
        if (!settings.ads?.enabled) return noMatch('ad');
        if (settings.safeMode && !p.promoted) return noMatch('ad');
        const labelHit = p.promoted
          || p.labels.some((label) => PC.labelMatches(label, PC.AD_LABELS.promoted))
          || Boolean(PC.selectorRegistry.query(p.element, 'pin.adLabel'));
        if (!labelHit) return noMatch('ad');

        if (p.isShopping && settings.ads.shoppingAds === false) return noMatch('ad');
        if (!settings.ads.promoted && !settings.ads.sponsored) return noMatch('ad');
        return { matched: true, confidence: 'high', reason: 'AD', detector: 'ad' };
      }, pin);
    },

    keyword(pin, settings) {
      return safeDetect('keyword', (p) => {
        for (const rule of settings.keywordRules || []) {
          if (matchKeyword(rule, p)) {
            return { matched: true, confidence: 'high', reason: 'KEYWORD', detector: 'keyword', ruleId: rule.id };
          }
        }
        return noMatch('keyword');
      }, pin);
    },

    creator(pin, settings) {
      return safeDetect('creator', (p) => {
        const username = (p.creator?.username || '').toLowerCase();
        const name = (p.creator?.name || '').toLowerCase();
        for (const rule of settings.creatorRules || []) {
          if (!rule.enabled) continue;
          const u = (rule.username || '').toLowerCase();
          const d = (rule.displayName || '').toLowerCase();
          if ((u && username && (username === u || username.includes(u))) || (d && name && name.includes(d))) {
            return { matched: true, confidence: 'high', reason: 'CREATOR', detector: 'creator', ruleId: rule.id };
          }
        }
        return noMatch('creator');
      }, pin);
    },

    domain(pin, settings) {
      return safeDetect('domain', (p) => {
        const domain = p.source?.domain || '';
        for (const rule of settings.domainRules || []) {
          if (domainMatches(rule, domain)) {
            return { matched: true, confidence: 'high', reason: 'DOMAIN', detector: 'domain', ruleId: rule.id };
          }
        }
        return noMatch('domain');
      }, pin);
    },

    contentType(pin, settings) {
      return safeDetect('contentType', (p) => {
        const cfg = settings.contentTypes || {};
        if (cfg.hideVideo && p.isVideo) return { matched: true, confidence: 'medium', reason: 'CONTENT_TYPE', detector: 'contentType' };
        if (cfg.hideGif && p.isGif) return { matched: true, confidence: 'medium', reason: 'CONTENT_TYPE', detector: 'contentType' };
        if (cfg.hideShopping && p.isShopping) return { matched: true, confidence: 'medium', reason: 'CONTENT_TYPE', detector: 'contentType' };
        if (cfg.hideIdeaPin && p.isIdeaPin) return { matched: true, confidence: 'medium', reason: 'CONTENT_TYPE', detector: 'contentType' };
        return noMatch('contentType');
      }, pin);
    }
  };
})();
