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
  theme: 'obsidian',
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
  filterPages: {
    home: true,
    search: true,
    detail: true
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
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  const filterPages = source.filterPages && typeof source.filterPages === 'object' ? source.filterPages : {};
  const pageCleaner = source.pageCleaner && typeof source.pageCleaner === 'object' ? source.pageCleaner : {};

  return {
    schemaVersion: SCHEMA_VERSION,
    enabled: asBoolean(source.enabled, DEFAULT_SETTINGS.enabled),
    language: (() => {
      if (source.language === 'zh-CN' || source.language === 'zh-TW' || source.language === 'en') return source.language;
      if (source.language === 'auto') {
        const browserLang = globalThis.chrome?.i18n?.getUILanguage?.()
          || globalThis.browser?.i18n?.getUILanguage?.()
          || globalThis.navigator?.language
          || 'en';
        if (/zh[-_]?(?:tw|hk|mo|hant)\b/i.test(browserLang)) return 'zh-TW';
        if (/^zh\b/i.test(browserLang)) return 'zh-CN';
        return 'en';
      }
      return DEFAULT_SETTINGS.language;
    })(),
    theme: (() => {
      const raw = asString(source.theme, DEFAULT_SETTINGS.theme);
      if (raw === 'default') return DEFAULT_SETTINGS.theme;
      return /^[a-z][a-z0-9-]{0,40}$/.test(raw) ? raw : DEFAULT_SETTINGS.theme;
    })(),
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
    filterPages: (() => {
      const home = asBoolean(filterPages.home, true);
      const search = asBoolean(filterPages.search, true);
      const detail = asBoolean(filterPages.detail, true);
      if (!home && !search && !detail) return { home: true, search: false, detail: false };
      return { home, search, detail };
    })(),
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
async function writeThroughBackground(type, value, local) {
  const runtime = (globalThis.browser ?? globalThis.chrome)?.runtime;
  if (typeof document !== 'undefined' && runtime?.sendMessage) {
    const response = await runtime.sendMessage({ type, value, patch: value });
    if (!response?.ok) throw new Error(response?.error || 'Settings write failed');
    return response.settings;
  }
  return local(value);
}
export const saveSettings = (patch) => writeThroughBackground('PC_SAVE_SETTINGS', patch, store.save);
export const replaceSettings = (value) => writeThroughBackground('PC_REPLACE_SETTINGS', value, store.replace);
export const clearSettings = () => writeThroughBackground('PC_CLEAR_SETTINGS', undefined, store.clear);
export const incrementStats = (reason, amount = 1) => store.save((current) => {
  const stats = normalizeStats(current.stats);
  const key = { AI: 'ai', AD: 'ad', KEYWORD: 'keyword', CREATOR: 'creator', DOMAIN: 'domain', CONTENT_TYPE: 'contentType', PAGE_CLEANER: 'pageCleaner' }[reason];
  if (key && Number.isInteger(amount) && amount > 0 && amount <= 1000) { stats[key] += amount; stats.total += amount; }
  return { stats };
});

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
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid backup');
  if (payload.app && payload.app !== 'pinterest-cleaner') throw new Error('Backup belongs to a different application');
  const settings = payload.settings || payload;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Invalid settings');
  if (Number(payload.schemaVersion || settings.schemaVersion || 1) > SCHEMA_VERSION) throw new Error('Backup requires a newer extension version');
  if (!['enabled', 'ai', 'keywordRules', 'creatorRules', 'domainRules', 'whitelistRules', 'schemaVersion'].some((key) => key in settings)) throw new Error('No recognized settings in backup');
  return normalizeSettings(settings);
}
