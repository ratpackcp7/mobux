# CI-only validation wrapper: single-tap mobile input

This branch exists only to run the repository's normal push CI on Mobux source commit `5f93c787d866b68ba01edd447d4e74dc1bf5ee76`.

The product delta under test is entirely inherited from that commit. This wrapper changes only the workflow push branch list plus this record so the ordinary `check`, `e2e`, and `fleet` jobs execute on the exact source tree.

Acceptance focus: one stationary touchstart/touchend on terminal space reveals the composer and synchronously focuses `#inputText`, while the existing mobile-input/keyboard geometry and gesture suites remain green.

This wrapper is not a product delivery branch and must not be merged into `main`.
