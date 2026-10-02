import { createSettingsStore } from './store.js';

export const STORAGE_KEY = 'pinterest.cleaner.root.v1';
export const SCHEMA_VERSION = 1;

function uid(prefix = 'rule') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  enabled: true,
  language: 'en',
  theme: 'default',
  pause: {
    mode: 'off',
    until: 0,
    tabOnly: false
  },
  showFiltered: false,
  safeMode: false,
  diagnostics: false,
  logLevel: 'WARN',
  ai: {
    enabled: true,
    mode: 'standard'
  },
  ads: {
    enabled: true,
    promoted: true,
    sponsored: true,
    shoppingAds: true,
    feedPromoted: true,
    searchPromoted: true,
    detailPromoted: true
  },
  contentTypes: {
    hideVideo: false,
    hideGif: false,
    hideShopping: false,
    hideIdeaPin: false
  },
  pageCleaner: {
    hidePromoModules: true,
    hideShoppingRecs: false,
    hideRelatedRecs: false,
    hideRelatedProducts: false,
    hideInterruptModals: false
  },
  keywordRules: [],
  creatorRules: [],
  domainRules: [],
  whitelistRules: [],
  stats: {
    day: '',
    ai: 0,
    ad: 0,
    keyword: 0,
    creator: 0,
    domain: 0,
    contentType: 0,
    pageCleaner: 0,
    total: 0
  }
});

function asBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function asString(value, fallback) {
  return typeof value === 'string' ? value : fallback;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeKeywordRule(rule) {
  const source = rule && typeof rule === 'object' ? rule : {};
  const fields = Array.isArray(source.fields) ? source.fields.filter((f) => ['title', 'description', 'alt', 'creator'].includes(f)) : ['title', 'description', 'alt', 'creator'];
  return {
    id: asString(source.id, uid('kw')),
    enabled: asBoolean(source.enabled, true),
    name: asString(source.name, 'Keyword rule'),
    operator: source.operator === 'AND' ? 'AND' : 'OR',
    keywords: Array.isArray(source.keywords) ? source.keywords.map((k) => String(k)).filter(Boolean) : [],
    fields: fields.length ? fields : ['title', 'description', 'alt', 'creator'],
    matchType: ['contains', 'exact', 'regex'].includes(source.matchType) ? source.matchType : 'contains',
    caseSensitive: asBoolean(source.caseSensitive, false),
    note: asString(source.note, '')
  };
}

function normalizeCreatorRule(rule) {
  const source = rule && typeof rule === 'object' ? rule : {};
  return {
    id: asString(source.id, uid('cr')),
    enabled: asBoolean(source.enabled, true),
    username: asString(source.username, '').replace(/^@/, '').trim(),
    displayName: asString(source.displayName, '').trim(),
    creatorId: asString(source.creatorId, '').trim(),
    note: asString(source.note, '')
  };
}

function normalizeDomainRule(rule) {
  const source = rule && typeof rule === 'object' ? rule : {};
  return {
    id: asString(source.id, uid('dm')),
    enabled: asBoolean(source.enabled, true),
    pattern: asString(source.pattern, '').trim().toLowerCase(),
    matchType: ['exact', 'subdomain', 'wildcard'].includes(source.matchType) ? source.matchType : 'exact',
    note: asString(source.note, '')
  };
}

function normalizeWhitelistRule(rule) {
  const source = rule && typeof rule === 'object' ? rule : {};
  return {
    id: asString(source.id, uid('wl')),
    enabled: asBoolean(source.enabled, true),
    type: ['creator', 'domain', 'keyword'].includes(source.type) ? source.type : 'keyword',
    value: asString(source.value, '').trim(),
    note: asString(source.note, '')
  };
}

function normalizeStats(stats) {
  const source = stats && typeof stats === 'object' ? stats : {};
  const day = asString(source.day, todayKey());
  if (day !== todayKey()) {
    return { ...DEFAULT_SETTINGS.stats, day: todayKey() };
  }
  return {
    day,
    ai: Number(source.ai) || 0,
    ad: Number(source.ad) || 0,
    keyword: Number(source.keyword) || 0,
    creator: Number(source.creator) || 0,
    domain: Number(source.domain) || 0,
    contentType: Number(source.contentType) || 0,
    pageCleaner: Number(source.pageCleaner) || 0,
    total: Number(source.total) || 0
  };
}

export function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const pause = source.pause && typeof source.pause === 'object' ? source.pause : {};
  const ai = source.ai && typeof source.ai === 'object' ? source.ai : {};
  const ads = source.ads && typeof source.ads === 'object' ? source.ads : {};
  const contentTypes = source.contentTypes && typeof source.contentTypes === 'object' ? source.contentTypes : {};
  const pageCleaner = source.pageCleaner && typeof source.pageCleaner === 'object' ? source.pageCleaner : {};

  return {
    schemaVersion: SCHEMA_VERSION,
    enabled: asBoolean(source.enabled, DEFAULT_SETTINGS.enabled),
    language: ['en', 'zh-CN', 'auto'].includes(source.language) ? source.language : DEFAULT_SETTINGS.language,
    theme: asString(source.theme, DEFAULT_SETTINGS.theme).match(/^[a-z][a-z0-9-]{0,40}$/) ? source.theme : DEFAULT_SETTINGS.theme,
    pause: {
      mode: ['off', 'timed', 'tab', 'until_enable'].includes(pause.mode) ? pause.mode : 'off',
      until: Number(pause.until) || 0,
      tabOnly: asBoolean(pause.tabOnly, false)
    },
    showFiltered: asBoolean(source.showFiltered, false),
    safeMode: asBoolean(source.safeMode, false),
    diagnostics: asBoolean(source.diagnostics, false),
    logLevel: ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].includes(source.logLevel) ? source.logLevel : 'WARN',
    ai: {
      enabled: asBoolean(ai.enabled, true),
      mode: ['strict', 'standard', 'aggressive'].includes(ai.mode) ? ai.mode : 'standard'
    },
    ads: {
      enabled: asBoolean(ads.enabled, true),
      promoted: asBoolean(ads.promoted, true),
      sponsored: asBoolean(ads.sponsored, true),
      shoppingAds: asBoolean(ads.shoppingAds, true),
      feedPromoted: asBoolean(ads.feedPromoted, true),
      searchPromoted: asBoolean(ads.searchPromoted, true),
      detailPromoted: asBoolean(ads.detailPromoted, true)
    },
    contentTypes: {
      hideVideo: asBoolean(contentTypes.hideVideo, false),
      hideGif: asBoolean(contentTypes.hideGif, false),
      hideShopping: asBoolean(contentTypes.hideShopping, false),
      hideIdeaPin: asBoolean(contentTypes.hideIdeaPin, false)
    },
    pageCleaner: {
      hidePromoModules: asBoolean(pageCleaner.hidePromoModules, true),
      hideShoppingRecs: asBoolean(pageCleaner.hideShoppingRecs, false),
      hideRelatedRecs: asBoolean(pageCleaner.hideRelatedRecs, false),
      hideRelatedProducts: asBoolean(pageCleaner.hideRelatedProducts, false),
      hideInterruptModals: asBoolean(pageCleaner.hideInterruptModals, false)
    },
    keywordRules: Array.isArray(source.keywordRules) ? source.keywordRules.map(normalizeKeywordRule) : [],
    creatorRules: Array.isArray(source.creatorRules) ? source.creatorRules.map(normalizeCreatorRule) : [],
    domainRules: Array.isArray(source.domainRules) ? source.domainRules.map(normalizeDomainRule) : [],
    whitelistRules: Array.isArray(source.whitelistRules) ? source.whitelistRules.map(normalizeWhitelistRule) : [],
    stats: normalizeStats(source.stats)
  };
}

const store = createSettingsStore({
  key: STORAGE_KEY,
  defaults: DEFAULT_SETTINGS,
  normalize: normalizeSettings
});

export const loadSettings = store.load;
export const saveSettings = store.save;
export const replaceSettings = store.replace;
export const clearSettings = store.clear;

export function createId(prefix) {
  return uid(prefix);
}

export function bumpStat(stats, reason) {
  const next = normalizeStats(stats);
  const map = {
    AI: 'ai',
    AD: 'ad',
    KEYWORD: 'keyword',
    CREATOR: 'creator',
    DOMAIN: 'domain',
    CONTENT_TYPE: 'contentType',
    PAGE_CLEANER: 'pageCleaner'
  };
  const key = map[reason];
  if (key) next[key] += 1;
  next.total += 1;
  return next;
}

export function exportBackup(settings) {
  const data = normalizeSettings(settings);
  return {
    app: 'pinterest-cleaner',
    exportedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    settings: {
      ...data,
      stats: { ...DEFAULT_SETTINGS.stats, day: todayKey() }
    }
  };
}

export function importBackup(raw) {
  const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const settings = payload?.settings || payload;
  return normalizeSettings(settings);
}
