(() => {
  'use strict';
  const PC = globalThis.PC;

  PC.diagnostics = {
    errors: [],
    lastHealth: null,
    counters: { scanned: 0, hidden: 0, aborted: 0 },

    report(detector, error) {
      this.errors.push({
        at: Date.now(),
        detector,
        message: String(error?.message || error)
      });
      if (this.errors.length > 40) this.errors.shift();
    },

    snapshot(settings) {
      this.lastHealth = PC.selectorRegistry.healthCheck(document);
      const criticalFail = !this.lastHealth.pinContainer;
      return {
        page: location.pathname,
        detectedPins: this.counters.scanned,
        filtered: { ...PC.state?.sessionStats },
        observer: PC.observer?.healthy ? 'Healthy' : 'Idle',
        selectors: this.lastHealth,
        safeMode: Boolean(settings?.safeMode || criticalFail),
        errors: this.errors.slice(-10)
      };
    }
  };
})();
