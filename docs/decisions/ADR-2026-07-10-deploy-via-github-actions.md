# ADR-2026-07-10: Deploy via GitHub Actions, Remove In-App Update Panel

## Status

Accepted

## Context

The mobux-full-screen fork previously included an in-app "Software update" panel in Settings that checked crates.io for new releases. This was problematic because it could accidentally overwrite the fork's custom build with upstream mvhenten/mobux's published release, causing unintended overrides of fork-specific changes.

## Decision

Remove the in-app Update.jsx component and update panel from Settings. Replace update distribution with a GitHub Actions workflow (`.github/workflows/deploy.yml`) that runs on every merge to main, making deployment deterministic and fork-controlled.

## Why

1. **Safety**: Eliminates the risk of accidental upstream version overwrites
2. **Control**: Deploys happen only when code is explicitly merged to main
3. **Simplicity**: GitHub Actions-based deploys are more standard in the ecosystem
4. **Fork-friendly**: Ensures fork-specific customizations are never overwritten by upstream releases

## Tradeoffs

- **Improves**: Deploy safety and predictability; eliminates surprise version overwrites
- **Gets worse**: Users no longer see in-app notifications of available updates (alternative: link to GitHub releases page in About)
- **Could break**: Any tooling that relied on the in-app update panel; none identified currently

## Verification

```bash
# Confirm component is removed
ls -la web/spa/src/components/settings/Update.jsx 2>&1 | grep "No such file"

# Confirm Settings no longer imports Update
grep -c "Update" web/spa/src/pages/Settings.jsx || echo "0 matches"

# Confirm deploy workflow exists
test -f .github/workflows/deploy.yml && echo "Deploy workflow exists"
```

## Rollback

If in-app updates are needed in the future:

1. Restore `web/spa/src/components/settings/Update.jsx` from git history
2. Re-add the import and component reference in `web/spa/src/pages/Settings.jsx`
3. Test the Settings page to confirm the update panel renders

## Related Files

- `.github/workflows/deploy.yml` — deployment automation
- `web/spa/src/pages/Settings.jsx` — Settings page (update component removed)
- `web/spa/src/components/settings/Update.jsx` — removed component

## Related Services / Ports

- GitHub Actions CI/CD (no local ports)
