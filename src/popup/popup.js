import { applyTranslations, resolveLanguage, translate } from '../shared/i18n.js';
import { loadSettings, saveSettings } from '../storage/settings.js';

const EXT = globalThis.browser ?? globalThis.chrome;
const byId = (id) => document.getElementById(id);

const enabled = byId('enabled');
const aiEnabled = byId('ai-enabled');
const adsEnabled = byId('ads-enabled');
const showFiltered = byId('show-filtered');
const aiModeLabel = byId('ai-mode-label');
const rulesCount = byId('rules-count');
const status = byId('status');

let settings = null;
let language = 'en';

function modeLabel(mode) {
  if (mode === 'strict') return translate(language, 'aiStrict');
  if (mode === 'aggressive') return translate(language, 'aiAggressive');
  return translate(language, 'aiStandard');
}

function renderStats(stats = {}) {
  byId('stat-total').textContent = String(stats.total || 0);
  byId('stat-ai').textContent = String(stats.ai || 0);
  byId('stat-ad').textContent = String(stats.ad || 0);
  byId('stat-keyword').textContent = String(stats.keyword || 0);
  byId('stat-creator').textContent = String(stats.creator || 0);
}

function render() {
  if (!settings) return;
  language = resolveLanguage(settings.language);
  applyTranslations(document, language);
  enabled.checked = settings.enabled;
  aiEnabled.checked = settings.ai.enabled;
  adsEnabled.checked = settings.ads.enabled;
  showFiltered.checked = settings.showFiltered;
  aiModeLabel.textContent = modeLabel(settings.ai.mode);
  const count = (settings.keywordRules?.length || 0)
    + (settings.creatorRules?.length || 0)
    + (settings.domainRules?.length || 0);
  rulesCount.textContent = translate(language, 'rulesCount', { n: count });
  renderStats(settings.stats);
  document.body.classList.toggle('is-paused', settings.pause?.mode && settings.pause.mode !== 'off');
}

async function persist(patch) {
  status.textContent = translate(language, 'saving');
  try {
    settings = await saveSettings(patch);
    render();
    status.textContent = translate(language, 'saved');
    const [tab] = await EXT.tabs?.query?.({ active: true, currentWindow: true }) || [];
    if (tab?.id) {
      try { await EXT.tabs.sendMessage(tab.id, { type: 'PC_RESCAN' }); } catch { /* not on pinterest */ }
    }
  } catch {
    status.textContent = translate(language, 'saveFailed');
  }
}

async function openOptions(hash = '') {
  if (!hash && EXT.runtime.openOptionsPage) {
    await EXT.runtime.openOptionsPage();
    return;
  }
  const url = EXT.runtime.getURL(`src/options/options.html${hash}`);
  await EXT.tabs.create({ url });
}

enabled.addEventListener('change', () => persist({
  enabled: enabled.checked,
  pause: enabled.checked ? { mode: 'off', until: 0, tabOnly: false } : settings.pause
}));
aiEnabled.addEventListener('change', () => persist({ ai: { ...settings.ai, enabled: aiEnabled.checked } }));
adsEnabled.addEventListener('change', () => persist({ ads: { ...settings.ads, enabled: adsEnabled.checked } }));
showFiltered.addEventListener('change', async () => {
  await persist({ showFiltered: showFiltered.checked });
  const [tab] = await EXT.tabs?.query?.({ active: true, currentWindow: true }) || [];
  if (tab?.id) {
    try { await EXT.tabs.sendMessage(tab.id, { type: 'PC_SET_SHOW_FILTERED', value: showFiltered.checked }); } catch { /* ignore */ }
  }
});

byId('pause-5').addEventListener('click', () => persist({
  pause: { mode: 'timed', until: Date.now() + 5 * 60 * 1000, tabOnly: false }
}));
byId('pause-30').addEventListener('click', () => persist({
  pause: { mode: 'timed', until: Date.now() + 30 * 60 * 1000, tabOnly: false }
}));
byId('pause-off').addEventListener('click', () => persist({
  enabled: true,
  pause: { mode: 'off', until: 0, tabOnly: false }
}));

byId('open-options').addEventListener('click', () => openOptions());
byId('open-rules').addEventListener('click', () => openOptions('#keywords'));
byId('open-page-cleaner').addEventListener('click', () => openOptions('#page'));

loadSettings()
  .then((value) => {
    settings = value;
    render();
  })
  .catch(() => {
    status.textContent = translate('en', 'loadFailed');
  });
