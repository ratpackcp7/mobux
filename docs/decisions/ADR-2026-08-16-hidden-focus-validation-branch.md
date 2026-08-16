# ADR — hidden-focus validation branch

Date: 2026-08-16

## Decision

Use disposable branch `ci/mobux-hidden-focus-ci-20260816` only to trigger the existing Mobux CI workflow for product commit `a93b2dd9a2593cb615cd24633b06e6ba7806d246`.

The wrapper may differ from the product commit only by this ADR and the workflow `push.branches` entry that names this validation branch. It is never a delivery branch and must never be merged into `main`.

## Reason

The configured GitHub connector cannot run Mobux CI directly against the upstream owner, while the fork's `main` is intentionally divergent. This wrapper lets the existing `check`, `e2e`, and `fleet` jobs validate the exact product source without merging or rebasing unrelated history.

## Safety

No production service, tmux session, credentials, or Mobux source file is changed by this wrapper. Production deployment remains separately gated on successful CI and the exact product SHA.