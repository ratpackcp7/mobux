const assert = require('assert');
const {
  computeBuildHashFromEntries,
  shouldInclude,
} = require('../web/build-hash.js');

function hash(overrides = {}) {
  const entries = [
    ['terminal.js', overrides['terminal.js'] ?? 'terminal-v1'],
    ['input-bar.js', overrides['input-bar.js'] ?? 'input-v1'],
    ['style.css', 'body{}'],
    ['spa/assets/index.js', 'spa-v1'],
    ['vendor/xterm.bundle.js', 'xterm-v1'],
  ].map(([path, bytes]) => ({ path, bytes }));
  return computeBuildHashFromEntries(entries);
}

const baseline = hash();
assert.match(baseline, /^[0-9a-f]{8}$/, 'build identity must be an 8-char hex digest');
assert.equal(hash(), baseline, 'same client tree must hash deterministically');
assert.notEqual(hash({ 'terminal.js': 'terminal-v2' }), baseline, 'terminal.js changes must change build identity');
assert.notEqual(hash({ 'input-bar.js': 'input-v2' }), baseline, 'input-bar.js changes must change build identity');

const reversed = computeBuildHashFromEntries([
  { path: 'z.js', bytes: 'z' },
  { path: 'a.js', bytes: 'a' },
]);
const ordered = computeBuildHashFromEntries([
  { path: 'a.js', bytes: 'a' },
  { path: 'z.js', bytes: 'z' },
]);
assert.equal(reversed, ordered, 'entry ordering must not affect build identity');

assert.equal(shouldInclude('build-info.json'), false, 'generated build-info.json must be excluded');
assert.equal(shouldInclude('build-info.js'), false, 'generated build-info.js must be excluded');
assert.equal(shouldInclude('vendor/xterm.bundle.js.map'), false, 'source maps must be excluded');
assert.equal(shouldInclude('install/mobux.apk'), false, 'generated APK must be excluded');
assert.equal(shouldInclude('.well-known/assetlinks.json'), false, 'generated Android association must be excluded');
assert.equal(shouldInclude('terminal.js'), true, 'first-party terminal module must be included');
assert.equal(shouldInclude('input-bar.js'), true, 'first-party input module must be included');
assert.equal(shouldInclude('spa/assets/index.js'), true, 'SPA output must be included');

console.log('BUILD_HASH_UNIT_PASS');
