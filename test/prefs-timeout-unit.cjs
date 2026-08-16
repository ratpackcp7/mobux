const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function loadPrefsWithShortDeadline() {
  let src = fs.readFileSync(path.join(__dirname, '../web/static/prefs.js'), 'utf8');
  const needle = 'const REQUEST_TIMEOUT_MS = 2500;';
  assert(src.includes(needle), 'prefs.js must define the production request deadline');
  src = src.replace(needle, 'const REQUEST_TIMEOUT_MS = 30;');
  const url = 'data:text/javascript;base64,' + Buffer.from(src).toString('base64');
  return import(url);
}

(async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = (_input, init = {}) => {
    calls += 1;
    // Model the failure mode from the installed TWA: a request that never
    // settles on its own. Browser fetch honors AbortSignal, so reject only when
    // the module's bounded-request helper aborts it.
    return new Promise((_resolve, reject) => {
      if (init.signal) {
        init.signal.addEventListener(
          'abort',
          () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          },
          { once: true },
        );
      }
    });
  };

  try {
    const prefs = await loadPrefsWithShortDeadline();
    const started = Date.now();
    const state = await prefs.hydrate();
    const elapsed = Date.now() - started;

    assert(elapsed < 500, `hydrate must fall back promptly, took ${elapsed}ms`);
    assert.equal(state.renderer, 'xterm', 'timeout fallback must keep defaults');
    assert.equal(state.mobile_input_mode, 'compose', 'timeout fallback must preserve mobile input default');
    assert.equal(calls, 1, 'hydrate should issue exactly one bounded GET');

    const writeStarted = Date.now();
    await prefs.set('theme', 'nord');
    const writeElapsed = Date.now() - writeStarted;
    assert(writeElapsed < 500, `preference write queue must also stay bounded, took ${writeElapsed}ms`);
    assert.equal(prefs.get('theme'), 'nord', 'local preference change must survive failed bounded persistence');
    assert.equal(calls, 3, 'set() should attempt one bounded GET and one bounded PUT after hydrate');

    console.log('PREFS_TIMEOUT_UNIT_PASS');
  } finally {
    global.fetch = originalFetch;
  }
})().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
