import {
  loadSettings,
  saveSettings,
  replaceSettings,
  clearSettings,
  createId,
  exportBackup,
  importBackup,
  DEFAULT_SETTINGS
} from '../storage/settings.js';
import { resolveLanguage } from '../shared/i18n.js';

const EXT = globalThis.browser ?? globalThis.chrome;
const view = document.getElementById('view');
const nav = document.getElementById('nav');
const viewTitle = document.getElementById('view-title');
const viewDesc = document.getElementById('view-desc');
const saveStatus = document.getElementById('save-status');
const sidebarSub = document.getElementById('sidebar-sub');

const COPY = {
  en: {
    settings: 'Settings',
    overview: 'Overview',
    overviewDesc: 'Quick status and common switches',
    ai: 'AI filter',
    aiDesc: 'Strict / Standard / Aggressive detection modes',
    ads: 'Ad filter',
    adsDesc: 'Promoted, sponsored and shopping ads',
    keywords: 'Keyword filter',
    keywordsDesc: 'AND / OR / exact / contains / regex rules',
    creators: 'Creator filter',
    creatorsDesc: 'Local creator blocklist',
    domains: 'Source filter',
    domainsDesc: 'Hide pins by outbound domain',
    types: 'Content type',
    typesDesc: 'Video, GIF, shopping and idea pins',
    page: 'Page cleaner',
    pageDesc: 'Independent module cleanup switches',
    whitelist: 'Whitelist',
    whitelistDesc: 'Highest priority allow rules',
    stats: 'Stats',
    statsDesc: 'Local daily counters only',
    data: 'Data',
    dataDesc: 'Import, export and reset',
    advanced: 'Advanced',
    advancedDesc: 'Diagnostics, safe mode and logs',
    about: 'About',
    aboutDesc: 'Privacy and product boundary',
    saved: 'Saved',
    saving: 'Saving…',
    failed: 'Save failed'
  },
  'zh-CN': {
    settings: '设置',
    overview: '概览',
    overviewDesc: '状态总览与常用开关',
    ai: 'AI 过滤',
    aiDesc: '严格 / 标准 / 强力检测模式',
    ads: '广告过滤',
    adsDesc: '推广、赞助与购物广告',
    keywords: '关键词过滤',
    keywordsDesc: 'AND / OR / 精确 / 包含 / 正则规则',
    creators: '发布者过滤',
    creatorsDesc: '本地发布者黑名单',
    domains: '来源过滤',
    domainsDesc: '按外链域名隐藏 Pin',
    types: '内容类型',
    typesDesc: '视频、动图、购物与 Idea Pin',
    page: '页面净化',
    pageDesc: '模块级独立净化开关',
    whitelist: '白名单',
    whitelistDesc: '最高优先级放行规则',
    stats: '统计',
    statsDesc: '仅本地当日计数',
    data: '数据管理',
    dataDesc: '导入、导出与重置',
    advanced: '高级设置',
    advancedDesc: '诊断、安全模式与日志',
    about: '关于',
    aboutDesc: '隐私与产品边界',
    saved: '已保存',
    saving: '保存中…',
    failed: '保存失败'
  }
};

const SECTIONS = [
  ['overview', 'overview', 'overviewDesc'],
  ['ai', 'ai', 'aiDesc'],
  ['ads', 'ads', 'adsDesc'],
  ['keywords', 'keywords', 'keywordsDesc'],
  ['creators', 'creators', 'creatorsDesc'],
  ['domains', 'domains', 'domainsDesc'],
  ['types', 'types', 'typesDesc'],
  ['page', 'page', 'pageDesc'],
  ['whitelist', 'whitelist', 'whitelistDesc'],
  ['stats', 'stats', 'statsDesc'],
  ['data', 'data', 'dataDesc'],
  ['advanced', 'advanced', 'advancedDesc'],
  ['about', 'about', 'aboutDesc']
];

let settings = null;
let language = 'en';
let current = (location.hash || '#overview').replace('#', '') || 'overview';

