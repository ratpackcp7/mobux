# ADR — Temporary feature-branch CI validation

Date: 2026-08-16
Status: Accepted for disposable validation branch only

## Context

The Mobux mobile input/layout candidate is based exactly on upstream/main `9befda69e954f24bb4a7812f7bf7f63880c51b27`, while the user's fork `main` intentionally diverges from upstream. The existing GitHub Actions CI runs on pushes to `main` and pull requests targeting `main`; a CI-only PR against the divergent fork main is unmergeable and therefore does not produce the pull-request merge ref/check run. The Bridge GitHub connector is intentionally scoped to the configured `ratpackcp7` owner and cannot create the real upstream `mvhenten/mobux` pull request. Manual workflow dispatch is not enabled.

The local Bridge sandbox cannot provide authoritative full acceptance for this feature: Rust is intentionally hidden from its execution sandbox and the frontend Vite build reaches a WebAssembly memory cap. GitHub CI already installs Rust, Node, Chromium, and tmux and runs the repository's cargo and browser acceptance gates.

## Decision

On the disposable branch `ci/mobux-mobile-input-ci-validation-20260816` only, extend `.github/workflows/ci.yml` so its existing `push.branches` filter also matches this exact validation branch. Do not alter jobs, permissions, test commands, secrets, runners, or deployment behavior.

This branch starts at the exact feature commit `9995781ae8cfcf69f636193e64e2ec6dfca42fe7`. The workflow-only validation change exists solely to obtain CI evidence for that feature source. The real feature branch `feat/mobux-mobile-input-layout-v2` remains unchanged and is the delivery branch.

## Safety

- Never merge the validation branch into `main` or the feature branch.
- No production service or `:5151` change.
- No deploy workflow or release setting change.
- No credential or permission change.
- After CI evidence is collected, the validation branch/worktree may be removed independently; the feature commit remains unchanged.

## Acceptance

The existing `check`, `e2e`, and `fleet` CI jobs must run from the validation branch. The relevant source files in the validation branch must be byte-identical to feature commit `9995781` except for this ADR and the one branch-filter line in `ci.yml`.
