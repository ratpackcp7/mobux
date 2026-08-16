# ADR — hidden-focus validation branch round 3

Date: 2026-08-16

## Decision

Use disposable branch `ci/mobux-hidden-focus-ci3-20260816` only to trigger the existing Mobux CI workflow for product commit `3709837be010acbcb7671625088021d3a3f7ce66`.

The wrapper differs from the product commit only by this ADR and the workflow `push.branches` entry naming this validation branch. It must never be merged into `main`.

## Reason

Round 2 proved the critical-path mobile suite green and exposed only stale SPA assertions that equated visual hiding with zero-sized DOM nodes. Those assertions now verify the mounted-but-invisible contract required for Android first-tap keyboard focus.

## Safety

No production service, credentials, tmux state, or Mobux product source is changed by this wrapper. Production deployment remains separately gated on successful CI and the exact product SHA.