function t(key) {
  return COPY[language]?.[key] || COPY.en[key] || key;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function card() {
  return el('section', 'card');
}

function row(title, help, control) {
  const wrap = el('label', 'setting-row');
  const copy = el('span', 'setting-copy');
  copy.append(el('strong', null, title), el('small', null, help));
  wrap.append(copy, control);
  return wrap;
}

function switchInput(checked, onChange) {
  const input = el('input', 'switch');
  input.type = 'checkbox';
  input.role = 'switch';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return input;
}

function selectInput(value, options, onChange) {
  const select = el('select', 'select');
  for (const [val, label] of options) {
    const opt = el('option', null, label);
    opt.value = val;
    select.append(opt);
  }
  select.value = value;
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

async function persist(patch) {
  saveStatus.textContent = t('saving');
  try {
    settings = await saveSettings(patch);
    language = resolveLanguage(settings.language);
    saveStatus.textContent = t('saved');
    renderNav();
    renderView();
  } catch {
    saveStatus.textContent = t('failed');
  }
}

function renderNav() {
  nav.textContent = '';
  sidebarSub.textContent = t('settings');
  for (const [id, titleKey] of SECTIONS) {
    const button = el('button', current === id ? 'active' : '', t(titleKey));
    button.type = 'button';
    button.addEventListener('click', () => {
      current = id;
      location.hash = id;
      renderNav();
      renderView();
    });
    nav.append(button);
  }
}

function renderOverview(root) {
  const box = card();
  box.append(
    row(language === 'zh-CN' ? '启用扩展' : 'Enable extension', language === 'zh-CN' ? '关闭后不做任何过滤' : 'Turn off all filtering', switchInput(settings.enabled, (enabled) => persist({ enabled }))),
    row(language === 'zh-CN' ? '显示被过滤内容' : 'Show filtered content', language === 'zh-CN' ? '虚线描边预览，不刷新页面' : 'Preview with outline, no reload', switchInput(settings.showFiltered, (showFiltered) => persist({ showFiltered }))),
    row(language === 'zh-CN' ? '语言' : 'Language', language === 'zh-CN' ? '英文为默认语言' : 'English is the default language', selectInput(settings.language, [['en', 'English'], ['zh-CN', '简体中文'], ['auto', language === 'zh-CN' ? '跟随浏览器' : 'Follow browser']], (value) => persist({ language: value })))
  );
  root.append(box);

  const stats = card();
  stats.append(el('h2', null, language === 'zh-CN' ? '今日统计' : 'Today'));
  const grid = el('div', 'stats-grid');
  for (const [key, label] of [['total', 'Total'], ['ai', 'AI'], ['ad', 'Ads'], ['keyword', 'Keywords']]) {
    const item = el('div', 'stat', null);
    item.append(el('span', null, label), el('b', null, String(settings.stats?.[key] || 0)));
    grid.append(item);
  }
  stats.append(grid);
  root.append(stats);
}

function renderAi(root) {
  const box = card();
  box.append(
    row(language === 'zh-CN' ? '启用 AI 过滤' : 'Enable AI filter', language === 'zh-CN' ? '本地信号检测，不上传图片' : 'Local signals only, no image upload', switchInput(settings.ai.enabled, (enabled) => persist({ ai: { ...settings.ai, enabled } }))),
    row(language === 'zh-CN' ? '模式' : 'Mode', language === 'zh-CN' ? '严格误杀最低；强力召回更高' : 'Strict is safest; Aggressive recalls more', selectInput(settings.ai.mode, [
      ['strict', language === 'zh-CN' ? '严格' : 'Strict'],
      ['standard', language === 'zh-CN' ? '标准（默认）' : 'Standard (default)'],
      ['aggressive', language === 'zh-CN' ? '强力' : 'Aggressive']
    ], (mode) => persist({ ai: { ...settings.ai, mode } })))
  );
  if (settings.ai.mode === 'aggressive') {
    box.append(el('p', 'hint', language === 'zh-CN' ? '强力模式可能隐藏部分非 AI 内容。' : 'Aggressive mode may hide some non-AI content.'));
  }
  root.append(box);
}

function renderAds(root) {
  const box = card();
  const ads = settings.ads;
  const fields = [
    ['enabled', language === 'zh-CN' ? '启用广告过滤' : 'Enable ad filter'],
    ['promoted', 'Promoted'],
    ['sponsored', 'Sponsored'],
    ['shoppingAds', language === 'zh-CN' ? '购物广告' : 'Shopping ads'],
    ['feedPromoted', language === 'zh-CN' ? '信息流推广' : 'Feed promoted'],
    ['searchPromoted', language === 'zh-CN' ? '搜索推广' : 'Search promoted'],
    ['detailPromoted', language === 'zh-CN' ? '详情页推广' : 'Pin detail promoted']
  ];
  for (const [key, label] of fields) {
    box.append(row(label, '', switchInput(Boolean(ads[key]), (value) => persist({ ads: { ...ads, [key]: value } }))));
  }
  root.append(box);
}

function ruleEditor(kind) {
  const box = card();
  const toolbar = el('div', 'toolbar');
  const addBtn = el('button', 'btn btn-primary', language === 'zh-CN' ? '新增规则' : 'Add rule');
  addBtn.type = 'button';
  toolbar.append(addBtn);
  box.append(toolbar);
  const list = el('div', 'rule-list');
  box.append(list);

  const refresh = () => {
    list.textContent = '';
    const rules = settings[kind] || [];
    if (!rules.length) {
      list.append(el('p', 'muted', language === 'zh-CN' ? '暂无规则' : 'No rules yet'));
      return;
    }
    for (const rule of rules) {
      const item = el('article', 'rule-item');
      const body = el('div');
      if (kind === 'keywordRules') {
        body.append(
          el('h3', null, rule.name || 'Keyword'),
          el('p', null, `${rule.operator} · ${rule.matchType}\n${(rule.keywords || []).join(', ')}`)
        );
      } else if (kind === 'creatorRules') {
        body.append(
          el('h3', null, rule.username ? `@${rule.username}` : rule.displayName || 'Creator'),
          el('p', null, rule.note || '')
        );
      } else if (kind === 'domainRules') {
        body.append(
          el('h3', null, rule.pattern || 'Domain'),
          el('p', null, rule.matchType)
        );
      } else {
        body.append(
          el('h3', null, `${rule.type}: ${rule.value}`),
          el('p', null, rule.note || '')
        );
      }
      const actions = el('div', 'rule-actions');
      const toggle = switchInput(rule.enabled, async (enabled) => {
        const next = settings[kind].map((item) => item.id === rule.id ? { ...item, enabled } : item);
        await persist({ [kind]: next });
      });
      const remove = el('button', 'btn btn-danger', language === 'zh-CN' ? '删除' : 'Delete');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        await persist({ [kind]: settings[kind].filter((item) => item.id !== rule.id) });
      });
      actions.append(toggle, remove);
      item.append(body, actions);
      list.append(item);
    }
  };

  addBtn.addEventListener('click', async () => {
    if (kind === 'keywordRules') {
      const name = prompt(language === 'zh-CN' ? '规则名称' : 'Rule name', 'New keyword rule');
      if (!name) return;
      const keywords = prompt(language === 'zh-CN' ? '关键词（逗号分隔）' : 'Keywords (comma separated)');
      if (!keywords) return;
      const operator = confirm(language === 'zh-CN' ? '使用 AND 逻辑？取消=OR' : 'Use AND logic? Cancel = OR') ? 'AND' : 'OR';
      await persist({
        keywordRules: [...settings.keywordRules, {
          id: createId('kw'),
          enabled: true,
          name,
          operator,
          keywords: keywords.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
          fields: ['title', 'description', 'alt', 'creator'],
          matchType: 'contains',
          caseSensitive: false,
          note: ''
        }]
      });
      return;
    }
    if (kind === 'creatorRules') {
      const username = prompt(language === 'zh-CN' ? '发布者用户名（不含 @）' : 'Creator username (without @)');
      if (!username) return;
      await persist({
        creatorRules: [...settings.creatorRules, {
          id: createId('cr'), enabled: true, username: username.replace(/^@/, ''), displayName: '', creatorId: '', note: ''
        }]
      });
      return;
    }
    if (kind === 'domainRules') {
      const pattern = prompt(language === 'zh-CN' ? '域名，如 example.com' : 'Domain, e.g. example.com');
      if (!pattern) return;
      await persist({
        domainRules: [...settings.domainRules, {
          id: createId('dm'), enabled: true, pattern: pattern.trim().toLowerCase(), matchType: 'subdomain', note: ''
        }]
      });
      return;
    }
    const type = prompt(language === 'zh-CN' ? '类型：creator / domain / keyword' : 'Type: creator / domain / keyword', 'keyword');
    const value = prompt(language === 'zh-CN' ? '值' : 'Value');
    if (!type || !value) return;
    await persist({
      whitelistRules: [...settings.whitelistRules, {
        id: createId('wl'), enabled: true, type, value, note: ''
      }]
    });
  });

  refresh();
  return box;
}

