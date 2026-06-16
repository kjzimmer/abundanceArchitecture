# ADR-0002: Initial scaffold commit pushed directly to main

- Status: Accepted
- Date: 2026-06-16

## Context

The shared tech stack workflow (`docs/shared-tech-stack-v1.1.md`) requires feature
branches and pull requests for all work, with no direct pushes to `main`. The
`kjzimmer/abundanceArchitecture` GitHub repo was created but had no commits and no
default branch, so there was no `main` to branch from and no base ref a pull request
could target.

## Decision

Push the initial project scaffold (this commit) directly to `main` to bootstrap the
repository. Every commit after this one follows the normal feature-branch + PR
workflow.

## Consequences

This is a one-time exception. If `main` ever needs to be rebuilt or this history is
unclear to a future reader, this ADR explains why the very first commit has no
associated pull request.
