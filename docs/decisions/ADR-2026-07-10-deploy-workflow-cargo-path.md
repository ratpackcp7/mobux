# ADR-2026-07-10: Pin absolute paths in the deploy workflow

## Status

Accepted

## Context

`.github/workflows/deploy.yml` builds and installs mobux on every push to
`main`, via a self-hosted runner (label `acerserver`) registered on the box
that also runs the `mobux` systemd `--user` service. acerserver already
hosts several other self-hosted runners under `~/projects/github-runners/*`
managed by an existing launcher; the new runner (`~/actions-runner`) doesn't
reliably inherit `~/.cargo/bin` on `PATH` in job steps. Both a systemd
`Environment=PATH=...` override on the runner's unit and the runner's own
`.env` file (its documented mechanism for injecting job-step env vars) failed
to fix it — the first deploy run after merging the workflow failed with
`cargo: command not found`.

## Decision

Reference `~/.cargo/bin/cargo` and `/usr/bin/systemctl` by absolute path in
the workflow's `run:` steps instead of depending on `PATH`.

## Why

Debugging exactly why this runner's job-step PATH differs from its parent
process PATH would take longer than just not depending on PATH at all.
Absolute paths are a one-line fix and are correct regardless of how the
runner ends up being launched/supervised on this box.

## Tradeoffs

- **Improves**: deploy reliability; no dependency on runner launch method.
- **Gets worse**: nothing — `~/.cargo/bin` and `/usr/bin/systemctl` are the
  same locations DEPLOY.md already documents for manual redeploys.
- **Could break**: if `cargo` is ever installed to a non-default `--root` on
  this host, this path would need updating too (same constraint DEPLOY.md's
  systemd unit `PATH=` already has).

## Verification

```bash
gh run rerun <deploy-run-id> --repo ratpackcp7/mobux --failed
gh run view <deploy-run-id> --repo ratpackcp7/mobux --json conclusion
curl -fsSk -u "$MOBUX_AUTH_USER:$MOBUX_PIN" https://localhost:5151/api/identify
```

## Rollback

Revert to `cargo install ...` / `systemctl --user restart mobux` (bare
commands) if the runner's PATH issue gets fixed at the launcher level.

## Related Files

- `.github/workflows/deploy.yml`

## Related Services / Ports

- service: mobux (systemd --user)
- service: actions-runner (self-hosted GitHub Actions runner, label acerserver)
- port: 5151
- hostname: acerserver
