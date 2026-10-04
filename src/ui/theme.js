export const DEFAULT_THEME_ID = 'obsidian';

const COLOR_KEYS = Object.freeze([
  'background', 'surface', 'surfaceHover', 'surfaceStrong',
  'border', 'borderSoft', 'textPrimary', 'textSecondary', 'textMuted',
  'primary', 'primaryStrong', 'primaryHover', 'primarySoft', 'primaryBorder',
  'accent', 'accentSecondary'
]);

const OPTIONAL_COLOR_KEYS = Object.freeze([
  'deepBlue', 'selectedBg', 'selectedBorder', 'selectedText', 'selectedDot'
]);

const THEME_ID = /^[a-z][a-z0-9-]{0,40}$/;
const HEX_COLOR = /^#[\da-f]{6}$/i;
const RGB_COLOR = /^rgba?\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/;
const BLUR = /^\d{1,2}px$/;

const VARIABLE_NAMES = Object.freeze([
  '--theme-background', '--theme-surface', '--theme-surface-hover', '--theme-surface-strong',
  '--theme-border', '--theme-border-soft', '--theme-text-primary', '--theme-text-secondary', '--theme-text-muted',
  '--theme-primary', '--theme-primary-strong', '--theme-primary-hover', '--theme-primary-soft', '--theme-primary-border',
  '--theme-accent', '--theme-accent-secondary',
  '--theme-gradient-background', '--theme-gradient-button', '--theme-gradient-preview', '--theme-gradient-header',
  '--theme-surface-blur', '--theme-header-blur', '--theme-noise-opacity', '--theme-shadow',
  '--btu-bg-page', '--btu-bg-surface', '--btu-fill-muted', '--btu-surface-strong',
  '--btu-border', '--btu-border-soft', '--btu-text-primary', '--btu-text-secondary', '--btu-text-tertiary',
  '--btu-accent', '--btu-accent-strong', '--btu-accent-hover', '--btu-accent-soft', '--btu-accent-ring',
  '--btu-theme-accent', '--btu-theme-accent-secondary', '--btu-theme-primary-border', '--btu-theme-deep-blue',
  '--btu-theme-primary-button', '--btu-theme-preview', '--btu-theme-header',
  '--btu-action-bg', '--btu-action-fg',
  '--accent', '--accent-hover', '--accent-soft', '--accent-ring',
  '--selected-bg', '--selected-border', '--selected-text', '--selected-dot',
  '--control-bg', '--control-border', '--control-text'
]);

function isColor(value) {
  return typeof value === 'string' && value.length <= 80 && (HEX_COLOR.test(value) || RGB_COLOR.test(value));
}

