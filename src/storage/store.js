export function createSettingsStore({ key, defaults = {}, normalize = (value) => value }) {
  if (!key) throw new Error('Settings store requires a key');
  let writeQueue = Promise.resolve();

  function getStorage() {
    const storage = (globalThis.browser ?? globalThis.chrome)?.storage?.local;
    if (!storage) throw new Error('Extension storage.local is unavailable');
    return storage;
  }

  function normalizeValue(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return normalize({ ...defaults, ...source });
  }

  async function load() {
    const data = await getStorage().get(key);
    return normalizeValue(data[key]);
  }

  async function save(patch) {
    const operation = writeQueue.then(async () => {
      const current = await load();
      const changes = typeof patch === 'function' ? patch(current) : patch;
      const next = normalizeValue({ ...current, ...(changes || {}) });
      await getStorage().set({ [key]: next });
      return next;
    });
    writeQueue = operation.catch(() => {});
    return operation;
  }

  async function replace(nextValue) {
    const operation = writeQueue.then(async () => {
      const next = normalizeValue(nextValue || {});
      await getStorage().set({ [key]: next });
      return next;
    });
    writeQueue = operation.catch(() => {});
    return operation;
  }

  async function clear() {
    const operation = writeQueue.then(async () => {
      await getStorage().remove(key);
      return normalizeValue({});
    });
    writeQueue = operation.catch(() => {});
    return operation;
  }

  return { key, defaults, normalize: normalizeValue, load, save, replace, clear };
}
