(() => {
  'use strict';
  if (window.__PC_DATA_FILTER__) return;
  const parse = JSON.parse;
  let policy = null;
  const CACHE = 'pc.data-policy.v1';
  let parsedInitial = false;
  let missedInitial = false;
  // Warm navigation needs settings synchronously before the site's bootstrap parse.
  // This cache contains only filtering flags; the extension always refreshes it.
  try { policy = parse(sessionStorage.getItem(CACHE) || 'null'); } catch {}
  const stats = { batches: 0, removed: 0 };
  const resources = /^(?:UserHomefeed|BaseSearch|Search|SearchFeed|RelatedModules|RelatedPinFeed|BoardFeed|PinFeed)Resource$/;
  const ready = new Promise((resolve) => {
    const timeout = setTimeout(resolve, 1500);
    window.addEventListener('pc:data-policy', () => { clearTimeout(timeout); resolve(); }, { once: true });
  });
  window.addEventListener('pc:data-policy', (event) => {
    try {
      const previous = JSON.stringify(policy);
      policy = parse(String(event.detail));
      let cached = false;
      try { sessionStorage.setItem(CACHE, JSON.stringify(policy)); cached = true; } catch {}
      // Cold startup or stale cached settings can race the bootstrap parser.
      // Reload once with the now-current cached policy rather than retain wrong data.
      if (cached && parsedInitial && ((missedInitial && filteringActive())
        || (stats.removed > 0 && previous !== JSON.stringify(policy)))) {
        parsedInitial = false;
        missedInitial = false;
        location.reload();
      }
    } catch { policy = null; }
  });

  function baseActive() {
    if (!policy?.enabled || policy.paused || policy.showFiltered) return false;
    if (policy.pauseMode === 'until_enable') return false;
    if (policy.pauseMode === 'timed' && policy.pauseUntil > Date.now()) return false;
    return true;
  }

  function adsActive() {
    return baseActive() && policy.ads?.enabled === true;
  }

  function videoActive() {
    return baseActive() && policy.contentTypes?.hideVideo === true;
  }

  function filteringActive() {
    return adsActive() || videoActive();
  }

  // Site navigation runs in MAIN world; isolated-world history wrappers cannot
  // observe calls made by Pinterest itself.
  let route = location.href;
  function notifyRoute() {
    if (route === location.href) return;
    route = location.href;
    document.documentElement?.removeAttribute('data-pc-empty-batch');
    window.dispatchEvent(new Event('pc:route-change'));
  }
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function() {
      const result = Reflect.apply(original, this, arguments);
      notifyRoute();
      return result;
    };
  }
  window.addEventListener('popstate', notifyRoute);
  window.addEventListener('hashchange', notifyRoute);

  function pageFor(name) {
    if (/Search/.test(name)) return 'search';
    if (/Related(?:Pin|Modules)/.test(name)) return 'detail';
    if (location.pathname.startsWith('/search/')) return 'search';
    if (location.pathname.startsWith('/pin/')) return 'detail';
    return 'home';
  }

  function pageActive(name) {
    const page = pageFor(name);
    const pages = policy?.filterPages || {};
    if (page === 'search') return pages.search !== false;
    if (page === 'detail') return pages.detail !== false;
    return pages.home !== false;
  }

  function isPromotedPin(item) {
    // Only the explicit server flag is authoritative. Ordinary commerce pins stay.
    return item?.type === 'pin' && item.is_promoted === true;
  }

  function isVideoPin(item) {
    if (item?.type !== 'pin') return false;
    // Prefer explicit server markers — same authority bar as is_promoted.
    if (item.is_video === true) return true;
    if (typeof item.creative_type === 'string' && /^video$/i.test(item.creative_type)) return true;
    const hasVideo = (video) => Boolean(video?.video_list
      && typeof video.video_list === 'object' && Object.keys(video.video_list).length);
    if (hasVideo(item.videos)) return true;
    // Story Pins render as videos too; their media lives in page blocks rather
    // than the top-level videos field. Image-only stories must remain visible.
    return Array.isArray(item.story_pin_data?.pages)
      && item.story_pin_data.pages.some((page) => Array.isArray(page?.blocks)
        && page.blocks.some((block) => hasVideo(block?.video)));
  }

  function shouldRemove(item) {
    if (adsActive() && isPromotedPin(item)) return true;
    if (videoActive() && isVideoPin(item)) return true;
    return false;
  }

  function filterArray(items, name) {
    if (!Array.isArray(items) || !filteringActive() || !pageActive(name)) return items;
    const clean = items.filter((item) => !shouldRemove(item));
    if (clean.length === items.length) return items;
    // Keep the server bookmark even when this batch contains no allowed pins.
    // Returning the original pins here leaves holes in the virtual masonry grid.
    if (!clean.length && videoActive()) {
      const detail = JSON.stringify({ url: location.href, resource: name });
      document.documentElement?.setAttribute('data-pc-empty-batch', detail);
      window.dispatchEvent(new CustomEvent('pc:empty-batch', { detail }));
    }
    stats.batches += 1;
    stats.removed += items.length - clean.length;
    return clean;
  }

  function filterData(data, name, depth = 0) {
    if (depth > 8 || !data || typeof data !== 'object') return data;
    if (Array.isArray(data)) {
      const clean = filterArray(data, name);
      // Search mixes pins with related-search modules and nested result groups.
      // Keep those modules and filter only their explicit result-list fields.
      for (const item of clean) {
        if (item && typeof item === 'object' && item.type !== 'pin') {
          filterData(item, name, depth + 1);
        }
      }
      return clean;
    }
    if (data.type === 'pin') return data;
    for (const key of ['data', 'results', 'pins', 'items', 'feed']) {
      if (data[key] && typeof data[key] === 'object') {
        data[key] = filterData(data[key], name, depth + 1);
      }
    }
    return data;
  }

  function filterPayload(payload, requestName = '') {
    if (!payload || typeof payload !== 'object') return payload;
    const name = payload.resource?.name || requestName;
    if (resources.test(name) && payload.resource_response) {
      payload.resource_response.data = filterData(payload.resource_response.data, name);
      // bookmark, status, request parameters and all metadata remain untouched.
    }
    const initial = payload.initialReduxState?.resources;
    if (initial && typeof initial === 'object') {
      for (const [resourceName, cache] of Object.entries(initial)) {
        if (!resources.test(resourceName) || !cache || typeof cache !== 'object') continue;
        for (const entry of Object.values(cache)) {
          if (entry && typeof entry === 'object' && 'data' in entry) entry.data = filterData(entry.data, resourceName);
        }
      }
    }
    return payload;
  }

  function requestName(url) {
    try {
      const parsed = new URL(url, location.href);
      if (parsed.origin !== location.origin) return '';
      const name = parsed.pathname.match(/^\/resource\/([^/]+)\/get\/$/)?.[1] || '';
      return resources.test(name) ? name : '';
    } catch { return ''; }
  }

  function textLooksFilterable(text) {
    if (typeof text !== 'string') return false;
    // Ads path: only responses that carry the promoted flag.
    if (text.includes('is_promoted')) return true;
    // Video path: only responses that carry authoritative video markers.
    if (text.includes('"video_list"') || text.includes('"is_video"') || text.includes('"creative_type"')) return true;
    return false;
  }

  function filterText(text, name = '') {
    if (!textLooksFilterable(text)) return text;
    try {
      const before = stats.removed;
      const value = filterPayload(parse(text), name);
      return before === stats.removed ? text : JSON.stringify(value);
    } catch { return text; }
  }

  // The first screen comes from __PWS_INITIAL_PROPS__, not a later fetch.
  JSON.parse = function(text, reviver) {
    const value = Reflect.apply(parse, this, arguments);
    if (value?.initialReduxState) {
      parsedInitial = true;
      if (!policy) missedInitial = true;
    }
    if (typeof text === 'string' && textLooksFilterable(text)
      && (value?.initialReduxState || value?.resource_response)) return filterPayload(value);
    return value;
  };

  const json = Response.prototype.json;
  Response.prototype.json = async function() {
    const name = requestName(this.url);
    const value = await Reflect.apply(json, this, arguments);
    if (!name) return value;
    await ready;
    return filterPayload(value, name);
  };
  const text = Response.prototype.text;
  Response.prototype.text = async function() {
    const name = requestName(this.url);
    const value = await Reflect.apply(text, this, arguments);
    if (!name) return value;
    await ready;
    return filterText(value, name);
  };

  // Pinterest also uses XMLHttpRequest. Transform only completed feed responses.
  const xhr = XMLHttpRequest.prototype;
  for (const key of ['responseText', 'response']) {
    const descriptor = Object.getOwnPropertyDescriptor(xhr, key);
    if (!descriptor?.get || !descriptor.configurable) continue;
    const cache = new WeakMap();
    Object.defineProperty(xhr, key, {
      ...descriptor,
      get() {
        const value = descriptor.get.call(this);
        const name = requestName(this.responseURL);
        if (this.readyState !== 4 || !name || !filteringActive()) return value;
        const saved = cache.get(this);
        if (saved?.value === value && saved.policy === policy) return saved.filtered;
        let filtered = value;
        if (typeof value === 'string') filtered = filterText(value, name);
        else if (key === 'response' && this.responseType === 'json') filtered = filterPayload(value, name);
        cache.set(this, { value, policy, filtered });
        return filtered;
      }
    });
  }
  window.__PC_DATA_FILTER__ = {
    stats,
    // Exposed for diagnostics / tests in MAIN world.
    isVideoPin,
    isPromotedPin
  };
  window.dispatchEvent(new Event('pc:data-ready'));
})();
