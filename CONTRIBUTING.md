# Contributing

Thanks for your interest in texmorph!

## Branches

- `main` contains the released source and documentation.
- `dev` is where development happens. It contains the test suites, fixtures, tooling and design records. Open pull requests against `dev`.

## Setup

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm docs:dev
```

On `dev`, `pnpm ci:local` runs lint, the unit and browser test suites, size budgets and package checks.

## Guidelines

- Keep pull requests focused, and add a changeset (`pnpm changeset`) for user-facing changes.
- `@texmorph/core` and `@texmorph/dom` must never own a clock: no `requestAnimationFrame`, timers or wall-clock reads.
- Write code comments only where the code is not self-explanatory, in English.
- Public API changes need an issue first; see [Versioning and stability](docs/guide/stability.md).

## Reporting bugs

Open an issue with a minimal reproduction: the two formulas, the renderer and its version, the browser, and `morph.diagnostics`.
