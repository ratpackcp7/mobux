# ADR: Build SPA Before Deploy

- Status: Accepted

## Context

`web/static/spa` is gitignored and generated. RustEmbed embeds only files
present at `cargo build` time, so the deploy workflow could produce a binary
without the SPA when it ran `cargo install` without first running the Node
build. This caused `/app` to return 404 after deployment.

## Decision

Deployment and source-checkout redeploys run `npm ci --ignore-scripts`,
`node web/build.js`, and verify `web/static/spa/index.html` before running
`cargo install`.

## Consequences

Deploys require Node/npm, but fail closed rather than shipping a binary
without the SPA.