function renderTypes(root) {
  const box = card();
  const cfg = settings.contentTypes;
  const fields = [
    ['hideVideo', language === 'zh-CN' ? '隐藏视频 Pin' : 'Hide video pins'],
    ['hideGif', language === 'zh-CN' ? '隐藏 GIF / 动图' : 'Hide GIF / animated'],
    ['hideShopping', language === 'zh-CN' ? '隐藏购物 Pin' : 'Hide shopping pins'],
    ['hideIdeaPin', language === 'zh-CN' ? '隐藏 Idea Pins' : 'Hide Idea Pins']
  ];
  for (const [key, label] of fields) {
    box.append(row(label, '', switchInput(Boolean(cfg[key]), (value) => persist({ contentTypes: { ...cfg, [key]: value } }))));
  }
  root.append(box);
}

function renderPage(root) {
  const box = card();
  const cfg = settings.pageCleaner;
  const fields = [
    ['hidePromoModules', language === 'zh-CN' ? '隐藏推广模块' : 'Hide promo modules'],
    ['hideShoppingRecs', language === 'zh-CN' ? '隐藏购物推荐' : 'Hide shopping recommendations'],
    ['hideRelatedRecs', language === 'zh-CN' ? '隐藏相关推荐' : 'Hide related recommendations'],
    ['hideRelatedProducts', language === 'zh-CN' ? '隐藏相关商品' : 'Hide related products'],
    ['hideInterruptModals', language === 'zh-CN' ? '隐藏部分干扰弹窗' : 'Hide some interruptive modals']
  ];
  for (const [key, label] of fields) {
    box.append(row(label, language === 'zh-CN' ? '每项独立控制，无“深度净化”一键' : 'Independent switches only', switchInput(Boolean(cfg[key]), (value) => persist({ pageCleaner: { ...cfg, [key]: value } }))));
  }
  root.append(box);
}

