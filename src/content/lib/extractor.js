(() => {
  'use strict';
  const PC = globalThis.PC;

  function textOf(node) {
    return PC.clampText(node?.textContent || '');
  }

  function collectLabels(element) {
    const labels = new Set();
    const attrs = [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      ...Array.from(element.querySelectorAll('[aria-label], [title], [data-test-id]'), (el) =>
        `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('data-test-id') || ''}`
      )
    ];
    for (const raw of attrs) {
      const value = PC.clampText(raw, 240);
      if (value) labels.add(value);
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
      return Array.from(nodes).filter((el) => PC.safety.looksLikePin(el));
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

      const promoted = labels.some((label) => PC.labelMatches(label, PC.AD_LABELS.promoted))
        || PC.labelMatches(blob.slice(0, 400), PC.AD_LABELS.promoted)
        || Boolean(element.querySelector('[data-test-id*="promoted" i], [aria-label*="Promoted" i], [aria-label*="Sponsored" i]'));

      const pinterestAI = labels.some((label) => PC.textHasAny(label, PC.AI_OFFICIAL))
        || Boolean(element.querySelector('[data-test-id*="gen-ai" i], [data-test-id*="ai-generated" i], [aria-label*="Gen AI" i], [aria-label*="AI generated" i]'));

      return {
        id: parsePinId(link?.href),
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
        isGif: /\.gif($|\?)/i.test(imageEl?.currentSrc || imageEl?.src || '') || /gif/i.test(imageEl?.getAttribute?.('alt') || ''),
        isShopping: (promoted && PC.textHasAny(blob, PC.AD_LABELS.shopping))
          || Boolean(element.querySelector('[data-test-id*="shopping" i], [data-test-id*="product" i]')),
        isIdeaPin: Boolean(element.querySelector('[data-test-id*="story" i], [data-test-id*="idea-pin" i]')),
        pinterestAI,
        promoted,
        textBlob: PC.clampText(blob, 8000),
        element
      };
    }
  };
})();
