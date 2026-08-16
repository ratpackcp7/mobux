// Mobile native composer + keyboard geometry acceptance.
// Runs under both Pixel 7 renderer projects from playwright.config.cjs.
const { test, expect } = require('./fixtures.cjs');
const { createTmuxRunner } = require('./lib/tmux.cjs');
const { execSync } = require('child_process');

const BASE = process.env.MOBUX_URL || 'https://localhost:5151';
const USER = process.env.MOBUX_USER || '';
const PASS = process.env.MOBUX_PASS || '';
const AUTH = USER && PASS ? 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64') : null;
const SESSION = process.env.MOBUX_MOBILE_INPUT_SESSION || 'mobux-mobile-input';
const SANDBOX_HOME = process.env.MOBUX_TEST_HOME || '/tmp/mobux-smoke/home';
const tmux = createTmuxRunner('mobux-test');

const KEYBOARD_HEIGHT = 445;
const COMPACT_CHROME_MAX_PX = 56;

test.use({ ...(AUTH ? { extraHTTPHeaders: { Authorization: AUTH } } : {}) });

function resetSession() {
  tmux(`send-keys -t ${SESSION} C-c`);
  tmux(`send-keys -t ${SESSION} "PS1='\\$ '" Enter`);
  tmux(`send-keys -t ${SESSION} "clear" Enter`);
  execSync('sleep 0.25');
}

test.beforeAll(() => {
  try { tmux(`kill-session -t ${SESSION}`); } catch (_) {}
  tmux(`new-session -d -s ${SESSION} -e HISTFILE=/dev/null -e HOME=${SANDBOX_HOME} "bash --norc --noprofile"`);
});

test.beforeEach(() => resetSession());

test.afterAll(() => {
  try { tmux(`kill-session -t ${SESSION}`); } catch (_) {}
});

async function bootTerminal(page) {
  await page.goto(`${BASE}/app#/s/${SESSION}`, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const t = document.getElementById('terminal');
    const r = t?.getBoundingClientRect();
    return !!r && r.width > 50 && r.height > 50;
  }, { timeout: 10000 });
  await page.waitForFunction(() => window.__mobuxView?.test?.wsReady?.() === true, { timeout: 10000 });
  await page.waitForTimeout(450);
}

async function showComposer(page) {
  await page.evaluate(() => window.__mobuxView?.showInputBar?.());
  await expect(page.locator('#inputText')).toBeVisible();
  await page.locator('#inputText').focus();
}

async function setMode(page, wanted) {
  const toggle = page.locator('#inputModeToggle');
  const current = await page.locator('#inputBar').getAttribute('data-input-mode');
  if (current !== wanted) await toggle.click();
  await expect(page.locator('#inputBar')).toHaveAttribute('data-input-mode', wanted);
}

async function visibleTerminalText(page) {
  return page.evaluate(() => (document.getElementById('terminal')?.innerText || '').replace(/\s+/g, ' ').trim());
}

function capturedPane() {
  return tmux(`capture-pane -p -t ${SESSION}`).toString();
}

