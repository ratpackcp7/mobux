# ADR — Temporary feature-branch CI validation

Date: 2026-08-16
Status: Accepted for disposable validation branch only

## Context

The Mobux mobile input/layout delivery branch is based on upstream/main rather than the intentionally divergent fork main. The configured Bridge GitHub connector cannot create a pull request in the upstream `mvhenten` owner, and this repository's CI workflow has no manual-dispatch trigger. A fork PR against divergent `main` is unmergeable and does not produce the required pull-request CI ref.

Local Bridge execution is also not authoritative for the full acceptance matrix: Rust is intentionally outside the execution sandbox, and the frontend Vite build reaches the sandbox's WebAssembly memory cap. GitHub CI provides the repository's normal Rust, frontend, Chromium, tmux, smoke, and fleet environment.

CI round one on the previous disposable validation branch correctly exposed the repository invariant forbidding browser-local persistent state. Delivery commit `9421f9b90e41073048e0aae99c1831481f2a25e4` fixes that by moving `mobile_input_mode` into the existing server-held `/api/settings/preferences` row.

## Decision

On disposable branch `ci/mobux-mobile-input-ci2-20260816` only, extend `.github/workflows/ci.yml` so the existing `push.branches` filter also matches this exact validation branch. Change no jobs, permissions, commands, secrets, runners, deploy/release behavior, or feature source.

The branch starts at exact delivery commit `9421f9b90e41073048e0aae99c1831481f2a25e4`. The real feature branch remains unchanged by this validation-only workflow trigger.

## Safety

- Never merge this validation branch into main or the feature branch.
- No production service, port `:5151`, deploy, credential, or permission changes.
- Treat any CI failure as a product/test defect to fix on the delivery branch; do not weaken CI.

## Acceptance

Existing CI jobs must execute from this branch. Feature source in the validation branch must be byte-identical to delivery commit `9421f9b` except for this ADR and the one branch-filter line in `ci.yml`.