function renderStats(root) {
  const box = card();
  const grid = el('div', 'stats-grid');
  for (const [key, label] of Object.entries({
    total: language === 'zh-CN' ? '总计' : 'Total',
    ai: 'AI',
    ad: language === 'zh-CN' ? '广告' : 'Ads',
    keyword: language === 'zh-CN' ? '关键词' : 'Keywords',
    creator: language === 'zh-CN' ? '发布者' : 'Creators',
    domain: language === 'zh-CN' ? '来源' : 'Domains',
    contentType: language === 'zh-CN' ? '内容类型' : 'Types',
    pageCleaner: language === 'zh-CN' ? '页面净化' : 'Page cleaner'
  })) {
    const item = el('div', 'stat');
    item.append(el('span', null, label), el('b', null, String(settings.stats?.[key] || 0)));
    grid.append(item);
  }
  box.append(el('p', 'muted', language === 'zh-CN' ? `统计日期：${settings.stats?.day || '-'}` : `Day: ${settings.stats?.day || '-'}`), grid);
  root.append(box);
}

function renderData(root) {
  const box = card();
  const toolbar = el('div', 'toolbar');
  const exportBtn = el('button', 'btn btn-primary', language === 'zh-CN' ? '导出设置' : 'Export settings');
  const importBtn = el('button', 'btn', language === 'zh-CN' ? '导入设置' : 'Import settings');
  const resetBtn = el('button', 'btn btn-danger', language === 'zh-CN' ? '恢复默认' : 'Reset defaults');
  const file = el('input', 'input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.hidden = true;

  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(exportBackup(settings), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = `pinterest-cleaner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    const text = await chosen.text();
    settings = await replaceSettings(importBackup(text));
    language = resolveLanguage(settings.language);
    saveStatus.textContent = t('saved');
    renderNav();
    renderView();
  });

  resetBtn.addEventListener('click', async () => {
    if (!confirm(language === 'zh-CN' ? '确认恢复默认并清空规则？' : 'Reset all settings and rules?')) return;
    await clearSettings();
    settings = await loadSettings();
    renderNav();
    renderView();
  });

  toolbar.append(exportBtn, importBtn, resetBtn, file);
  box.append(toolbar, el('p', 'muted', language === 'zh-CN' ? '默认不导出统计数据。' : 'Stats are excluded from exports by default.'));
  root.append(box);
}

async function renderAdvanced(root) {
  const box = card();
  box.append(
    row(language === 'zh-CN' ? '安全模式' : 'Safe mode', language === 'zh-CN' ? '仅高置信度过滤' : 'High-confidence filters only', switchInput(settings.safeMode, (safeMode) => persist({ safeMode }))),
    row(language === 'zh-CN' ? '诊断模式' : 'Diagnostics', language === 'zh-CN' ? '输出更多本地日志' : 'Verbose local logging', switchInput(settings.diagnostics, (diagnostics) => persist({ diagnostics }))),
    row(language === 'zh-CN' ? '日志等级' : 'Log level', '', selectInput(settings.logLevel, ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].map((v) => [v, v]), (logLevel) => persist({ logLevel })))
  );
  root.append(box);

  const diag = card();
  const pre = el('pre', 'diag', language === 'zh-CN' ? '正在读取当前标签页诊断…' : 'Reading active tab diagnostics…');
  diag.append(el('h2', null, language === 'zh-CN' ? '诊断快照' : 'Diagnostics snapshot'), pre);
  root.append(diag);

  try {
    const tabs = await EXT.tabs?.query?.({ active: true, currentWindow: true }) || [];
    const tab = tabs[0];
    if (!tab?.id) {
      pre.textContent = 'No active tab';
      return;
    }
    const response = await EXT.tabs.sendMessage(tab.id, { type: 'PC_GET_STATUS' });
    pre.textContent = JSON.stringify(response, null, 2);
  } catch {
    pre.textContent = language === 'zh-CN'
      ? '当前标签页不是 Pinterest，或内容脚本尚未注入。'
      : 'Active tab is not Pinterest, or content script is not injected.';
  }
}

function renderAbout(root) {
  const box = card();
  box.append(
    el('h2', null, 'Pinterest Cleaner'),
    el('p', null, language === 'zh-CN'
      ? '本地运行的 Pinterest 内容净化扩展。处理仅发生在浏览器本地，规则与浏览内容不会上传。'
      : 'A local-first Pinterest content cleaner. Processing stays in your browser; rules and browsing content are never uploaded.'),
    el('p', 'muted', 'v1.0.0 · Edge / Chrome / Firefox'),
    el('p', 'muted', 'hangdudu0@agent.qq.com')
  );
  root.append(box);
}

function renderView() {
  const meta = SECTIONS.find((item) => item[0] === current) || SECTIONS[0];
  viewTitle.textContent = t(meta[1]);
  viewDesc.textContent = t(meta[2]);
  document.title = `Pinterest Cleaner · ${t(meta[1])}`;
  view.textContent = '';

  if (current === 'overview') return renderOverview(view);
  if (current === 'ai') return renderAi(view);
  if (current === 'ads') return renderAds(view);
  if (current === 'keywords') return view.append(ruleEditor('keywordRules'));
  if (current === 'creators') return view.append(ruleEditor('creatorRules'));
  if (current === 'domains') return view.append(ruleEditor('domainRules'));
  if (current === 'types') return renderTypes(view);
  if (current === 'page') return renderPage(view);
  if (current === 'whitelist') return view.append(ruleEditor('whitelistRules'));
  if (current === 'stats') return renderStats(view);
  if (current === 'data') return renderData(view);
  if (current === 'advanced') return renderAdvanced(view);
  return renderAbout(view);
}

window.addEventListener('hashchange', () => {
  current = (location.hash || '#overview').replace('#', '') || 'overview';
  renderNav();
  renderView();
});

loadSettings().then((value) => {
  settings = value;
  language = resolveLanguage(settings.language);
  renderNav();
  renderView();
}).catch((error) => {
  saveStatus.textContent = String(error?.message || error);
});
