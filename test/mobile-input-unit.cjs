const fs = require('fs');
const assert = require('assert');
const path = require('path');

async function loadInputMode() {
  let src = fs.readFileSync(path.join(__dirname, '../web/static/input-mode.js'), 'utf8');
  // Pure diff tests do not need network/server prefs. Replace only the static
  // module import with a tiny in-memory prefs contract so the ESM can load from
  // a data URL under Node's CommonJS package default.
  src = src.replace(
    "import * as prefs from './prefs.js';",
    "const prefs = { get: () => 'compose', set: () => Promise.resolve() };",
  );
  const url = 'data:text/javascript;base64,' + Buffer.from(src).toString('base64');
  return import(url);
}

(async () => {
  const m = await loadInputMode();
  assert.equal(m.computeLiveEdit('hel', 'hello'), 'lo', 'append must emit suffix only');
  assert.equal(m.computeLiveEdit('hello', 'hell'), '\x7f', 'trailing delete must backspace');
  assert.equal(
    m.computeLiveEdit('hello world', 'hello brave world'),
    '\x1b[D'.repeat(5) + 'brave ' + '\x1b[C'.repeat(5),
    'mid-line insertion must move over unchanged suffix and restore cursor',
  );
  assert.equal(
    m.computeLiveEdit('hello brave world', 'hello world'),
    '\x1b[D'.repeat(5) + '\x7f'.repeat(6) + '\x1b[C'.repeat(5),
    'mid-line deletion must be localized, not whole-line clearing',
  );
  assert.equal(m.computeLiveEdit('', '漢'), '漢', 'Unicode append/IME commit is safe without cursor motion');
  assert.equal(m.computeLiveEdit('x漢y', 'xzy'), null, 'Unicode cursor-moving replacement must fall back conservatively');
  assert.equal(
    m.computeLiveEdit('teh x', 'the x'),
    '\x1b[D\x1b[D\x7f\x7fhe\x1b[C\x1b[C',
    'mid replacement must move before unchanged suffix, backspace replaced text, insert, then restore remote cursor to end',
  );
  assert.equal(m.computeLiveEdit('a'.repeat(600), 'b'.repeat(600)), null, 'oversized/unsafe edit must fall back conservatively');

  const inputModeSource = fs.readFileSync(path.join(__dirname, '../web/static/input-mode.js'), 'utf8');
  assert(!inputModeSource.includes('\\x15'), 'Live diff logic must never use unconditional Ctrl-U whole-line clearing');

  const jsx = fs.readFileSync(path.join(__dirname, '../web/spa/src/components/TerminalIsland.jsx'), 'utf8');
  assert.match(jsx, /type=["']search["']/, 'real-device Chrome workaround must keep search semantics');
  assert.match(jsx, /autocorrect=["']on["']|autoCorrect=["']on["']/, 'Gboard autocorrect/prediction must remain enabled');
  assert.match(jsx, /autocomplete=["']one-time-code["']/, 'composer must use a valid non-address/payment/password autofill semantic');
  assert(!/name=["']mobux-composer["']/.test(jsx), 'composer must not advertise a reusable form-field name to Chrome autofill');

  const xtermRenderer = fs.readFileSync(path.join(__dirname, '../web/static/renderer-xterm.js'), 'utf8');
  assert(!xtermRenderer.includes('Math.floor(hostH / c.height) - 1'), 'xterm must not reserve a whole blank row below the PTY');

  console.log('MOBILE_INPUT_UNIT_PASS');
})().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
