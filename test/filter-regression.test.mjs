import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function setup() {
  const context = vm.createContext({ chrome: {}, console });
  for (const name of ['namespace', 'ad-locales', 'detectors', 'engine']) {
    vm.runInContext(readFileSync(new URL(`../src/content/lib/${name}.js`, import.meta.url), 'utf8'), context);
  }
  const PC = context.PC;
  PC.selectorRegistry = { query: () => null };
  return PC;
}
function pin(patch = {}) {
  return { title: '', description: '', alt: '', labels: [], textBlob: '', creator: {}, source: {}, element: { querySelector: () => null }, ...patch };
}
test('actual Chinese and English sponsored labels match', () => {
  const PC = setup();
  for (const label of ['赞助的 Pin 图', '赞助的Pin图', '贊助的 Pin', 'Sponsored', 'Brand Sponsored', 'Promoted by Brand']) {
    assert.equal(PC.labelMatches(label, PC.AD_LABELS.promoted), true, label);
  }
  for (const text of ['traditional interior', '广告设计', '寻找赞助', '品牌赞助的设计教程']) assert.equal(PC.labelMatches(text, PC.AD_LABELS.promoted), false, text);
  assert.equal(PC.textHasPromotedLabel('Amazon\n赞助的 Pin 图'), true);
});
test('whitelist wins over ads and user keyword block', () => {
  const PC = setup();
  const settings = structuredClone(PC.DEFAULT_SETTINGS);
  settings.whitelistRules = [{enabled:true,type:'keyword',value:'portrait',id:'allow'}];
  settings.keywordRules = [{enabled:true,keywords:['portrait'],fields:['title'],operator:'OR'}];
  assert.equal(PC.engine.decide(pin({title:'portrait',promoted:true}), settings).reason, 'WHITELIST');
});
test('invalid regex is isolated and ads still run', () => {
  const PC = setup();
  const settings = structuredClone(PC.DEFAULT_SETTINGS);
  settings.keywordRules = [{enabled:true,keywords:['['],fields:['title'],matchType:'regex'}];
  assert.equal(PC.engine.decide(pin({promoted:true}), settings).reason, 'AD');
});

