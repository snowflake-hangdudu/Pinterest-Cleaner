(() => {
  'use strict';
  const PC = globalThis.PC;
  PC.layout?.dispose?.();
  const slots = new WeakMap();

  function resolveSlot(pin) {
    if (!(pin instanceof HTMLElement)) return null;
    return pin.closest('[data-grid-item="true"]') || pin.closest('[data-test-id="pinrep"]') || pin;
  }

  function clear(slot) {
    if (!(slot instanceof HTMLElement)) return;
    slot.removeAttribute(PC.ATTR.slot);
    slot.classList.remove('pc-slot-collapsed', 'pc-flow-collapsed');
  }

  PC.layout = {
    resolveSlot,
    collapse(pin) {
      const slot = resolveSlot(pin);
      if (!slot) return null;
      slots.set(pin, slot);
      slot.setAttribute(PC.ATTR.slot, '1');
      slot.classList.add('pc-slot-collapsed', 'pc-flow-collapsed');
      return slot;
    },
    expand(pin) {
      clear(slots.get(pin) || pin?.closest?.(`[${PC.ATTR.slot}="1"]`) || pin);
      slots.delete(pin);
    },
    expandAll(root = document) {
      for (const slot of root.querySelectorAll(`[${PC.ATTR.slot}="1"]`)) clear(slot);
    },
    // Pinterest owns coordinates, feed height and virtualization after data filtering.
    requestCompact() {},
    dispose() {}
  };
})();
