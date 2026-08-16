// ── Mobile Input Bar ─────────────────────────────────────────────────
//
// Bottom bar with control-key ribbon + text input.
// Replaces direct xterm.js textarea interaction on mobile.
//
// - Ribbon buttons send control chars / escape sequences directly to PTY
// - Text input: native keyboard with autocomplete/voice. Enter sends + clears.
// - Bar appears on tap, hides when keyboard dismisses.
// - Compose <-> Live mode: Compose buffers locally, Live streams diff to PTY.
//

import { createAttachAction, createDictateAction } from './input-actions.js';
import telemetry from './telemetry.js';
import { computeLiveEdit, getStoredInputMode, setStoredInputMode, INPUT_MODE_DEFAULT } from './input-mode.js';

export function createInputBar(engine, send, node = '') {
  const bar = document.getElementById('inputBar');
  const ribbon = document.getElementById('inputRibbon');
  const input = document.getElementById('inputText');
  const sendBtn = document.getElementById('inputSend');
  // Complete no-op shape: callers invoke .show()/.hide(), so a partial stub
  // would throw. Mirror the real public API below.
  if (!bar || !input) return { show() {}, hide() {}, destroy() {}, getMode() { return INPUT_MODE_DEFAULT; }, _computeKeyboardOffset: null };

  // ── Disable the renderer's native input on mobile ─────────────────
  // We own input now. Tell the renderer to release its native input surface
  // so it can't steal focus / pop the soft keyboard (R15). The engine routes
  // this to the live adapter — the input bar never touches renderer internals.
  engine.setNativeInputEnabled(false);

  // ── Input mode (Compose <-> Live) ──────────────────────────────────
  let mode = getStoredInputMode(); // 'compose' | 'live'
  let shadow = ""; // Live mode: text already reflected to PTY
  let composeRemoteShadow = ""; // reflected base when Live falls/switches to Compose
  let isComposing = false;
  let ribbonExpanded = false;
  let liveFallbackReason = "";

  const modeToggle = document.getElementById('inputModeToggle');
  const expandBtn = document.getElementById('inputExpandBtn');

  function reflectMode() {
    if (modeToggle) {
      const fallback = mode === "compose" && !!liveFallbackReason;
      modeToggle.textContent = fallback ? "Compose!" : mode === "live" ? "Live" : "Compose";
      modeToggle.setAttribute("aria-pressed", mode === "live" ? "true" : "false");
      modeToggle.setAttribute(
        "aria-label",
        fallback
          ? `Compose mode. Live paused: ${liveFallbackReason}`
          : mode === "live"
            ? "Switch to Compose mode"
            : "Switch to Live mode",
      );
      modeToggle.title = fallback
        ? `Live paused: ${liveFallbackReason}. Edit safely in Compose, then send.`
        : mode === "live"
          ? "Live: native edits stream to terminal"
          : "Compose: edit locally, Enter to send";
    }
    bar.setAttribute("data-input-mode", mode);
    bar.toggleAttribute("data-live-fallback", mode === "compose" && !!liveFallbackReason);
  }
  reflectMode();

  function fallbackToCompose(reason) {
    composeRemoteShadow = shadow;
    liveFallbackReason = reason || "edit could not be mapped safely";
    mode = "compose";
    setStoredInputMode(mode);
    reflectMode();
  }

  function setMode(next) {
    if ((next !== "compose" && next !== "live") || next === mode) return true;

    if (next === "live") {
      // Compose may contain text that has not reached the PTY yet. Reconcile it
      // exactly once before declaring it reflected by Live.
      const seq = computeLiveEdit(composeRemoteShadow, input.value);
      if (seq === null) {
        liveFallbackReason = "current text cannot be mapped safely to Live";
        reflectMode();
        try { input.focus(); } catch (_) {}
        return false;
      }
      if (seq) send(seq);
      shadow = input.value;
      composeRemoteShadow = "";
      liveFallbackReason = "";
      mode = "live";
    } else {
      // Preserve the native text while remembering what Live already reflected,
      // so Compose Enter/inject sends only the still-pending edit, never a
      // duplicate copy of the line.
      composeRemoteShadow = shadow;
      liveFallbackReason = "";
      mode = "compose";
    }

    setStoredInputMode(mode);
    reflectMode();
    try { input.focus(); } catch (_) {}
    return true;
  }

  if (modeToggle) {
    modeToggle.addEventListener("click", (e) => {
      e.preventDefault();
      setMode(mode === "compose" ? "live" : "compose");
    });
    modeToggle.addEventListener("mousedown", (e) => e.preventDefault());
  }

  // ── Ribbon expand/collapse (compact chrome R6) ─────────────────────
  // Preserve the legacy ribbon whenever the keyboard is closed. CSS collapses
  // it only under body.keyboard-open unless this explicit expanded class is set.
  function reflectRibbon() {
    ribbon?.classList.toggle("input-ribbon--expanded", ribbonExpanded);
    if (expandBtn) {
      expandBtn.textContent = ribbonExpanded ? "▴" : "▾";
      expandBtn.setAttribute("aria-expanded", ribbonExpanded ? "true" : "false");
      expandBtn.setAttribute("aria-label", ribbonExpanded ? "Collapse controls" : "Expand controls");
    }
  }

  ribbonExpanded = false;
  reflectRibbon();

  if (expandBtn) {
    expandBtn.addEventListener("click", (e) => {
      e.preventDefault();
      ribbonExpanded = !ribbonExpanded;
      reflectRibbon();
      // Re-measure terminal after chrome height changes
      resizeTerminal();
      try { input.focus(); } catch (_) {}
    });
    expandBtn.addEventListener("mousedown", (e) => e.preventDefault());
  }

  // Showing the bar preserves the legacy ribbon while the keyboard is closed.
  // terminal.js toggles body.keyboard-open; CSS performs the compact collapse.
  const origShow = () => {
    bar.classList.remove('hidden');
    resizeTerminal();
  };

  // ── Parse escape sequences from data-key attributes ───────────────
  function parseKey(raw) {
    return raw.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
              .replace(/\\t/g, '\t')
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r');
  }

  // ── Show/hide bar ─────────────────────────────────────────────────
  // The bar is now a flex item (see style.css), so `.hidden` toggles
  // `display: none`. Showing/hiding the bar resizes the flex children
  // (#terminal / #reader); fire a synchronous resize so the engine
  // and reader recompute their bounds in the same task.
  function show() {
    origShow();
  }

  function hide() {
    bar.classList.add('hidden');
    // terminal.js owns body.style.height tracking (renderer-agnostic
    // visualViewport handler). It will clear the inline height the
    // next time the viewport grows back; we don't touch it here so a
    // hide() while the keyboard is still up doesn't cause body to snap
    // to 100vh and re-cover the keyboard space.
    input.blur();
    resizeTerminal();
    // Reset expanded state on hide so next keyboard-open is compact again
    ribbonExpanded = false;
    reflectRibbon();
  }

  function computeKeyboardOffset(innerHeight, vvHeight, vvOffsetTop) {
    return Math.max(0, innerHeight - vvHeight - vvOffsetTop);
  }

  function resizeTerminal() {
    // Notify synchronously so layout-dependent consumers (engine resize,
    // reader re-pin) read the freshly-shrunk host height
    // in the same task — no visible jump on the next frame.
    window.dispatchEvent(new Event('resize'));
  }

  // ── Ribbon: send control chars directly to PTY ────────────────────
  ribbon.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;
    e.preventDefault();
    const seq = parseKey(btn.dataset.key);
    send(seq);
    // Keep focus on input so keyboard stays up
    input.focus();
  });

  // Prevent ribbon buttons from stealing focus, but allow scroll
  ribbon.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) e.preventDefault();
  });
  // Don't preventDefault touchstart — it kills ribbon scrolling.
  // Instead, prevent focus steal via mousedown only.

  // ── Text input: Compose vs Live ───────────────────────────────────
  function clearComposerState() {
    input.value = '';
    shadow = "";
    composeRemoteShadow = "";
    liveFallbackReason = "";
    reflectMode();
  }

  function composePendingBytes(text) {
    if (!composeRemoteShadow) return text;
    return computeLiveEdit(composeRemoteShadow, text);
  }

  function sendCompose(execute) {
    const text = input.value;
    const seq = composePendingBytes(text);
    if (seq === null) {
      liveFallbackReason = "pending edit is still unsafe to map; shorten or simplify it";
      reflectMode();
      return false;
    }
    if (seq) send(seq);
    if (execute) send('\r');
    clearComposerState();
    return true;
  }

  function sendAndExecute() {
    const text = input.value;
    if (mode === "compose") {
      sendCompose(true);
      return;
    }

    if (text !== shadow) {
      const seq = computeLiveEdit(shadow, text);
      if (seq === null) {
        fallbackToCompose("edit could not be mapped safely");
        return;
      }
      if (seq) send(seq);
      shadow = text;
    }
    send('\r');
    clearComposerState();
  }

  function sendWithoutEnter() {
    const text = input.value;
    if (mode === "compose") {
      sendCompose(false);
      input.focus();
      return;
    }

    if (text !== shadow) {
      const seq = computeLiveEdit(shadow, text);
      if (seq === null) {
        fallbackToCompose("edit could not be mapped safely");
        input.focus();
        return;
      }
      if (seq) send(seq);
      shadow = text;
    }
    clearComposerState();
    input.focus();
  }

  // Live mode: shadow/diff bridge over native composer.
  // We listen to `input` events (post-composition) and `compositionend`.
  input.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  input.addEventListener("compositionend", () => {
    isComposing = false;
    if (mode !== "live") return;
    const newVal = input.value;
    if (newVal === shadow) return;
    const seq = computeLiveEdit(shadow, newVal);
    if (seq === null) {
      fallbackToCompose("composition edit could not be mapped safely");
      return;
    }
    if (seq) send(seq);
    shadow = newVal;
  });

  input.addEventListener("input", () => {
    if (mode !== "live" || isComposing) return;
    const newVal = input.value;
    if (newVal === shadow) return;
    const seq = computeLiveEdit(shadow, newVal);
    if (seq === null) {
      fallbackToCompose("edit could not be mapped safely");
      return;
    }
    if (seq) send(seq);
    shadow = newVal;
  });

  // Handle Enter, Escape, and paste/IME deduplication is covered by input event above.
  // Enter must not trigger input diff double-send.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendAndExecute();
    }
  });

  // Paste: let input event handle Live diff; Compose just buffers.
  // Ensure we don't duplicate: no direct send on paste event.

  sendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sendWithoutEnter();
    input.focus();
  });

  // ── Activate on touch/tap overlay ─────────────────────────────────
  // Double-tap on terminal area shows the input bar
  const overlay = document.getElementById('touchOverlay');

  function activateInput() {
    show();
    // Android only opens the soft keyboard reliably when focus happens inside
    // the same user gesture. Deferring focus loses that activation token and
    // turns tap-to-type into an accidental double-tap flow.
    try {
      input.focus({ preventScroll: true });
    } catch (_) {
      input.focus();
    }
  }

  // ── Auto-hide bar when the keyboard dismisses ─────────────────────
  // Body-height tracking (i.e. shrinking the layout to match
  // visualViewport.height when the soft keyboard opens) is owned by
  // terminal.js's renderer-agnostic visualViewport handler — it must
  // work whether or not the input bar is mounted. This listener only
  // handles bar UX: when the keyboard dismisses (viewport grows back
  // by > 50px), tuck the bar away too so the user gets terminal-full
  // space back.
  let removeViewportListeners = null;
  if (window.visualViewport) {
    const vv = window.visualViewport;
    let lastHeight = vv.height;
    const onViewportChange = () => {
      const h = vv.height;
      if (h > lastHeight + 50 && !bar.classList.contains('hidden')) {
        hide();
      }
      lastHeight = h;
    };
    vv.addEventListener('resize', onViewportChange);
    vv.addEventListener('scroll', onViewportChange);
    removeViewportListeners = () => {
      vv.removeEventListener('resize', onViewportChange);
      vv.removeEventListener('scroll', onViewportChange);
    };
  }

  // Also hide on Escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      hide();
    }
  });

  // ── File attach (any file type) ───────────────────────────────────
  // Shared with the desktop top bar (input-actions.js). The button just
  // triggers the action; the action owns the hidden file input + upload +
  // the persistent inline error surface. `#inputToast` is the JSX-rendered
  // status slot already reserved for exactly this (`role="status"
  // aria-live="polite"` in TerminalIsland.jsx) — createAttachAction
  // populates it instead of this file building its own DOM.
  const uploadBtn = document.getElementById('uploadBtn');
  const errorContainer = document.getElementById('inputToast');
  const attach = createAttachAction({
    send,
    node,
    button: uploadBtn,
    errorContainer,
  });
  if (uploadBtn) {
    uploadBtn.addEventListener('click', (e) => { e.preventDefault(); attach.trigger(); });
    // Prevent focus steal
    uploadBtn.addEventListener('mousedown', (e) => e.preventDefault());
  }

  // ── Speech-to-text (dictation) ────────────────────────────────────
  // Shared with the desktop top bar. The action owns capture/transcribe +
  // overlay + telemetry; here we wire it to the mobile mic button and
  // re-focus the text input after a successful injection.
  const micBtn = document.getElementById('micBtn');
  const dictate = createDictateAction({
    send,
    button: micBtn,
    onText: () => input.focus(),
  });
  if (micBtn) {
    micBtn.addEventListener('mousedown', (e) => e.preventDefault());
    micBtn.addEventListener('click', (e) => {
      telemetry.log('mic.tap', {
        hasButton: true,
        isSecureContext: window.isSecureContext,
        hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
        pointerType: e.pointerType || null,
      });
      e.preventDefault();
      dictate.toggle();
    });
  } else {
    telemetry.log('mic.wire.missing');
  }

  // Settings gear — direct navigation to /settings. Phones can't always rely
  // on Back to return here (incognito back-stack is flaky), so the bar needs
  // its own way in, mirroring the desktop top bar's gear.
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('mousedown', (e) => e.preventDefault());
    settingsBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.href = '/settings'; });
  }

  // ── Public API ────────────────────────────────────────────────────
  return {
    _computeKeyboardOffset: computeKeyboardOffset,
    _computeLiveEdit: computeLiveEdit,
    getMode: () => mode,
    setMode,
    // show() — show the bar AND synchronously focus the text input (the
    // single-tap engagement path in terminal.js, #201).
    show: activateInput,
    hide,
    // Full teardown for a same-document engine remount: everything wired
    // OUTSIDE the host subtree (visualViewport listeners, the attach
    // action's hidden file input on document.body, an active dictation's
    // mic stream + full-viewport overlay) must go — the subtree listeners
    // die with the DOM, but none of those live in the subtree.
    destroy() {
      removeViewportListeners?.();
      attach.destroy?.();
      dictate.destroy?.();
      engine.setNativeInputEnabled(true);
    }
  };
}
