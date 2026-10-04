import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/content/data-filter.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  let depth = 0;
  let end = -1;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  assert.ok(end > start, `unterminated ${name}`);
  // eslint-disable-next-line no-new-func
  return new Function(`${source.slice(start, end)}; return ${name};`)();
}

test('data-layer video detection uses authoritative pin fields only', () => {
  const isVideoPin = extractFunction('isVideoPin');
  const isPromotedPin = extractFunction('isPromotedPin');
  assert.equal(isVideoPin({ type: 'pin', is_video: true }), true);
  assert.equal(isVideoPin({ type: 'pin', creative_type: 'VIDEO' }), true);
  assert.equal(isVideoPin({
    type: 'pin',
    videos: { video_list: { V_HLS720P: { url: 'https://v.pinimg.com/x.mp4' } } }
  }), true);
  assert.equal(isVideoPin({ type: 'pin', videos: {} }), false);
  assert.equal(isVideoPin({ type: 'pin', title: 'how to edit video' }), false);
  assert.equal(isPromotedPin({ type: 'pin', is_promoted: true }), true);
  assert.equal(isPromotedPin({ type: 'pin', is_promoted: false }), false);
});
