# Scrollcraft

A pnpm-powered monorepo for explorations around scrolling, interaction, and user-journey mechanics. The workspace uses Turborepo for task orchestration and TypeScript across packages.

## Packages

- `@openuji/scrollcraft` (`packages/scrollcraft`): a DOM scroll engine with programmable domains, plugins, and input modules for wheel/touch control.

## Getting Started

- Prerequisites: Node 18+, pnpm 9+.
- Install: `pnpm install`
- Build everything: `pnpm build`
- Development (all packages): `pnpm dev`
- Lint/types: `pnpm lint` and `pnpm check-types`
- Format Markdown/TS: `pnpm format`

## Working on Scrollcraft

- Build only Scrollcraft: `pnpm --filter @openuji/scrollcraft build`
- Watch mode while iterating: `pnpm --filter @openuji/scrollcraft dev`
- Run Playwright tests: `pnpm --filter @openuji/scrollcraft test` (requires Playwright browsers; run `pnpm exec playwright install` if needed)
- Type-check: `pnpm --filter @openuji/scrollcraft check-types`

## Repository Notes

- Tasks are orchestrated through `turbo.json`; package-level scripts live alongside each package.
- Builds use `tsup` for bundling and emit ESM with type declarations.
- Husky/lint-staged are configured for pre-commit hygiene; install hooks with `pnpm prepare`.

## Contributing

Issues and improvements are welcome. Keep changes scoped per package, and prefer `pnpm --filter` when running scripts to avoid unnecessary work across the monorepo.
