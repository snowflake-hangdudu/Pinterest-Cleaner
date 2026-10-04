import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { normalizeSettings, STORAGE_KEY, incrementStats, saveSettings } from '../src/storage/settings.js';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
const sleep = (ms = 40) => new Promise(resolve => setTimeout(resolve, ms));
const card = (id, text = '', extra = '') => `<div data-test-id="pin" data-test-pin-id="${id}"><div data-test-id="pinWrapper"><a href="/pin/${id}/"><img alt="${text}" title="${text}"></a>${extra}</div></div>`;
function fixture(html) {
  const dom = new JSDOM(`<main>${html}</main>`, { url:'https://www.pinterest.com/',runScripts:'outside-only',pretendToBeVisual:true });
  const win = dom.window;
  let settings = normalizeSettings({});
  let changeListener;
  let messageListener;
  const bumps = [];
  win.chrome = {
    storage: { local: {get:async()=>({[STORAGE_KEY]:structuredClone(settings)})},onChanged:{addListener:fn=>changeListener=fn}},
    runtime: {onMessage:{addListener:fn=>messageListener=fn},sendMessage:async(message)=>{
      if (message.type === 'PC_BUMP_STATS') bumps.push(message);
      return {ok:true,paused:false};
    }}
  };
  for(const file of manifest.content_scripts[0].js) win.eval(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'));
  return { dom, win, bumps, async update(patch) { const old = settings; settings = normalizeSettings({...settings,...patch}); changeListener({[STORAGE_KEY]:{oldValue:old,newValue:settings}},'local'); await sleep(); }, async message(message) { await new Promise(resolve=>messageListener(message,{},resolve)); await sleep(); } };
}
test('actual sponsored footer is hidden once, canonical card only, and restores live', async()=>{
  const f = fixture(card('100','Room','<div><a href="/brand/"><div>Brand</div><div>赞助的 Pin 图</div></a></div>'));
  try {
    await sleep();
    const node=f.win.document.querySelector('[data-test-id="pin"]');
    assert.equal(node.getAttribute('data-pc-filtered'),'true');
    assert.equal(f.win.document.querySelectorAll('[data-pc-filtered]').length,1);
    assert.equal(f.bumps.length,1);
    node.querySelector('img').dispatchEvent(new f.win.Event('load'));
    await sleep();
    assert.equal(f.bumps.length,1,'load recheck must not recount hidden card');
    await f.update({enabled:false});
    assert.equal(node.hasAttribute('data-pc-filtered'),false);
    await f.update({enabled:true});
    assert.equal(node.getAttribute('data-pc-filtered'),'true');
    await f.update({showFiltered:true});
    assert.equal(node.classList.contains('pc-hide-filtered'),false);
    assert.equal(node.classList.contains('pc-show-filtered'),true);
    await f.message({type:'PC_SET_TAB_PAUSE',paused:true});
    assert.equal(node.hasAttribute('data-pc-filtered'),false);
    await f.message({type:'PC_SET_TAB_PAUSE',paused:false});
    assert.equal(node.getAttribute('data-pc-filtered'),'true');
  } finally {f.dom.window.close();}
});
test('dynamic insertion and late footer text are handled without scanning nested cards',async()=>{
  const f=fixture(card('104','Room','<div id="footer">Normal</div>'));
  try {await sleep();
    f.win.document.getElementById('footer').firstChild.data='赞助的 Pin 图';
    f.win.document.querySelector('main').insertAdjacentHTML('beforeend',card('105','Room','<div>赞助的 Pin 图</div>'));
    await sleep();
    assert.equal(f.win.document.querySelectorAll('[data-pc-filtered]').length,2);
    assert.equal(f.bumps.length,2);
    const scanned=f.win.PC.diagnostics.counters.scanned;
    await f.update({stats:{...f.win.PC.state.stats,total:20}});
    assert.equal(f.win.PC.diagnostics.counters.scanned,scanned,'stats-only update must not rescan');
  }finally{f.dom.window.close();}
});
test('background writer serializes counters and settings changes',async()=>{
  const previous=globalThis.chrome;
  let root=normalizeSettings({});
  globalThis.chrome={storage:{local:{get:async()=>({[STORAGE_KEY]:structuredClone(root)}),set:async(data)=>{await sleep(1);root=structuredClone(data[STORAGE_KEY]);}}}};
  try {
    await Promise.all([incrementStats('AD'),incrementStats('AI'),saveSettings({enabled:false}),incrementStats('AD')]);
    assert.equal(root.stats.total,3);assert.equal(root.stats.ad,2);assert.equal(root.stats.ai,1);assert.equal(root.enabled,false);
  }finally{globalThis.chrome=previous;}
});
