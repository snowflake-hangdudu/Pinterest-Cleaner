import {
  loadSettings,
  saveSettings,
  replaceSettings,
  clearSettings,
  createId,
  exportBackup,
  importBackup
} from '../storage/settings.js';
import { applyTranslations, languageOptionLabelKey, resolveLanguage, themeDisplayName, translate } from '../shared/i18n.js';
import {
  applyTheme,
  loadThemeDefinitions,
  renderThemePicker,
  resolveTheme,
  syncThemePicker
} from '../ui/theme.js';

const EXT = globalThis.browser ?? globalThis.chrome;
const view = document.getElementById('view');
const viewTitle = document.getElementById('view-title');
const toastEl = document.getElementById('toast');
const themePicker = document.getElementById('theme-picker');
const languageSelect = document.getElementById('language-select');
const homePanel = document.getElementById('home-panel');
const detailPanel = document.getElementById('detail-panel');

const FILTER_SECTIONS = [
  ['keywords', 'navKeywords'],
  ['creators', 'navCreators'],
  ['domains', 'navDomains'],
  ['types', 'navTypes']
];

const OPEN_SECTION_KEY = 'pc.options.openSection';

let settings = null;
let language = 'en';
let themes = [];
let toastTimer;

function isFilterSection(id) {
  return FILTER_SECTIONS.some((item) => item[0] === id);
}

function sectionFromHash() {
  const id = (location.hash || '').replace(/^#/, '');
  return isFilterSection(id) ? id : 'home';
}

function showSection(id) {
  current = isFilterSection(id) ? id : 'home';
  const nextHash = current === 'home' ? '' : current;
  if (location.hash.replace(/^#/, '') !== nextHash) {
    location.hash = nextHash;
  }
  if (settings) renderLayout();
}

async function consumeOpenSection() {
  const data = await EXT.storage.local.get(OPEN_SECTION_KEY);
  const section = data?.[OPEN_SECTION_KEY];
  if (!section) return false;
  await EXT.storage.local.remove(OPEN_SECTION_KEY);
  showSection(section);
  return true;
}

let current = sectionFromHash();

function t(key, vars) {
  return translate(language, key, vars);
}

function themeLabel(id, fallback) {
  return themeDisplayName(id, language, fallback);
}

function confirmDialog({ title, message, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const backdrop = el('div', 'pc-dialog-backdrop');
    const dialog = el('div', 'pc-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const heading = el('h3', 'pc-dialog__title', title);
    heading.id = 'pc-dialog-title';
    dialog.setAttribute('aria-labelledby', heading.id);
    const body = el('p', 'pc-dialog__body', message);
    const actions = el('div', 'pc-dialog__actions');
    const cancel = el('button', 'btu-btn btu-btn--secondary', t('cancel'));
    const ok = el('button', `btu-btn ${danger ? 'btu-btn--danger' : 'btu-btn--primary'}`, confirmLabel || t('confirmAction'));
    cancel.type = ok.type = 'button';

    const close = (result) => {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      if (previous instanceof HTMLElement) previous.focus();
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      }
    };

    cancel.addEventListener('click', () => close(false));
    ok.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(false);
    });
    document.addEventListener('keydown', onKey);
    actions.append(cancel, ok);
    dialog.append(heading, body, actions);
    backdrop.append(dialog);
    document.body.append(backdrop);
    ok.focus();
  });
}

function toast(message, tone = 'ok') {
  if (!toastEl || !message) return;
  toastEl.textContent = message;
  toastEl.dataset.tone = tone;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), tone === 'error' ? 2800 : 1800);
}

