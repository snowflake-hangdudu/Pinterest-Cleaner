(() => {
  'use strict';
  const PC = globalThis.PC;

  const REGISTRY = {
    'pin.container': [
      '[data-test-id="pin"]',
      '[data-test-id="pinWrapper"]',
      '[data-test-id="pinrep"]',
      '[data-grid-item="true"]',
      'div[data-test-id*="pin" i]'
    ],
    'pin.link': [
      'a[href*="/pin/"]',
      '[data-test-id="pinrep-image"] a',
      '[data-test-id="pin-card"] a'
    ],
    'pin.title': [
      '[data-test-id="pinrep-title"]',
      '[data-test-id="pinTitle"]',
      '[data-test-id="pin-title"]',
      'h1', 'h2', 'h3'
    ],
    'pin.description': [
      '[data-test-id="pinrep-description"]',
      '[data-test-id="description"]',
      '[data-test-id="pin-description"]'
    ],
    'pin.image': [
      'img',
      '[data-test-id="pinrep-image"] img',
      'video'
    ],
    'pin.creator': [
      '[data-test-id="creator-profile-link"]',
      '[data-test-id="user-avatar"]',
      'a[href^="/"][href*="/"]'
    ],
    'pin.source': [
      '[data-test-id="pinrep-source-link"]',
      'a[rel="nofollow"]',
      'a[href*="://"]'
    ],
    'pin.adLabel': [
      '[data-test-id="promoted-label"]',
      '[data-test-id="pinrep-promoted"]',
      '[aria-label*="Promoted" i]',
      '[aria-label*="Sponsored" i]'
    ],
    'pin.aiLabel': [
      '[data-test-id*="ai" i]',
      '[aria-label*="AI" i]',
      '[aria-label*="Gen AI" i]',
      '[aria-label*="generated" i]'
    ],
    'page.promoModule': [
      '[data-test-id*="promoted" i]',
      '[data-test-id*="ads" i]',
      '[data-test-id*="shopping-module" i]'
    ],
    'page.shoppingRecs': [
      '[data-test-id*="shopping" i]',
      '[data-test-id*="product" i]'
    ],
    'page.related': [
      '[data-test-id*="related" i]',
      '[data-test-id*="more-ideas" i]'
    ]
  };

  PC.selectorRegistry = {
    get(key) {
      return REGISTRY[key] || [];
    },
    query(root, key) {
      const list = this.get(key);
      for (const selector of list) {
        try {
          const hit = root.querySelector(selector);
          if (hit) return hit;
        } catch {
          /* ignore invalid selector */
        }
      }
      return null;
    },
    queryAll(root, key) {
      const seen = new Set();
      const out = [];
      for (const selector of this.get(key)) {
        try {
          for (const node of root.querySelectorAll(selector)) {
            if (!seen.has(node)) {
              seen.add(node);
              out.push(node);
            }
          }
        } catch {
          /* ignore */
        }
      }
      return out;
    },
    healthCheck(doc = document) {
      return {
        pinContainer: this.query(doc, 'pin.container') != null || this.query(doc, 'pin.link') != null,
        title: this.query(doc, 'pin.title') != null,
        creator: this.query(doc, 'pin.creator') != null,
        source: this.query(doc, 'pin.source') != null,
        adLabel: this.query(doc, 'pin.adLabel') != null,
        aiLabel: this.query(doc, 'pin.aiLabel') != null
      };
    }
  };
})();
