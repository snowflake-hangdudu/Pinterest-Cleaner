import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('ambient theme json includes required fields', () => {
  const data = JSON.parse(readFileSync(join(root, 'src/ui/themes-ambient-full.json'), 'utf8'));
  assert.ok(Array.isArray(data.themes));
  assert.ok(data.themes.some((theme) => theme.id === 'obsidian'));
  for (const theme of data.themes) {
    assert.ok(theme.gradients.background, `${theme.id} missing gradients.background`);
    assert.ok(theme.gradients.primaryButton, `${theme.id} missing gradients.primaryButton`);
    assert.ok(theme.gradients.preview, `${theme.id} missing gradients.preview`);
    assert.ok(theme.colors.background, `${theme.id} missing colors.background`);
    assert.ok(theme.effects?.surfaceBlur);
  }
});

test('theme helpers resolve default and paint vars', async () => {
  const mod = await import(pathToFileURL(join(root, 'src/ui/theme.js')).href);
  const themes = JSON.parse(readFileSync(join(root, 'src/ui/themes-ambient-full.json'), 'utf8')).themes;
  const theme = mod.resolveTheme('missing', themes);
  assert.equal(theme.id, 'obsidian');

  const rootEl = {
    style: { props: {}, setProperty(k, v) { this.props[k] = v; }, removeProperty(k) { delete this.props[k]; } },
    dataset: {},
    ownerDocument: { documentElement: null }
  };
  assert.equal(mod.applyTheme(rootEl, 'obsidian', themes), true);
  assert.ok(rootEl.style.props['--theme-gradient-background']);
  assert.ok(rootEl.style.props['--btu-accent']);
  assert.ok(rootEl.style.props['--selected-border']);
  assert.ok(rootEl.style.props['--accent']);
  assert.equal(rootEl.dataset.theme, 'obsidian');
});