function isGradient(value) {
  if (typeof value !== 'string' || value.length < 16 || value.length > 4000) return false;
  if (/url\s*\(|expression\s*\(|[<>;]/i.test(value)) return false;
  if (!/^(?:linear|radial|conic)-gradient\(/i.test(value.trim())) return false;
  return true;
}

function isShadow(value) {
  return typeof value === 'string' && value.length <= 180 && !/url\s*\(|expression\s*\(|[<>;]/i.test(value);
}

function hexChannels(color) {
  const hex = HEX_COLOR.exec(color);
  if (!hex) return null;
  return color.slice(1).match(/[\da-f]{2}/gi).map((part) => Number.parseInt(part, 16));
}

function withAlpha(color, alpha) {
  const channels = hexChannels(color);
  if (channels) return `rgba(${channels.join(', ')}, ${alpha})`;
  if (RGB_COLOR.test(color)) return color.replace(/[\d.]+\s*\)$/, `${alpha})`);
  return color;
}

function accentRing(color) {
  return withAlpha(color, 0.28);
}

function interactionTokens(theme) {
  const { colors, mode } = theme;
  const accent = isColor(colors.selectedBorder) ? colors.selectedBorder : colors.primary;
  const selectedBg = isColor(colors.selectedBg)
    ? colors.selectedBg
    : withAlpha(accent, mode === 'light' ? 0.12 : 0.14);
  const selectedBorder = isColor(colors.selectedBorder) ? colors.selectedBorder : accent;
  const selectedText = isColor(colors.selectedText)
    ? colors.selectedText
    : (mode === 'light' ? colors.textPrimary : '#ffffff');
  const selectedDot = isColor(colors.selectedDot) ? colors.selectedDot : (colors.primaryHover || accent);
  return { accent, selectedBg, selectedBorder, selectedText, selectedDot };
}

function isTheme(theme) {
  if (!theme || !THEME_ID.test(theme.id || '') || typeof theme.name !== 'string') return false;
  if (theme.mode !== 'light' && theme.mode !== 'dark') return false;
  if (!theme.colors || !theme.gradients || !theme.effects) return false;
  const colorsOk = COLOR_KEYS.every((key) => isColor(theme.colors[key]))
    && OPTIONAL_COLOR_KEYS.every((key) => theme.colors[key] === undefined || isColor(theme.colors[key]));
  const gradientsOk = ['background', 'primaryButton', 'preview', 'header']
    .every((key) => isGradient(theme.gradients[key]));
  const effects = theme.effects;
  return colorsOk && gradientsOk
    && BLUR.test(effects.surfaceBlur || '')
    && BLUR.test(effects.headerBlur || '')
    && typeof effects.noiseOpacity === 'number'
    && effects.noiseOpacity >= 0
    && effects.noiseOpacity <= 0.2
    && isShadow(effects.shadow);
}

export function resolveTheme(themeId, themes = []) {
  return themes.find((theme) => theme.id === themeId)
    || themes.find((theme) => theme.id === DEFAULT_THEME_ID)
    || themes[0]
    || null;
}

export function themesFromData(data) {
  if (!Array.isArray(data?.themes)) return [];
  const seen = new Set();
  return data.themes.filter((theme) => {
    if (!isTheme(theme) || seen.has(theme.id)) return false;
    seen.add(theme.id);
    return true;
  });
}

export async function loadThemeDefinitions(url = new URL('./themes-ambient-full.json', import.meta.url)) {
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    return themesFromData(await response.json());
  } catch {
    return [];
  }
}

function paint(target, theme) {
  for (const property of VARIABLE_NAMES) target.style.removeProperty(property);
  target.dataset.theme = theme.id;
  target.dataset.themeMode = theme.mode;
  target.dataset.themeKind = 'ambient';

  const colors = theme.colors;
  const gradients = theme.gradients;
  const effects = theme.effects;
  const interaction = interactionTokens(theme);
  const vars = {
    '--theme-background': colors.background,
    '--theme-surface': colors.surface,
    '--theme-surface-hover': colors.surfaceHover,
    '--theme-surface-strong': colors.surfaceStrong,
    '--theme-border': colors.border,
    '--theme-border-soft': colors.borderSoft,
    '--theme-text-primary': colors.textPrimary,
    '--theme-text-secondary': colors.textSecondary,
    '--theme-text-muted': colors.textMuted,
    '--theme-primary': colors.primary,
    '--theme-primary-strong': colors.primaryStrong,
    '--theme-primary-hover': colors.primaryHover,
    '--theme-primary-soft': colors.primarySoft,
    '--theme-primary-border': colors.primaryBorder,
    '--theme-accent': colors.accent,
    '--theme-accent-secondary': colors.accentSecondary,
    '--theme-gradient-background': gradients.background,
    '--theme-gradient-button': gradients.primaryButton,
    '--theme-gradient-preview': gradients.preview,
    '--theme-gradient-header': gradients.header,
    '--theme-surface-blur': effects.surfaceBlur,
    '--theme-header-blur': effects.headerBlur,
    '--theme-noise-opacity': String(effects.noiseOpacity),
    '--theme-shadow': effects.shadow,
    '--btu-bg-page': colors.background,
    '--btu-bg-surface': colors.surface,
    '--btu-fill-muted': colors.surfaceHover,
    '--btu-surface-strong': colors.surfaceStrong,
    '--btu-border': colors.border,
    '--btu-border-soft': colors.borderSoft,
    '--btu-text-primary': colors.textPrimary,
    '--btu-text-secondary': colors.textSecondary,
    '--btu-text-tertiary': colors.textMuted,
    '--btu-accent': interaction.accent,
    '--btu-accent-strong': colors.primaryStrong,
    '--btu-accent-hover': colors.primaryHover,
    '--btu-accent-soft': interaction.selectedBg,
    '--btu-accent-ring': accentRing(interaction.accent),
    '--accent': interaction.accent,
    '--accent-hover': colors.primaryHover,
    '--accent-soft': interaction.selectedBg,
    '--accent-ring': accentRing(interaction.accent),
    '--selected-bg': interaction.selectedBg,
    '--selected-border': interaction.selectedBorder,
    '--selected-text': interaction.selectedText,
    '--selected-dot': interaction.selectedDot,
    '--control-bg': colors.surfaceStrong,
    '--control-border': colors.border,
    '--control-text': colors.textSecondary,
    '--btu-theme-accent': colors.accent,
    '--btu-theme-accent-secondary': colors.accentSecondary,
    '--btu-theme-primary-border': colors.primaryBorder,
    '--btu-theme-primary-button': gradients.primaryButton,
    '--btu-theme-preview': gradients.preview,
    '--btu-theme-header': gradients.header,
    '--btu-action-bg': colors.primaryStrong,
    '--btu-action-fg': colors.background
  };
  if (isColor(colors.deepBlue)) vars['--btu-theme-deep-blue'] = colors.deepBlue;
  for (const [name, value] of Object.entries(vars)) target.style.setProperty(name, value);
}

export function applyTheme(root, themeId, themes = []) {
  if (!root?.style || !root?.dataset) throw new TypeError('Theme root must be an element');
  const theme = resolveTheme(themeId, themes);
  const hosts = [root];
  const documentElement = root.ownerDocument?.documentElement;
  if (documentElement && documentElement !== root) hosts.push(documentElement);
  if (!theme) {
    for (const host of hosts) {
      for (const property of VARIABLE_NAMES) host.style.removeProperty(property);
      host.dataset.theme = DEFAULT_THEME_ID;
      delete host.dataset.themeMode;
      delete host.dataset.themeKind;
    }
    return false;
  }
  for (const host of hosts) paint(host, theme);
  return true;
}

export function themesByMode(themes, mode) {
  return (themes || []).filter((theme) => theme.mode === mode);
}

export function renderThemePicker(container, themes) {
  if (!container) return;
  const cards = themes.map((theme) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dm-theme-card';
    button.dataset.themeId = theme.id;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', 'false');
    const swatch = document.createElement('span');
    swatch.className = 'dm-theme-card__swatch';
    swatch.style.backgroundImage = theme.gradients.preview;
    swatch.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'dm-theme-card__name';
    name.dataset.themeName = theme.id;
    name.textContent = theme.name;
    const check = document.createElement('span');
    check.className = 'dm-theme-card__check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';
    button.append(swatch, name, check);
    return button;
  });
  container.replaceChildren(...cards);
}

export function syncThemePicker(container, themes, selectedId, labelFor = (_id, fallback) => fallback) {
  if (!container) return '';
  const selected = resolveTheme(selectedId, themes)?.id || '';
  for (const button of container.querySelectorAll('[data-theme-id]')) {
    button.setAttribute('aria-checked', String(button.dataset.themeId === selected));
    const name = button.querySelector('[data-theme-name]');
    if (!name) continue;
    const theme = themes.find((item) => item.id === name.dataset.themeName);
    name.textContent = labelFor(name.dataset.themeName, theme?.name || name.textContent);
  }
  return selected;
}
