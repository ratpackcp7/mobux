# ADR — Real-device mobile input CI validation round 2

## Context
Round-one validation of delivery commit `27bd8b2` proved the new physical Pixel/TWA path and row-fit tests, but an older smoke test exposed a compatibility gap: the keyboard detector needed to support both Android viewport models simultaneously.

The corrected delivery commit is `086eda22c5dfacd19f59f62dd40f939690357ccc` on `fix/mobux-mobile-input-device-fix-20260816`.

## Decision
Use this disposable branch only to trigger the existing full Mobux CI. It differs from delivery commit `086eda2` only by this ADR and one CI push-branch filter. It is never merged.

## Acceptance
`check`, `e2e`, and `fleet` must all pass. Production `:5151` remains untouched until that happens. After green CI, deploy exact delivery commit `086eda2` through the documented cargo-install path and restart only `mobux.service`, then verify on the physical Pixel.
