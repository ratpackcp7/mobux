# ADR — hidden-focus validation branch round 2

Date: 2026-08-16

## Decision

Use disposable branch `ci/mobux-hidden-focus-ci2-20260816` only to trigger the existing Mobux CI workflow for product commit `a36a458fc8cb8dfefe84016a05449c2ab6dda450`.

The wrapper differs from the product commit only by this ADR and the workflow `push.branches` entry naming this validation branch. It must never be merged into `main`.

## Reason

Round 1 exposed a timing race in the mobile mode-switch acceptance test. The product assertion was retained and strengthened to poll the real tmux condition. This round validates the focusable-hidden-composer repair plus that deterministic test hardening.

## Safety

No production service, credentials, tmux state, or Mobux product source is changed by this wrapper. Production deployment remains separately gated on successful CI and the exact product SHA.