function paintTheme(themeId) {
  applyTheme(document.body, themeId, themes);
  syncThemePicker(themePicker, themes, themeId, themeLabel);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function card() {
  return el('section', 'dm-block');
}

function row(title, help, control, { tag = 'label' } = {}) {
  const wrap = el(tag, 'setting-row');
  const copy = el('span', 'setting-copy');
  copy.append(el('strong', null, title), el('small', null, help));
  wrap.append(copy, control);
  return wrap;
}

function switchInput(checked, onChange) {
  const button = el('button', `btu-switch${checked ? ' on' : ''}`);
  button.type = 'button';
  button.setAttribute('role', 'switch');
  button.setAttribute('aria-checked', String(checked));
  button.addEventListener('click', () => {
    const next = button.getAttribute('aria-checked') !== 'true';
    button.classList.toggle('on', next);
    button.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return button;
}

function selectInput(value, options, onChange) {
  const select = el('select', 'btu-select');
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
  try {
    settings = await saveSettings(patch);
    language = resolveLanguage(settings.language);
    applyTranslations(document, language);
    syncChromeLangControls();
    paintTheme(settings.theme);
    toast(`✓ ${t('saved')}`, 'ok');
    if (current === 'home') renderFilterPages();
    else renderLayout();
  } catch {
    toast(t('failed'), 'error');
  }
}

function syncChromeLangControls() {
  for (const option of languageSelect.options) {
    option.textContent = t(languageOptionLabelKey(option.value));
  }
  languageSelect.value = resolveLanguage(settings.language);
}

function renderFilterPages() {
  const root = document.getElementById('filter-pages');
  if (!root || !settings) return;
  const cfg = settings.filterPages || {};
  root.className = 'pc-page-chips';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', t('filterPages'));
  root.textContent = '';
  for (const [key, labelKey] of [
    ['home', 'filterPageHome'],
    ['search', 'filterPageSearch'],
    ['detail', 'filterPageDetail']
  ]) {
    const on = cfg[key] !== false;
    const button = el('button', `pc-page-chip${on ? ' is-on' : ''}`, t(labelKey));
    button.type = 'button';
    button.dataset.page = key;
    button.setAttribute('aria-pressed', String(on));
    button.addEventListener('click', () => {
      const next = { ...settings.filterPages };
      const turningOn = next[key] === false;
      if (!turningOn) {
        const othersOn = ['home', 'search', 'detail'].some((item) => item !== key && next[item] !== false);
        if (!othersOn) return;
      }
      next[key] = turningOn;
      persist({ filterPages: next });
    });
    root.append(button);
  }
}

function renderLayout() {
  const onHome = current === 'home';
  homePanel.classList.toggle('hidden', !onHome);
  detailPanel.classList.toggle('hidden', onHome);
  homePanel.toggleAttribute('inert', !onHome);
  detailPanel.toggleAttribute('inert', onHome);
  document.documentElement.lang = language;
  if (onHome) {
    document.title = t('settingsTitle');
    renderFilterPages();
    return;
  }
  const meta = FILTER_SECTIONS.find((item) => item[0] === current) || FILTER_SECTIONS[0];
  viewTitle.textContent = t(meta[1]);
  document.title = `Pinterest Cleaner · ${t(meta[1])}`;
  view.textContent = '';
  if (current === 'keywords') return view.append(ruleEditor('keywordRules'));
  if (current === 'creators') return view.append(ruleEditor('creatorRules'));
  if (current === 'domains') return view.append(ruleEditor('domainRules'));
  return renderTypes(view);
}

function bindBackup() {
  const exportBtn = document.getElementById('export-settings');
  const importBtn = document.getElementById('import-settings');
  const resetBtn = document.getElementById('reset-defaults');
  const file = document.getElementById('backup-file');
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
    file.value = '';
    if (!chosen) return;
    try {
      settings = await replaceSettings(importBackup(await chosen.text()));
      language = resolveLanguage(settings.language);
      applyTranslations(document, language);
      syncChromeLangControls();
      paintTheme(settings.theme);
      toast(`✓ ${t('saved')}`, 'ok');
    } catch {
      toast(t('failed'), 'error');
    }
  });
  resetBtn.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: t('resetDefaults'),
      message: t('resetConfirm'),
      confirmLabel: t('resetDefaults'),
      danger: true
    });
    if (!ok) return;
    await clearSettings();
    settings = await loadSettings();
    language = resolveLanguage(settings.language);
    applyTranslations(document, language);
    syncChromeLangControls();
    paintTheme(settings.theme);
    toast(`✓ ${t('saved')}`, 'ok');
  });
}

