import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('en, zh-CN and zh-TW i18n keys stay in sync', async () => {
  const mod = await import(pathToFileURL(join(root, 'src/shared/i18n.js')).href);
  const missing = mod.listMissingKeys();
  assert.deepEqual(missing.missingInZh, []);
  assert.deepEqual(missing.missingInEn, []);
  assert.deepEqual(missing.missingInZhTW, []);
  assert.deepEqual(missing.extraInZhTW, []);
  assert.equal(mod.resolveLanguage('en'), 'en');
  assert.equal(mod.resolveLanguage('zh-CN'), 'zh-CN');
  assert.equal(mod.resolveLanguage('zh-TW'), 'zh-TW');
  assert.equal(mod.translate('zh-CN', 'todayCleaned'), '今天已净化');
  assert.equal(mod.translate('zh-TW', 'todayCleaned'), '今天已淨化');
  assert.equal(mod.translate('zh-TW', 'exportSettings'), '匯出設定');
  assert.equal(mod.translate('en', 'rulesCount', { n: 3 }), '3 rules');
  assert.equal(mod.themeDisplayName('tokyo-love', 'zh-TW'), '櫻霧粉');
});
