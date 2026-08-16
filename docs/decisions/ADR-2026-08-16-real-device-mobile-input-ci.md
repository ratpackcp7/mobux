# ADR — Real-device mobile input CI validation

## Context
The physical Pixel acceptance screenshot for Mobux delivery SHA `58779c9` exposed three failures not reproduced by the previous desktop/headless assumptions: a one-row xterm blank band above the composer, keyboard-open detection failing when Android shrinks `innerHeight` together with `visualViewport`, and Chrome/Gboard showing the key/card/location autofill accessory.

The actual repair lives in delivery commit `27bd8b253f739a11defbba174e12044bea80bc19` on branch `fix/mobux-mobile-input-device-fix-20260816`.

The configured GitHub connector cannot create PRs against the upstream `mvhenten/mobux` owner, and the fork `main` is intentionally divergent. Existing Mobux CI only runs on `main` pushes or `main` PRs.

## Decision
Use this disposable validation branch only to trigger the existing full CI on the exact delivery source. This branch differs from delivery commit `27bd8b2` only by this ADR and the single workflow branch-filter entry.

No feature/source/test file may differ from delivery commit `27bd8b2` in the validation wrapper.

## Acceptance
The existing `CI` workflow must finish green for `check`, `e2e`, and `fleet`. The validation branch is never merged. Production `:5151` is not touched by CI. After green CI, deploy the exact delivery worktree through the documented `cargo install --path ... --locked` path and restart only `mobux.service`, then use the physical Pixel screenshot as the final acceptance authority.
