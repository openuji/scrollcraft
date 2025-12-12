# @openuji/scrollcraft

**Scrolling Orchestrator** — A small DOM scroll engine for cases where native scrolling is too limiting. It lets you plug in your own inputs, easing, and domain semantics (bounded, unbounded, circular, or hybrid) while still playing nicely with the browser.

## Why

- Programmable domains: bounded, end-unbounded, all-unbounded, circular, or circular-end-unbounded semantics.
- Decoupled pieces: driver (how to read/write), inputs (wheel/touch), scheduler (raf), and animator (e.g., exponential).
- Middleware-friendly: compose plugins such as sessionStorage persistence without wiring everything by hand.
- Host vs engine authority: opt into native `scrollTo({behavior: "smooth"})` for programmatic scrolls while keeping engine control for user inputs.

## Installation

```sh
pnpm add @openuji/scrollcraft
```

## Quick start (DOM window)

```ts
import { defaultScrollEngine } from "@openuji/scrollcraft";

const engine = defaultScrollEngine(); // window driver, wheel + touch inputs
engine.init();

// Programmatic scrolls
engine.scrollTo(480); // animated
engine.scrollTo(0, true); // immediate jump

// Cleanup when you tear down the page/app
engine.destroy();
```

`defaultScrollEngine` wires a DOM driver on the window, wheel/touch inputs on `document.body`, a requestAnimationFrame scheduler, exponential animator, and sessionStorage restoration middleware (`restoreMode: "immediate"`).

## Custom build

For more control, use the building blocks directly:

```ts
import {
  createDOMDriver,
  createRafScheduler,
  createEngine,
  createGesturePort,
  createCommandPort,
  createDomainRuntime,
  wheelInput,
  touchInput,
  expAnimator,
} from "@openuji/scrollcraft";

const target = document.querySelector<HTMLElement>("#scroller")!;

// Create core components
const driver = createDOMDriver(target, "block"); // or "inline"
const scheduler = createRafScheduler();
const domain = createDomainRuntime(driver.limit);

// Build the engine
const engine = createEngine(driver, scheduler, domain);

// Wire up input handling (wheel + touch → impulses)
const gestures = createGesturePort({
  inputs: [
    wheelInput({ element: target, multiplier: 0.8 }),
    touchInput({ element: target, multiplier: 2 }),
  ],
  engine,
  animator: expAnimator(0.1),
});

// Wire up programmatic scroll commands
const command = createCommandPort({ engine, animator: expAnimator(0.15) });

// Start everything
gestures.init();
command.scrollTo(480); // animated scroll
```

### Domains

The DOM driver defaults to a bounded domain `[0, scrollSize - clientSize]`. To change semantics, expose a `domain()` method on your driver that returns:

- `bounded` with `min`/`max`
- `end-unbounded` or `all-unbounded`
- `circular-unbounded` (wraps both ends) or `circular-end-unbounded` (bounded start, circular end) with `period`

For a ready-made loop, use `circularScrollEngine()` which wraps the DOM driver in a circular-end-unbounded domain.

### API highlights

- `engine.init()` / `engine.destroy()`
- `engine.scrollTo(value, immediate?)`
- `engine.applyImpulse(delta)` (from inputs)
- `engine.seedInitialPosition(pos)` (before `init` to avoid jumps)
- `engine.getDomain()` / `engine.getPosition()`
- `engine.schedule(cb)` to piggyback on the internal scheduler

Helpers:

- `createDOMDriver(target, axis)` to read/write scroll positions.
- `wheelInput` and `touchInput` to convert events into impulses.
- `createRafScheduler` for animation frames.
- `expAnimator(lerp)` for exponential easing with automatic settle detection.
- `sessionStoragePersistence` middleware to save/restore scroll position; options include custom key, `restoreMode` (`immediate` | `afterLayout`), layout timeout, and opt-in hooks.

## Development & testing

- Build: `pnpm --filter @openuji/scrollcraft build`
- Watch: `pnpm --filter @openuji/scrollcraft dev`
- Lint: `pnpm --filter @openuji/scrollcraft lint`
- Type-check: `pnpm --filter @openuji/scrollcraft check-types`
- Tests (Playwright): `pnpm --filter @openuji/scrollcraft test` — ensure Playwright browsers are installed (`pnpm exec playwright install`).
