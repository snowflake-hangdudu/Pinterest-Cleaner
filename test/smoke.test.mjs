import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('manifest is MV3 with minimal permissions', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.ok(manifest.host_permissions.some((item) => item.includes('pinterest.com')));
  assert.equal(manifest.default_locale, 'en');
});

test('settings normalize and backup roundtrip', async () => {
  const settingsUrl = pathToFileURL(join(root, 'src/storage/settings.js')).href;
  const mod = await import(settingsUrl);
  const normalized = mod.normalizeSettings({
    ai: { mode: 'aggressive' },
    keywordRules: [{ name: 'AI tools', keywords: ['Midjourney', 'Flux'], operator: 'OR' }]
  });
  assert.equal(normalized.schemaVersion, 1);
  assert.equal(normalized.ai.mode, 'aggressive');
  assert.equal(normalized.keywordRules[0].keywords.length, 2);
  const backup = mod.exportBackup(normalized);
  assert.equal(backup.app, 'pinterest-cleaner');
  assert.equal(backup.settings.stats.total, 0);
  const imported = mod.importBackup(backup);
  assert.equal(imported.ai.mode, 'aggressive');
});

test('content pipeline scripts are listed in order', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  const js = manifest.content_scripts[0].js;
  assert.equal(js[0], 'src/content/lib/namespace.js');
  assert.equal(js.at(-1), 'src/content/main.js');
  for (const file of js) {
    readFileSync(join(root, file), 'utf8');
  }
});