async function keyboardLikeResize(page) {
  const width = page.viewportSize().width;
  await page.setViewportSize({ width, height: KEYBOARD_HEIGHT });
  await page.evaluate(() => {
    // Playwright changes layout + visual viewport together. Preserve the old
    // layout height so Mobux sees the same visualViewport shrink Android emits.
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    window.visualViewport?.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(350);
}

async function geometry(page) {
  return page.evaluate(() => {
    const term = document.getElementById('terminal').getBoundingClientRect();
    const bar = document.getElementById('inputBar').getBoundingClientRect();
    const row = document.querySelector('.input-row').getBoundingClientRect();
    return {
      gap: bar.top - term.bottom,
      termBottom: term.bottom,
      barTop: bar.top,
      barBottom: bar.bottom,
      rowHeight: row.height,
      bodyHeightStyle: document.body.style.height,
      bodyTopStyle: document.body.style.top,
      bodyKeyboardOpen: document.body.classList.contains('keyboard-open'),
      viewportHeight: window.visualViewport?.height ?? window.innerHeight,
      viewportTop: window.visualViewport?.offsetTop ?? 0,
      terminalRows: window.__mobuxView?.test?.rows?.() ?? 0,
    };
  });
}

test('mode toggle is accessible and persists without dropping focus', async ({ page }) => {
  await bootTerminal(page);
  await showComposer(page);
  await setMode(page, 'compose');
  const toggle = page.locator('#inputModeToggle');
  await expect(toggle).toHaveAttribute('aria-label', /Switch to Live mode/);
  await toggle.click();
  await expect(page.locator('#inputBar')).toHaveAttribute('data-input-mode', 'live');
  await expect(page.locator('#inputText')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.__mobuxPrefs?.get('mobile_input_mode'))).toBe('live');
  // Prove the async prefs write reached the server before testing fresh boot.
  await expect.poll(async () => {
    const resp = await page.request.get(`${BASE}/api/settings/preferences`);
    return (await resp.json()).mobile_input_mode;
  }, { timeout: 5000 }).toBe('live');
  await page.reload({ waitUntil: 'load' });
  await bootTerminal(page);
  await showComposer(page);
  await expect(page.locator('#inputBar')).toHaveAttribute('data-input-mode', 'live');
  await page.evaluate(() => window.__mobuxPrefs?.set('mobile_input_mode', 'compose'));
  await expect.poll(() => page.evaluate(() => window.__mobuxPrefs?.get('mobile_input_mode'))).toBe('compose');
});

test('Compose buffers locally until Enter then clears', async ({ page }) => {
  await bootTerminal(page);
  await showComposer(page);
  await setMode(page, 'compose');
  const marker = `MOBUX_COMPOSE_${Date.now()}`;
  await page.locator('#inputText').fill(`echo ${marker}`);
  await page.waitForTimeout(200);
  expect(await visibleTerminalText(page)).not.toContain(marker);
  await page.locator('#inputText').press('Enter');
  await expect.poll(() => visibleTerminalText(page), { timeout: 5000 }).toContain(marker);
  await expect(page.locator('#inputText')).toHaveValue('');
});

test('Live append, delete, autocorrect-style replacement and IME commit stay synchronized', async ({ page }) => {
  await bootTerminal(page);
  await showComposer(page);
  await setMode(page, 'live');
  const input = page.locator('#inputText');
  const prefix = `MOBUX_LIVE_${Date.now()}_`;

  await input.pressSequentially(`${prefix}teh x`, { delay: 8 });
  await expect.poll(() => visibleTerminalText(page), { timeout: 5000 }).toContain(`${prefix}teh x`);

  // Native autocorrect/replacement edits the DOM value at once. The bridge
  // must localize the PTY edit rather than Ctrl-U + whole-line replacement.
  await page.evaluate((value) => {
    const el = document.getElementById('inputText');
    el.value = value;
    el.setSelectionRange(value.length, value.length);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: null }));
  }, `${prefix}the x`);
  await expect.poll(() => visibleTerminalText(page), { timeout: 5000 }).toContain(`${prefix}the x`);

  await input.press('Backspace');
  await expect.poll(() => visibleTerminalText(page), { timeout: 5000 }).toContain(`${prefix}the `);

  const ime = '漢';
  await page.evaluate((ch) => {
    const el = document.getElementById('inputText');
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    el.value += ch;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: ch, isComposing: true }));
  }, ime);
  expect(await visibleTerminalText(page)).not.toContain(ime);
  await page.evaluate((ch) => {
    document.getElementById('inputText').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: ch }));
  }, ime);
  await expect.poll(() => visibleTerminalText(page), { timeout: 5000 }).toContain(ime);
});

