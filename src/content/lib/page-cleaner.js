(() => {
  'use strict';
  const PC = globalThis.PC;

  function applyGroup(enabled, key, reason) {
    if (!enabled) {
      for (const el of document.querySelectorAll(`[${PC.ATTR.module}="${reason}"]`)) {
        el.removeAttribute(PC.ATTR.module);
        el.classList.remove('pc-module-hidden');
      }
      return 0;
    }
    let count = 0;
    for (const el of PC.selectorRegistry.queryAll(document, key)) {
      if (PC.renderer.hideModule(el, reason)) count += 1;
    }
    return count;
  }

  PC.pageCleaner = {
    run(settings) {
      if (!settings?.enabled || PC.isPaused?.(settings)) {
        PC.renderer.restoreModules();
        return { total: 0 };
      }
      const cfg = settings.pageCleaner || {};
      const counts = {
        promo: applyGroup(cfg.hidePromoModules, 'page.promoModule', 'promo'),
        shopping: applyGroup(cfg.hideShoppingRecs, 'page.shoppingRecs', 'shopping'),
        related: applyGroup(cfg.hideRelatedRecs, 'page.related', 'related'),
        products: applyGroup(cfg.hideRelatedProducts, 'page.shoppingRecs', 'products')
      };

      if (cfg.hideInterruptModals) {
        for (const el of document.querySelectorAll('[role="dialog"], [data-test-id*="modal" i], [data-test-id*="upsell" i]')) {
          const text = PC.normalizeLabel(el.textContent || '');
          if (/cookie|gdpr|login|sign up|sign-up|log in/.test(text)) continue;
          if (/promo|upgrade|try premium|shopping|ads?/.test(text) && PC.safety.canHideModule(el)) {
            PC.renderer.hideModule(el, 'modal');
            counts.modal = (counts.modal || 0) + 1;
          }
        }
      }

      counts.total = Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
      return counts;
    }
  };
})();
