(() => {
  'use strict';
  const PC = globalThis.PC;

  PC.observer = {
    healthy: false,
    _mo: null,
    _scheduled: false,
    _pending: new Set(),
    _processed: typeof WeakSet !== 'undefined' ? new WeakSet() : null,
    _seenKeys: new Set(),

    start(onBatch) {
      this.stop();
      this._onBatch = onBatch;
      this.healthy = true;

      this._mo = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            this._pending.add(node);
          }
        }
        this._schedule();
      });

      this._mo.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });

      this.enqueue(document);
      this._hookSpa();
    },

    stop() {
      this._mo?.disconnect();
      this._mo = null;
      this.healthy = false;
      this._pending.clear();
    },

    enqueue(root) {
      if (root) this._pending.add(root);
      this._schedule();
    },

    _schedule() {
      if (this._scheduled) return;
      this._scheduled = true;
      requestAnimationFrame(() => {
        this._scheduled = false;
        const batch = Array.from(this._pending);
        this._pending.clear();
        if (!batch.length) return;
        this._onBatch?.(batch);
      });
    },

    markProcessed(element, key) {
      if (this._processed && element) this._processed.add(element);
      if (key) {
        this._seenKeys.add(key);
        if (this._seenKeys.size > 5000) {
          const keep = Array.from(this._seenKeys).slice(-2500);
          this._seenKeys = new Set(keep);
        }
      }
    },

    wasProcessed(element, key) {
      if (key && this._seenKeys.has(key)) return true;
      return Boolean(this._processed && element && this._processed.has(element));
    },

    _hookSpa() {
      if (this._spaHooked) return;
      this._spaHooked = true;
      const notify = () => {
        this._seenKeys.clear();
        this.enqueue(document);
        PC.onRouteChange?.();
      };
      const wrap = (type) => {
        const original = history[type];
        if (typeof original !== 'function') return;
        history[type] = function patched(...args) {
          const result = original.apply(this, args);
          notify();
          return result;
        };
      };
      wrap('pushState');
      wrap('replaceState');
      window.addEventListener('popstate', notify);
      window.addEventListener('hashchange', notify);
    }
  };
})();