function ruleEditor(kind) {
  const box = card();
  const toolbar = el('div', 'toolbar');
  const addBtn = el('button', 'btu-btn btu-btn--primary', t('addRule'));
  addBtn.type = 'button';
  const search = el('input', 'input');
  search.type = 'search';
  search.placeholder = t('searchRules');
  search.setAttribute('aria-label', t('searchRules'));
  const sort = selectInput('manual', [
    ['manual', t('sortManual')],
    ['name', t('sortName')]
  ], () => refresh());
  sort.setAttribute('aria-label', t('ruleSort'));
  toolbar.append(addBtn, search, sort);
  box.append(toolbar);
  const editor = el('div', 'rule-editor');
  editor.hidden = true;
  box.append(editor);
  const list = el('div', 'rule-list');
  box.append(list);

  const field = (labelText, control, help = '') => {
    const label = el('label', 'form-field');
    label.append(el('span', null, labelText), control);
    if (help) label.append(el('small', null, help));
    return label;
  };
  const textInput = (value = '', placeholder = '') => {
    const input = el('input', 'input');
    input.type = 'text';
    input.value = value;
    input.placeholder = placeholder;
    return input;
  };
  const checkboxGroup = (values) => {
    const wrap = el('div', 'check-group');
    for (const [value, labelText, checked] of values) {
      const label = el('label', 'check-option');
      const input = el('input');
      input.type = 'checkbox';
      input.value = value;
      input.checked = checked;
      label.append(input, document.createTextNode(labelText));
      wrap.append(label);
    }
    return wrap;
  };

  const ruleTitle = (rule) => {
    if (kind === 'keywordRules') return rule.name || t('keywordRule');
    if (kind === 'creatorRules') return rule.username ? `@${rule.username}` : rule.displayName || t('creator');
    if (kind === 'domainRules') return rule.pattern || t('domain');
    return `${rule.type}: ${rule.value}`;
  };

  const ruleDetail = (rule) => {
    if (kind === 'keywordRules') {
      return `${rule.operator} · ${rule.matchType}${rule.caseSensitive ? ` · ${t('caseSensitiveShort')}` : ''}\n${(rule.keywords || []).join('\n')}${rule.note ? `\n${rule.note}` : ''}`;
    }
    if (kind === 'creatorRules') return [rule.displayName, rule.note].filter(Boolean).join(' · ');
    if (kind === 'domainRules') return [rule.matchType, rule.note].filter(Boolean).join(' · ');
    return rule.note || '';
  };

  const showEditor = (existing = null) => {
    const rule = existing || (kind === 'keywordRules'
      ? { id: createId('kw'), enabled: true, name: '', operator: 'OR', keywords: [], fields: ['title', 'description', 'alt', 'creator'], matchType: 'contains', caseSensitive: false, note: '' }
      : kind === 'creatorRules'
        ? { id: createId('cr'), enabled: true, username: '', displayName: '', note: '' }
        : kind === 'domainRules'
          ? { id: createId('dm'), enabled: true, pattern: '', matchType: 'exact', note: '' }
          : { id: createId('wl'), enabled: true, type: 'keyword', value: '', note: '' });
    editor.textContent = '';
    editor.hidden = false;
    const form = el('form', 'rule-form');
    const heading = el('h2', null, existing ? t('editRule') : t('addRule'));
    const error = el('p', 'form-error');
    error.hidden = true;
    error.setAttribute('role', 'alert');
    const enabled = el('input');
    enabled.type = 'checkbox';
    enabled.checked = rule.enabled;
    const enabledLabel = el('label', 'check-option');
    enabledLabel.append(enabled, document.createTextNode(t('enabledLabel')));
    form.append(heading, enabledLabel);

    let controls;
    if (kind === 'keywordRules') {
      const name = textInput(rule.name);
      const keywords = el('textarea', 'textarea');
      keywords.value = (rule.keywords || []).join('\n');
      keywords.placeholder = t('keywordsPlaceholder');
      const operator = selectInput(rule.operator, [['OR', 'OR'], ['AND', 'AND']], () => {});
      const matchType = selectInput(rule.matchType, [
        ['contains', t('matchContains')],
        ['exact', t('matchExact')],
        ['regex', t('matchRegex')]
      ], () => {});
      const fields = checkboxGroup([
        ['title', t('fieldTitle'), rule.fields?.includes('title')],
        ['description', t('fieldDescription'), rule.fields?.includes('description')],
        ['alt', t('fieldAlt'), rule.fields?.includes('alt')],
        ['creator', t('fieldCreator'), rule.fields?.includes('creator')]
      ]);
      const caseSensitive = el('input');
      caseSensitive.type = 'checkbox';
      caseSensitive.checked = rule.caseSensitive;
      const caseLabel = el('label', 'check-option');
      caseLabel.append(caseSensitive, document.createTextNode(t('caseSensitive')));
      const note = el('textarea', 'textarea');
      note.value = rule.note || '';
      form.append(
        field(t('ruleName'), name),
        field(t('keywordsLabel'), keywords),
        field(t('logic'), operator),
        field(t('matchType'), matchType),
        field(t('searchIn'), fields),
        caseLabel,
        field(t('note'), note)
      );
      controls = { name, keywords, operator, matchType, fields, caseSensitive, note };
    } else if (kind === 'creatorRules') {
      const username = textInput(rule.username, t('usernamePlaceholder'));
      const displayName = textInput(rule.displayName);
      const note = el('textarea', 'textarea');
      note.value = rule.note || '';
      form.append(
        field(t('username'), username),
        field(t('displayName'), displayName),
        field(t('note'), note)
      );
      controls = { username, displayName, note };
    } else if (kind === 'domainRules') {
      const pattern = textInput(rule.pattern, 'example.com');
      const matchType = selectInput(rule.matchType, [
        ['exact', t('matchExactDomain')],
        ['subdomain', t('matchSubdomain')],
        ['wildcard', t('matchWildcard')]
      ], () => {});
      const note = el('textarea', 'textarea');
      note.value = rule.note || '';
      form.append(
        field(t('domainPattern'), pattern),
        field(t('matchType'), matchType),
        field(t('note'), note)
      );
      controls = { pattern, matchType, note };
    } else {
      const type = selectInput(rule.type, [
        ['keyword', t('typeKeyword')],
        ['creator', t('typeCreator')],
        ['domain', t('typeDomain')]
      ], () => {});
      const value = textInput(rule.value);
      const note = el('textarea', 'textarea');
      note.value = rule.note || '';
      form.append(
        field(t('allowType'), type),
        field(t('value'), value),
        field(t('note'), note)
      );
      controls = { type, value, note };
    }

    const actions = el('div', 'toolbar');
    const save = el('button', 'btu-btn btu-btn--primary', t('saveRule'));
    save.type = 'submit';
    const cancel = el('button', 'btu-btn btu-btn--secondary', t('cancel'));
    cancel.type = 'button';
    cancel.addEventListener('click', () => { editor.hidden = true; editor.textContent = ''; });
    actions.append(save, cancel);
    form.append(error, actions);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fail = (message) => { error.textContent = message; error.hidden = false; };
      let next;
      if (kind === 'keywordRules') {
        const keywords = controls.keywords.value
          .split(controls.matchType.value === 'regex' ? /\n/ : /[,，\n]/)
          .map((value) => value.trim())
          .filter(Boolean);
        if (!controls.name.value.trim() || !keywords.length) return fail(t('errKeywordRequired'));
        if (controls.matchType.value === 'regex') {
          try {
            keywords.forEach((keyword) => new RegExp(keyword, controls.caseSensitive.checked ? '' : 'i'));
          } catch (regexError) {
            return fail(t('errInvalidRegex', { message: regexError.message }));
          }
        }
        const fields = [...controls.fields.querySelectorAll('input:checked')].map((input) => input.value);
        if (!fields.length) return fail(t('errFieldRequired'));
        next = {
          ...rule,
          enabled: enabled.checked,
          name: controls.name.value.trim(),
          keywords,
          operator: controls.operator.value,
          matchType: controls.matchType.value,
          fields,
          caseSensitive: controls.caseSensitive.checked,
          note: controls.note.value.trim()
        };
      } else if (kind === 'creatorRules') {
        if (![controls.username.value, controls.displayName.value].some((value) => value.trim())) {
          return fail(t('errCreatorRequired'));
        }
        next = {
          ...rule,
          enabled: enabled.checked,
          username: controls.username.value.replace(/^@/, '').trim(),
          displayName: controls.displayName.value.trim(),
          note: controls.note.value.trim()
        };
      } else if (kind === 'domainRules') {
        if (!controls.pattern.value.trim()) return fail(t('errDomainRequired'));
        next = {
          ...rule,
          enabled: enabled.checked,
          pattern: controls.pattern.value.trim().toLowerCase(),
          matchType: controls.matchType.value,
          note: controls.note.value.trim()
        };
      } else {
        if (!controls.value.value.trim()) return fail(t('errWhitelistRequired'));
        next = {
          ...rule,
          enabled: enabled.checked,
          type: controls.type.value,
          value: controls.value.value.trim(),
          note: controls.note.value.trim()
        };
      }
      const nextRules = existing
        ? settings[kind].map((item) => item.id === rule.id ? next : item)
        : [...settings[kind], next];
      await persist({ [kind]: nextRules });
    });
    editor.append(form);
    form.querySelector('input, textarea, select')?.focus();
  };

  const refresh = () => {
    list.textContent = '';
    const query = search.value.trim().toLocaleLowerCase();
    const rules = (settings[kind] || []).map((rule, index) => ({ rule, index }))
      .filter(({ rule }) => !query || `${ruleTitle(rule)} ${ruleDetail(rule)}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => sort.value === 'name' ? ruleTitle(a.rule).localeCompare(ruleTitle(b.rule)) : a.index - b.index);
    if (!rules.length) {
      list.append(el('p', 'muted', query ? t('noMatchingRules') : t('noRules')));
      return;
    }
    for (const { rule, index } of rules) {
      const item = el('article', 'rule-item');
      const body = el('div', 'rule-item__copy');
      body.append(el('h3', null, ruleTitle(rule)));
      const detail = ruleDetail(rule);
      if (detail) body.append(el('p', null, detail));
      const actions = el('div', 'rule-actions');
      const toggle = switchInput(rule.enabled, async (enabled) => {
        const next = settings[kind].map((item) => item.id === rule.id ? { ...item, enabled } : item);
        await persist({ [kind]: next });
      });
      toggle.setAttribute('aria-label', `${t('enable')} ${ruleTitle(rule)}`);
      const edit = el('button', 'btu-btn btu-btn--secondary', t('edit'));
      edit.type = 'button';
      edit.addEventListener('click', () => showEditor(rule));
      const moveUp = el('button', 'btu-btn btu-btn--secondary btu-btn--icon', '↑');
      moveUp.type = 'button';
      moveUp.disabled = index === 0;
      moveUp.setAttribute('aria-label', t('moveRuleUp'));
      moveUp.addEventListener('click', async () => {
        const next = [...settings[kind]];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        await persist({ [kind]: next });
      });
      const moveDown = el('button', 'btu-btn btu-btn--secondary btu-btn--icon', '↓');
      moveDown.type = 'button';
      moveDown.disabled = index === settings[kind].length - 1;
      moveDown.setAttribute('aria-label', t('moveRuleDown'));
      moveDown.addEventListener('click', async () => {
        const next = [...settings[kind]];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        await persist({ [kind]: next });
      });
      const remove = el('button', 'btu-btn btu-btn--secondary', t('delete'));
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        await persist({ [kind]: settings[kind].filter((item) => item.id !== rule.id) });
      });
      actions.append(toggle, edit, moveUp, moveDown, remove);
      item.append(body, actions);
      list.append(item);
    }
  };

  addBtn.addEventListener('click', () => showEditor());
  search.addEventListener('input', refresh);
  refresh();
  return box;
}


function renderTypes(root) {
  const box = card();
  const cfg = settings.contentTypes;
  for (const [key, labelKey] of [
    ['hideVideo', 'hideVideo']
  ]) {
    box.append(row(t(labelKey), '', switchInput(Boolean(cfg[key]), (value) => persist({ contentTypes: { ...cfg, [key]: value } }))));
  }
  root.append(box);
}

document.getElementById('filter-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-section]');
  if (button) showSection(button.dataset.section);
});
document.getElementById('back-home').addEventListener('click', () => showSection('home'));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && current !== 'home') {
    event.preventDefault();
    showSection('home');
  }
});

languageSelect.addEventListener('change', () => persist({ language: languageSelect.value }));
themePicker.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-theme-id]');
  if (!button || !settings) return;
  const nextTheme = button.dataset.themeId;
  const previous = settings.theme;
  paintTheme(nextTheme);
  try {
    settings = await saveSettings({ theme: nextTheme });
    syncThemePicker(themePicker, themes, settings.theme, themeLabel);
    toast(`✓ ${t('saved')}`, 'ok');
  } catch {
    paintTheme(previous);
    toast(t('saveFailed'), 'error');
  }
});

window.addEventListener('hashchange', () => {
  current = sectionFromHash();
  renderLayout();
});

EXT.storage?.onChanged?.addListener((changes, area) => {
  if (area !== 'local' || !changes[OPEN_SECTION_KEY]?.newValue) return;
  consumeOpenSection().catch(() => {});
});

Promise.all([loadSettings(), loadThemeDefinitions()]).then(async ([value, themeList]) => {
  settings = value;
  themes = themeList;
  language = resolveLanguage(settings.language);
  applyTranslations(document, language);
  syncChromeLangControls();
  bindBackup();
  renderThemePicker(themePicker, themes);
  paintTheme(resolveTheme(settings.theme, themes)?.id || 'obsidian');
  const opened = await consumeOpenSection();
  if (!opened) {
    current = sectionFromHash();
    renderLayout();
  }
}).catch((error) => {
  toast(String(error?.message || error), 'error');
});