test('switching Compose→Live sends pending text once; Live→Compose Enter does not duplicate it', async ({ page }) => {
  await bootTerminal(page);
  await showComposer(page);
  await setMode(page, 'compose');
  const marker = `MOBUX_SWITCH_${Date.now()}`;
  const command = `echo ${marker}`;
  const input = page.locator('#inputText');
  await input.fill(command);
  await setMode(page, 'live');
  await expect.poll(() => visibleTerminalText(page), { timeout: 5000 }).toContain(command);
  await setMode(page, 'compose');
  await input.press('Enter');
  await expect.poll(() => visibleTerminalText(page), { timeout: 5000 }).toContain(marker);
  const pane = capturedPane();
  expect((pane.match(new RegExp(marker, 'g')) || []).length).toBe(2); // echoed command + command output
  expect(pane).not.toContain(command + command);
});

test('unsafe Live edit preserves native value and visibly falls back to Compose', async ({ page }) => {
  await bootTerminal(page);
  await showComposer(page);
  await setMode(page, 'live');
  const input = page.locator('#inputText');
  await input.fill('x漢y'); // safe append: no terminal cursor movement required
  const value = 'xzy';
  await page.evaluate((v) => {
    const el = document.getElementById('inputText');
    el.value = v;
    el.setSelectionRange(2, 2);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
  }, value);
  await expect(input).toHaveValue(value);
  await expect(page.locator('#inputBar')).toHaveAttribute('data-input-mode', 'compose');
  await expect(page.locator('#inputBar')).toHaveAttribute('data-live-fallback', '');
  await expect(page.locator('#inputModeToggle')).toHaveText('Compose!');
});

test('keyboard-open geometry has no dead strip, keeps last terminal area visible, and compact chrome <=56px', async ({ page }, testInfo) => {
  await bootTerminal(page);
  await showComposer(page);
  await keyboardLikeResize(page);
  const g = await geometry(page);
  const screenshot = testInfo.outputPath(`mobile-input-${testInfo.project.name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  testInfo.attachments.push({ name: 'keyboard-open', path: screenshot, contentType: 'image/png' });

  expect(Math.abs(g.gap), `terminal→bar gap=${g.gap}px`).toBeLessThanOrEqual(1.5);
  expect(g.rowHeight, `compact row=${g.rowHeight}px`).toBeLessThanOrEqual(COMPACT_CHROME_MAX_PX);
  expect(g.termBottom).toBeLessThanOrEqual(g.barTop + 1.5);
  expect(g.barBottom).toBeLessThanOrEqual(g.viewportTop + g.viewportHeight + 1.5);
  expect(g.terminalRows).toBeGreaterThan(5);
  expect(g.bodyKeyboardOpen).toBe(true);
  expect(parseFloat(g.bodyHeightStyle)).toBeGreaterThan(0);
});

test('keyboard close clears inline geometry state', async ({ page }) => {
  await bootTerminal(page);
  await showComposer(page);
  await keyboardLikeResize(page);
  await page.evaluate(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: window.visualViewport.height });
    window.visualViewport?.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => ({
    height: document.body.style.height,
    top: document.body.style.top,
    open: document.body.classList.contains('keyboard-open'),
  }));
  expect(state.height).toBe('');
  expect(state.top).toBe('');
  expect(state.open).toBe(false);
});

test('composer keeps real-device search workaround while preserving Gboard autocorrect/composition', async ({ page }) => {
  await bootTerminal(page);
  await showComposer(page);
  const attrs = await page.evaluate(() => {
    const el = document.getElementById('inputText');
    return {
      type: el.type,
      role: el.getAttribute('role'),
      inputmode: el.getAttribute('inputmode'),
      autocomplete: el.getAttribute('autocomplete'),
      autocorrect: el.getAttribute('autocorrect'),
      name: el.getAttribute('name'),
      formType: el.getAttribute('data-form-type'),
      lpignore: el.getAttribute('data-lpignore'),
    };
  });
  expect(attrs).toEqual({
    type: 'search',
    role: 'searchbox',
    inputmode: 'text',
    autocomplete: 'off',
    autocorrect: 'on',
    name: 'mobux-composer',
    formType: 'other',
    lpignore: 'true',
  });
});
