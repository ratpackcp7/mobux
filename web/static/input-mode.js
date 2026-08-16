// ── Input Mode Diff Bridge ────────────────────────────────────────────────
// Pure Live-mode shadow/diff logic. No DOM side effects; caller owns shadow.

const BS = "\x7f";
const LEFT = "\x1b[D";
const RIGHT = "\x1b[C";
const MAX_DELETE = 512;
const MAX_INSERT = 8192;

function containsLineBreak(value) {
  return /[\r\n]/.test(value);
}

function containsNonAscii(value) {
  return /[^\x20-\x7e]/.test(value);
}

/**
 * Compute PTY bytes that transform a Live-mode shadow into the new native
 * single-line composer value while preserving the invariant that the remote
 * cursor ends at the end of the reflected line.
 *
 * Returns null when a DOM edit cannot be mapped conservatively. The caller
 * must keep the native value and fall back to Compose rather than guessing.
 */
export function computeLiveEdit(oldShadow, newValue) {
  if (typeof oldShadow !== "string" || typeof newValue !== "string") return null;
  if (oldShadow === newValue) return "";
  if (containsLineBreak(oldShadow) || containsLineBreak(newValue)) return null;

  // Fast append: no cursor movement, so committed IME / voice text is safe.
  if (newValue.startsWith(oldShadow)) {
    const appended = newValue.slice(oldShadow.length);
    return appended.length <= MAX_INSERT ? appended : null;
  }

  // Find the maximal unchanged prefix and suffix. The changed middle is one
  // localized edit relative to our invariant that the remote cursor is at end.
  let prefix = 0;
  const maxPrefix = Math.min(oldShadow.length, newValue.length);
  while (prefix < maxPrefix && oldShadow[prefix] === newValue[prefix]) prefix++;

  let suffix = 0;
  while (
    suffix < oldShadow.length - prefix &&
    suffix < newValue.length - prefix &&
    oldShadow[oldShadow.length - 1 - suffix] === newValue[newValue.length - 1 - suffix]
  ) {
    suffix++;
  }

  const oldMid = oldShadow.slice(prefix, oldShadow.length - suffix);
  const newMid = newValue.slice(prefix, newValue.length - suffix);

  if (oldMid.length > MAX_DELETE || newMid.length > MAX_INSERT) return null;

  // Terminal cursor/backspace counts are cell-oriented while JS indexing is
  // UTF-16. Appending Unicode is safe, but cursor-moving/deleting through
  // non-ASCII text is not unambiguous enough to guess. Fall back to Compose.
  if ((oldMid.length > 0 && containsNonAscii(oldMid)) || (suffix > 0 && containsNonAscii(oldShadow.slice(-suffix)))) {
    return null;
  }

  // Trailing delete: remote cursor is already after oldMid.
  if (suffix === 0 && newMid.length === 0) {
    return BS.repeat(oldMid.length);
  }

  // General localized edit. From the remote end, move left over the unchanged
  // suffix to sit immediately after oldMid; backspace oldMid; insert newMid;
  // then move right over the untouched suffix so the remote cursor ends at end.
  let seq = LEFT.repeat(suffix);
  seq += BS.repeat(oldMid.length);
  seq += newMid;
  seq += RIGHT.repeat(suffix);
  return seq;
}

export const INPUT_MODE_KEY = "mobux:inputMode";
export const INPUT_MODE_DEFAULT = "compose";

export function getStoredInputMode() {
  try {
    const value = localStorage.getItem(INPUT_MODE_KEY);
    if (value === "live" || value === "compose") return value;
  } catch (_) {}
  return INPUT_MODE_DEFAULT;
}

export function setStoredInputMode(mode) {
  const normalized = mode === "live" ? "live" : "compose";
  try {
    localStorage.setItem(INPUT_MODE_KEY, normalized);
  } catch (_) {}
  return normalized;
}
