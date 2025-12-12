# Scrollcraft

A pnpm-powered monorepo for explorations around scrolling, interaction, and user-journey mechanics. The workspace uses Turborepo for task orchestration and TypeScript across packages.

## Packages

- `@openuji/scrollcraft` (`packages/scrollcraft`): a DOM scroll engine with programmable domains, plugins, and input modules for wheel/touch control.

## Demo App

- `apps/demo`: A Next.js demo application showcasing the scrollcraft library features.

### Demo Features

The demo provides an interactive playground for exploring scrollcraft's capabilities:

- **Domain Types**: Toggle between bounded and circular scroll domains
- **Snap Behavior**: Switch between mandatory and proximity snap modes
- **Proximity Control**: Adjustable snap proximity distance (50-500px)
- **Wave Visualization**: Real-time visual feedback showing distance to snap points
- **Debug Info**: Live scroll position and snap distance display

### Running the Demo

```bash
# Install dependencies
pnpm install

# Start development (all packages)
pnpm dev

# Or run just the demo
pnpm --filter demo dev
```

Visit `http://localhost:3000` to see the playground.

## Building Blocks

The library exports composable building blocks for custom scroll engine configurations:

```typescript
import {
  // Engine & drivers
  createEngine,
  createDOMDriver,
  createRafScheduler,

  // Input handling
  createGesturePort,
  wheelInput,
  touchInput,

  // Animators
  expAnimator,
  createSnapAnimator,

  // Domain runtimes
  createDomainRuntime,
  createCircularByBottomDomainRuntime,
} from "@openuji/scrollcraft";
```

### Custom Engine Example

```typescript
// Create a custom scroll engine with snap behavior
const driver = createDOMDriver(window, "block");
const scheduler = createRafScheduler();
const domain = createDomainRuntime(driver.limit);

const snapAnimator = createSnapAnimator({
  animator: expAnimator(0.1),
  container: document.documentElement,
  domain,
  axis: "block",
  selector: ".snap",
  type: "proximity", // or "mandatory"
  proximity: 200,
});

const engine = createEngine(driver, scheduler, domain);

const gestures = createGesturePort({
  inputs: [
    wheelInput({ element: document.body }),
    touchInput({ element: document.body, multiplier: 2 }),
  ],
  engine,
  animator: snapAnimator,
});

// Subscribe to position updates
engine.signal.on((position) => {
  console.log("Scroll position:", position);
});
```

## Getting Started

- Prerequisites: Node 18+, pnpm 9+.
- Install: `pnpm install`
- Build everything: `pnpm build`
- Development (all packages): `pnpm dev`
- Lint/types: `pnpm lint` and `pnpm check-types`

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
