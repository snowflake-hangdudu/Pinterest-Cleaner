(() => {
  'use strict';
  const PC = globalThis.PC;

  const FORBIDDEN = new Set(['BODY', 'HTML', 'MAIN']);

  PC.safety = {
    looksLikePin(element) {
      if (!(element instanceof HTMLElement)) return false;
      if (FORBIDDEN.has(element.tagName)) return false;
      if (element === document.body || element === document.documentElement) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width > window.innerWidth * 0.95 && rect.height > window.innerHeight * 0.8) return false;
      if (rect.width < 40 || rect.height < 40) return false;
      const pinLinks = element.querySelectorAll('a[href*="/pin/"]').length;
      if (pinLinks > 8) return false;
      return true;
    },

    canHide(element) {
      if (!this.looksLikePin(element)) return false;
      if (element.matches('[role="dialog"], [aria-modal="true"]')) return false;
      const parent = element.parentElement;
      if (!parent) return false;
      if (parent === document.body && element.children.length > 20) return false;
      return true;
    },

    canHideModule(element) {
      if (!(element instanceof HTMLElement)) return false;
      if (FORBIDDEN.has(element.tagName)) return false;
      if (element === document.body || element === document.documentElement) return false;
      const rect = element.getBoundingClientRect();
      if (rect.height > window.innerHeight * 0.9) return false;
      if (element.querySelectorAll('a[href*="/pin/"]').length > 40) return false;
      return true;
    }
  };
})();
