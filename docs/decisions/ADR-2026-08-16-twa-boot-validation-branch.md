# ADR — TWA boot validation branch

Date: 2026-08-16

## Decision
Temporarily allow CI workflow execution on `ci/mobux-twa-boot-ci-20260816` so the exact product commit `ea743e55e00ae5561913949d21d6bfe6e2273020` can run the repository's normal `check`, `e2e`, and `fleet` jobs without merging into the fork's divergent `main`.

## Scope
This validation branch differs from the product commit only by this ADR and the single workflow branch-filter entry. It is never a delivery branch and must not be merged into `main`.

## Rationale
The product branch cannot currently produce a usable PR test ref against the fork's divergent `main`, while upstream-owner PR creation is outside the configured connector namespace. Push-trigger validation preserves the existing repository CI as the acceptance authority without rebasing, force-merging, or altering product source.
