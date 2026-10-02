(() => {
  'use strict';
  const PC = globalThis.PC;
  const ATTR = () => PC.ATTR;

  PC.renderer = {
    hide(element, decision) {
      if (!PC.safety.canHide(element)) {
        PC.log('WARN', 'Abort hide: safety check failed');
        return false;
      }
      element.setAttribute(ATTR().filtered, 'true');
      element.setAttribute(ATTR().reason, String(decision.reason || '').toLowerCase());
      if (decision.ruleId) element.setAttribute(ATTR().rule, decision.ruleId);
      element.classList.add('pc-filtered');
      if (PC.state?.showFiltered) {
        element.classList.add('pc-show-filtered');
        element.classList.remove('pc-hide-filtered');
      } else {
        element.classList.add('pc-hide-filtered');
        element.classList.remove('pc-show-filtered');
      }
      return true;
    },

    restore(element) {
      if (!(element instanceof HTMLElement)) return;
      element.removeAttribute(ATTR().filtered);
      element.removeAttribute(ATTR().reason);
      element.removeAttribute(ATTR().rule);
      element.classList.remove('pc-filtered', 'pc-hide-filtered', 'pc-show-filtered');
    },

    restoreAll(root = document) {
      for (const el of root.querySelectorAll(`[${ATTR().filtered}="true"]`)) {
        this.restore(el);
      }
    },

    applyShowFiltered(enabled) {
      for (const el of document.querySelectorAll(`[${ATTR().filtered}="true"]`)) {
        if (enabled) {
          el.classList.add('pc-show-filtered');
          el.classList.remove('pc-hide-filtered');
        } else {
          el.classList.add('pc-hide-filtered');
          el.classList.remove('pc-show-filtered');
        }
      }
    },

    hideModule(element, reason = 'page_cleaner') {
      if (!PC.safety.canHideModule(element)) return false;
      element.setAttribute(ATTR().module, reason);
      element.classList.add('pc-module-hidden');
      return true;
    },

    restoreModules(root = document) {
      for (const el of root.querySelectorAll(`[${ATTR().module}]`)) {
        el.removeAttribute(ATTR().module);
        el.classList.remove('pc-module-hidden');
      }
    }
  };
})();
