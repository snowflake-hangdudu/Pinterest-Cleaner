(() => {
  'use strict';
  const PC = globalThis.PC;

  function textOf(node) {
    return PC.clampText(node?.textContent || '');
  }

  function promoContext(element) {
    let current = element;
    const baseLinks = Math.max(1, element.querySelectorAll('a[href*="/pin/"]').length);
    for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
      if (!current || current === document.body) break;
      const links = current.querySelectorAll?.('a[href*="/pin/"]')?.length || 0;
      if (links > baseLinks) break;

      if (current.querySelector?.('[data-test-id*="promoted" i], [data-test-id="promoted-label"], [aria-label*="Promoted" i], [aria-label*="Sponsored" i], [aria-label*="赞助" i], [aria-label*="贊助" i]')) {
        return current;
      }

      if (current === element) {
        const chrome = PC.clampText(current.innerText || '', 280);
        if (PC.textHasPromotedLabel?.(chrome) || PC.labelMatches(chrome, PC.AD_LABELS.promoted)) return current;
        continue;
      }

      // Parent chrome/footer beside the pin, but not other pin cards.
      for (const child of current.children) {
        if (child === element || child.contains(element)) continue;
        if (child.querySelectorAll('a[href*="/pin/"]').length) continue;
        const side = PC.clampText(child.innerText || child.getAttribute?.('aria-label') || '', 120);
        if (PC.textHasPromotedLabel?.(side) || PC.labelMatches(side, PC.AD_LABELS.promoted)) return current;
      }
    }
    return null;
  }

  function collectLabels(element) {
    const labels = new Set();
    const scope = promoContext(element) || element;
    for (const node of scope.querySelectorAll('a, span, div, [data-test-id="promoted-label"], [data-test-id*="promoted" i]')) {
      const aria = PC.clampText(node.getAttribute?.('aria-label') || '', 96);
      if (aria && (PC.labelMatches(aria, PC.AD_LABELS.promoted) || PC.textHasPromotedLabel?.(aria))) labels.add(aria);
      if (node.children.length) continue;
      const value = PC.clampText(node.textContent, 96);
      if (value && (PC.labelMatches(value, PC.AD_LABELS.promoted) || PC.textHasPromotedLabel?.(value))) labels.add(value);
    }
    return Array.from(labels);
  }

  function extractDomain(url) {
    try {
      return new URL(url, location.href).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  }

  function findPinRoot(start) {
    let current = start instanceof Element ? start : null;
    for (let depth = 0; current && depth < 14; depth += 1, current = current.parentElement) {
      if (current.matches('[data-test-id="pin"], [data-test-id="pinWrapper"], [data-test-id="pinrep"], [data-grid-item="true"]')) {
        return current;
      }
      if (current.querySelector?.('a[href*="/pin/"]') && current.querySelector('img, video, [style*="background-image"]')) {
        const links = current.querySelectorAll('a[href*="/pin/"]').length;
        if (links === 1 || (links <= 3 && current.querySelectorAll('img').length <= 4)) return current;
      }
    }
    return null;
  }

  function parsePinId(href) {
    const match = String(href || '').match(/\/pin\/(\d+)/);
    return match ? match[1] : undefined;
  }

  PC.extractor = {
    findPinRoot,

    collectCandidates(root) {
      const nodes = new Set();
      const base = root instanceof Element || root instanceof Document ? root : document;
      for (const node of PC.selectorRegistry.queryAll(base, 'pin.container')) nodes.add(node);
      for (const link of base.querySelectorAll?.('a[href*="/pin/"]') || []) {
        const pin = findPinRoot(link);
        if (pin) nodes.add(pin);
      }
      const containing = base instanceof Element ? base.closest('[data-test-id="pin"], [data-test-id="closeup-lego-container"]') : null;
      if (containing) nodes.add(containing);
      const canonical = new Set(Array.from(nodes, (el) => el.closest('[data-test-id="pin"]') || el.querySelector('[data-test-id="pin"]') || el));
      return Array.from(canonical).filter((el) => !Array.from(canonical).some((other) => other !== el && other.contains(el)) && PC.safety.looksLikePin(el));
    },

    extract(element) {
      if (!(element instanceof HTMLElement)) return null;
      const link = PC.selectorRegistry.query(element, 'pin.link') || element.querySelector('a[href*="/pin/"]');
      const titleEl = PC.selectorRegistry.query(element, 'pin.title');
      const descEl = PC.selectorRegistry.query(element, 'pin.description');
      const imageEl = PC.selectorRegistry.query(element, 'pin.image') || element.querySelector('img, video');
      const creatorEl = PC.selectorRegistry.query(element, 'pin.creator');
      const sourceEl = PC.selectorRegistry.query(element, 'pin.source');
      const labels = collectLabels(element);

      let username = '';
      let displayName = '';
      if (creatorEl) {
        const href = creatorEl.getAttribute('href') || '';
        const parts = href.split('/').filter(Boolean);
        username = parts[0] && !['pin', 'search', 'ideas', 'today'].includes(parts[0]) ? parts[0] : '';
        displayName = textOf(creatorEl);
      }

      let sourceUrl = '';
      if (sourceEl?.href && !/pinterest\.com/i.test(sourceEl.href)) sourceUrl = sourceEl.href;
      else {
        const outbound = Array.from(element.querySelectorAll('a[href^="http"]')).find((a) => !/pinterest\.com/i.test(a.href));
        if (outbound) sourceUrl = outbound.href;
      }

      const blob = [
        textOf(titleEl),
        textOf(descEl),
        imageEl?.getAttribute?.('alt') || '',
        labels.join(' '),
        element.innerText || ''
      ].join(' \n ');

      const promoRoot = promoContext(element);
      const promoChrome = PC.clampText(promoRoot?.innerText || blob, 320);
      const promoted = labels.some((label) => PC.labelMatches(label, PC.AD_LABELS.promoted) || PC.textHasPromotedLabel?.(label))
        || PC.labelMatches(blob.slice(0, 400), PC.AD_LABELS.promoted)
        || PC.textHasPromotedLabel?.(promoChrome)
        || Boolean(element.querySelector('[data-test-id*="promoted" i], [aria-label*="Promoted" i], [aria-label*="Sponsored" i], [aria-label*="赞助" i]'))
        || Boolean(promoRoot);

      return {
        id: parsePinId(link?.href) || element.getAttribute('data-test-pin-id') || (element.matches('[data-test-id="closeup-lego-container"]') ? parsePinId(location.pathname) : undefined),
        title: textOf(titleEl) || PC.clampText(imageEl?.getAttribute?.('alt') || '', 300),
        description: textOf(descEl),
        alt: PC.clampText(imageEl?.getAttribute?.('alt') || '', 500),
        creator: {
          username,
          name: displayName,
          id: ''
        },
        source: {
          url: sourceUrl,
          domain: extractDomain(sourceUrl)
        },
        labels,
        isVideo: Boolean(element.querySelector('video, [data-test-id*="video" i], [aria-label*="Video" i]')),
        promoted,
        adKind: labels.some((label) => /sponsored|赞助|贊助|gesponsert|sponsor|patrocin|스폰서/i.test(label)) ? 'sponsored' : 'promoted',
        pageType: location.pathname.startsWith('/search/') ? 'search' : location.pathname.startsWith('/pin/') ? 'detail' : 'feed',
        textBlob: PC.clampText(blob, 8000),
        element
      };
    }
  };
})();
