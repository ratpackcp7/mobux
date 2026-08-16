const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Files generated *from* this hash must not feed back into it. Source maps are
// diagnostic-only and intentionally excluded so toggling sourcemap output does
// not make a client build look different. Android install/association artifacts
// are generated outside the normal web build and are not part of the running
// browser module graph.
function shouldInclude(rel) {
  const normalized = rel.split(path.sep).join('/');
  if (normalized === 'build-info.json' || normalized === 'build-info.js') return false;
  if (normalized.endsWith('.map')) return false;
  if (normalized === 'install' || normalized.startsWith('install/')) return false;
  if (normalized === '.well-known' || normalized.startsWith('.well-known/')) return false;
  return true;
}

function listClientFiles(root) {
  const out = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs);
      if (!shouldInclude(rel)) continue;
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) out.push(rel.split(path.sep).join('/'));
    }
  }
  if (fs.existsSync(root)) walk(root);
  return out.sort();
}

function computeBuildHashFromEntries(entries) {
  const hash = crypto.createHash('sha256');
  const ordered = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  for (const entry of ordered) {
    const bytes = Buffer.isBuffer(entry.bytes) ? entry.bytes : Buffer.from(entry.bytes);
    // Delimit path and contents so concatenation boundaries cannot collide.
    hash.update(entry.path, 'utf8');
    hash.update('\0');
    hash.update(String(bytes.length), 'utf8');
    hash.update('\0');
    hash.update(bytes);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 8);
}

function computeStaticBuildHash(staticRoot) {
  const entries = listClientFiles(staticRoot).map((rel) => ({
    path: rel,
    bytes: fs.readFileSync(path.join(staticRoot, rel)),
  }));
  return computeBuildHashFromEntries(entries);
}

module.exports = {
  computeBuildHashFromEntries,
  computeStaticBuildHash,
  listClientFiles,
  shouldInclude,
};
