# ADR — Disposable dev-runtime validation for mobile input branch

Date: 2026-08-16
Status: Accepted for this CI-only branch

## Context

Delivery commit `58779c988e38514bdb02f3a30aad0d52e6b027d0` has passed the repository's full normal CI (`check`, `e2e`, `fleet`) through a disposable wrapper branch. The Mobux mobile input SPEC additionally requires proof that the feature can run through the repository's real `dev-up` path on backend `:5152` plus Vite `:5173`, while production `:5151` remains untouched.

The acerserver Bridge sandbox intentionally cannot execute the host Rust toolchain, so starting this dev runtime locally would require widening execution authority or installing/copying toolchains solely for validation. GitHub's disposable Ubuntu runner already provides the isolated toolchain used by successful CI.

## Decision

Add a temporary workflow on branch `ci/mobux-mobile-input-dev-runtime-20260816` only. It checks out the exact delivery source, installs the same Rust/Node dependencies as normal CI plus `lsof`, runs `make dev-up` with isolated runner-local data/log directories, verifies listeners on `127.0.0.1:5152` and `127.0.0.1:5173`, probes the backend and Vite SPA over HTTP(S), prints the exact runner-local dev URLs, and always runs `make dev-down`.

This workflow and ADR are validation-only and must never be merged into the delivery branch or main.

## Safety

- Runner-local ports only; no acerserver process or port is touched.
- No production deploy/restart and no `:5151` command.
- No repository secret is required; test credentials are fixed disposable values.
- Cleanup runs with `if: always()` and uses the repo's port-keyed `dev-down` target.

## Acceptance

The workflow must complete successfully with both `:5152` and `:5173` listening, successful backend/SPA probes, and cleanup showing both listeners stopped. The backend probe must detect whether the dev target is serving HTTP or HTTPS instead of assuming a scheme; the first validation run already proved both listeners started but an HTTPS-only probe returned an empty reply. Feature source remains exact delivery commit `58779c9`; follow-up validation commits may change only this ADR/workflow.
