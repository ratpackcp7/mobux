# ADR — Final temporary feature-branch CI validation

Date: 2026-08-16
Status: Accepted for disposable validation branch only

## Context

The Mobux mobile input/layout delivery branch is based on upstream/main while the user's fork main intentionally diverges. The configured Bridge GitHub connector cannot create a pull request in upstream owner `mvhenten`, this workflow has no manual-dispatch trigger, and a PR against the divergent fork main is unmergeable. Local Bridge execution is not authoritative for the full acceptance matrix because Rust is outside the execution sandbox and Vite WebAssembly reaches the sandbox memory cap.

CI round one exposed the no-client-persistent-storage invariant; delivery commit `9421f9b` moved `mobile_input_mode` to the existing server-held preferences row and round two proved the full `check` job plus the new critical-path/mobile-input step green. Round two's only remaining failure was existing smoke compatibility: the new ribbon was collapsed outside keyboard-open and reader bottom re-pin had lost its same-task resize notification. Delivery commit `58779c988e38514bdb02f3a30aad0d52e6b027d0` fixes both without weakening smoke tests.

## Decision

On disposable branch `ci/mobux-mobile-input-ci3-20260816` only, extend `.github/workflows/ci.yml` so its existing push filter also matches this exact validation branch. Change no jobs, permissions, test commands, secrets, runners, deploy/release behavior, or feature source.

The branch starts at exact delivery commit `58779c988e38514bdb02f3a30aad0d52e6b027d0`. The real feature branch remains unchanged by this validation-only wrapper.

## Safety

- Never merge this validation branch into main or the feature branch.
- No live Mobux service, port `:5151`, deploy, credential, or permission changes.
- Treat any CI failure as a product/test defect on the delivery branch; do not weaken CI.

## Acceptance

Existing `check`, `e2e`, and `fleet` jobs must all complete successfully. The validation branch's feature source must be byte-identical to delivery commit `58779c9` except for this ADR and the one branch-filter line in `ci.yml`.
