import { ScrollSignal } from "./core";

import type {
  Scheduler,
  Animator,
  ScrollEngineOptions,
  InputModule,
  ScrollAxisKeyword,
  ScrollDriver,
  ScrollDirection,
  ScrollEnginePlugin,
  SettleInfo,
  ScrollEngine,
  DomainDescriptor,
  DomainRuntime,
  ScrollWriteOptions,
  Authority,
} from "./core";
import { createDomainRuntime } from "./domain";

export function createRafScheduler(): Scheduler {
  let handle: number | null = null;

  return {
    start(cb) {
      handle = requestAnimationFrame(cb);
      return handle;
    },

    stop() {
      if (handle !== null) {
        cancelAnimationFrame(handle);
        handle = null;
      }
    },
  };
}

export interface Axis {
  deltaKey: "deltaX" | "deltaY";
  scrollProp: "scrollLeft" | "scrollTop";
  scrollToProp: "left" | "top";
  scrollSizeProp: "scrollWidth" | "scrollHeight";
  clientSizeProp: "clientWidth" | "clientHeight";
  pos(t: Touch | MouseEvent): number;
}

export const AXIS: Record<ScrollAxisKeyword, Axis> = {
  inline: {
    deltaKey: "deltaX",
    scrollProp: "scrollLeft",
    scrollToProp: "left",
    scrollSizeProp: "scrollWidth",
    clientSizeProp: "clientWidth",
    pos: (p) => p.clientX,
  },
  block: {
    deltaKey: "deltaY",
    scrollProp: "scrollTop",
    scrollToProp: "top",
    scrollSizeProp: "scrollHeight",
    clientSizeProp: "clientHeight",
    pos: (p) => p.clientY,
  },
} as const;

export interface WheelInputOpts {
  element: HTMLElement;
  axis?: ScrollAxisKeyword;
  multiplier?: number;
  allowNestedScroll?: boolean;
}

export const wheelInput = ({
  element,
  axis = "block",
  multiplier = 1,
}: WheelInputOpts): InputModule => {
  const ax = AXIS[axis];
  const LINE_HEIGHT = 40;
  return (emit) => {
    const h = (e: WheelEvent) => {
      const mult =
        e.deltaMode === 1
          ? LINE_HEIGHT
          : e.deltaMode === 2
            ? axis === "inline"
              ? window.innerWidth
              : window.innerHeight
            : 1;
      const delta = e[ax.deltaKey];
      emit(delta * mult * multiplier);
      if (e.cancelable) e.preventDefault();
    };
    element.addEventListener("wheel", h, { passive: false });
    return () => element.removeEventListener("wheel", h);
  };
};

export interface TouchInputOpts {
  element: HTMLElement;
  axis?: ScrollAxisKeyword;
  multiplier?: number;
  allowNestedScroll?: boolean;
}
export const touchInput = ({
  element,
  axis = "block",
  multiplier = 1,
}: TouchInputOpts): InputModule => {
  const ax = AXIS[axis];
  return (emit) => {
    let last = 0;
    const start = (e: TouchEvent) => {
      const p = e.touches[0] ?? false;
      if (!p) return;
      last = ax.pos(p);
    };
    const move = (e: TouchEvent) => {
      const p = e.touches[0] ?? false;
      if (!p) return;
      const dirP = ax.pos(p);
      const d = -(dirP - last) * multiplier;
      last = dirP;
      emit(d);
      if (e.cancelable) e.preventDefault();
    };

    element.addEventListener("touchstart", start, { passive: false });
    element.addEventListener("touchmove", move, { passive: false });

    return () => {
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
    };
  };
};
export function createDOMDriver(
  target: Window | HTMLElement,
  axisKeyword: ScrollAxisKeyword,
): ScrollDriver {
  const ax = AXIS[axisKeyword];
  const el: HTMLElement =
    target === window
      ? (document.scrollingElement as HTMLElement | null) ||
        document.documentElement
      : (target as HTMLElement);

  let ignore = false;

  const read = () => el[ax.scrollProp] as number;

  const write = (pos: number, opts?: ScrollWriteOptions) => {
    ignore = true;
    const useNative = opts?.native ?? false;
    const behavior = opts?.behavior ?? "auto";

    if (useNative) {
      if (target === window) {
        window.scrollTo({ [ax.scrollToProp]: pos, behavior });
      } else {
        // Safe check for scrollTo availability
        if ("scrollTo" in el && typeof el.scrollTo === "function") {
          el.scrollTo({ [ax.scrollToProp]: pos, behavior });
        } else {
          el[ax.scrollProp] = pos;
        }
      }
    } else {
      if (target === window) {
        window.scrollTo({ [ax.scrollToProp]: pos, behavior: "instant" });
      } else {
        el[ax.scrollProp] = pos;
      }
    }
  };

  const onUserScroll = (cb: (n: number) => void) => {
    const h = () => {
      if (ignore) {
        ignore = false;
        return;
      }
      cb(read());
    };
    (target === window ? window : el).addEventListener("scroll", h, {
      passive: true,
    });
    return () =>
      (target === window ? window : el).removeEventListener("scroll", h);
  };
  const limit = () =>
    (el[ax.scrollSizeProp] as number) - (el[ax.clientSizeProp] as number);
  const domain = (): DomainDescriptor => ({
    kind: "bounded",
    min: 0,
    max: Math.max(0, limit()),
  });
  return {
    read,
    write,
    limit,
    domain,
    onUserScroll,
  };
}

export class ScrollEngineDOM implements ScrollEngine {
  readonly driver: ScrollDriver;
  private animator: Animator;
  private scheduler: Scheduler;
  private inputs: Array<(emit: (d: number) => void) => () => void>;
  private plugins: ScrollEnginePlugin[];
  private gestureAuthority: Authority = "engine";
  private commandAuthority: Authority = "engine";

  private readonly domain: DomainRuntime; // <— here

  // reactive state
  private signal = new ScrollSignal();
  private destroyers: Array<() => void> = [];

  // motion state
  private target = 0;
  private motionValue = 0;
  private impulse = 0;
  private running = false;
  private prev = 0;

  // public-ish telemetry
  velocity = 0;
  direction: ScrollDirection = 0;

  // lifecycle guard
  private initialized = false;

  constructor({
    driver,
    inputs,
    animator,
    scheduler,
    plugins = [],
    gestureAuthority = "engine",
    commandAuthority = "engine",
  }: ScrollEngineOptions) {
    // NOTE: no listeners wired here
    this.driver = driver;
    this.inputs = inputs;
    this.animator = animator;
    this.scheduler = scheduler;
    this.plugins = plugins;
    this.gestureAuthority = gestureAuthority;
    this.commandAuthority = commandAuthority;

    this.domain = createDomainRuntime(
      () => this.driver.domain?.(),
      () => this.driver.limit(),
    );
  }

  /** Seed BEFORE init() — no jump. */
  seedInitialPosition(pos: number) {
    const { canonical } = this.domain.mapPosition(pos, pos);
    this.driver.write(canonical);
    this.signal.set(canonical, "program");
    this.motionValue = canonical;
    this.target = canonical;
    this.prev = canonical;
    this.velocity = 0;
    this.direction = 0;
  }

  /** Wire listeners, inputs, plugins, signals. Call exactly once. */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    // 1) user scroll listener
    this.destroyers.push(
      this.driver.onUserScroll((p) => {
        const { canonical, target } = this.domain.projectTarget(
          p,
          this.motionValue,
        );

        this.signal.set(canonical, "user");
        this.motionValue = target;
        this.target = target;
        this.plugins.forEach((pl) => pl.onUserScroll?.(p));
      }),
    );

    // 2) plugins
    this.plugins.forEach((pl) => pl.init?.(this));

    // 3) inputs
    if (this.gestureAuthority === "engine") {
      this.inputs.forEach((mod) =>
        this.destroyers.push(mod((d) => this.applyImpulse(d))),
      );
    }

    // 4) velocity/direction from signal
    this.signal.on((p) => {
      const delta = this.domain.delta(p, this.prev);
      this.velocity = delta;
      this.direction = Math.sign(delta) as ScrollDirection;
      this.prev = p;
    });
  }

  destroy() {
    this.scheduler.stop();
    this.destroyers.forEach((fn) => fn());
    this.plugins.forEach((pl) => pl.destroy?.());
    this.destroyers = [];
  }

  scrollTo(value: number, immediate = false) {
    const { target, canonical } = this.domain.projectTarget(
      value,
      this.motionValue,
    );

    // BROWSER-OWNED PROGRAMMATIC SCROLL → delegate to native behavior
    if (this.commandAuthority === "host") {
      const behavior: ScrollBehavior = immediate ? "auto" : "smooth";

      // Engine doesn't animate; browser does.
      this.driver.write(canonical, {
        native: true,
        behavior,
      });

      // Still let plugins know the target changed (for WAAPI, effects, etc.)
      this.plugins.forEach((p) => p.onTargetChange?.(canonical));
      return;
    }

    if (immediate) {
      this.target = target;
      const written = this.applyPosition(canonical);

      this.plugins.forEach((p) => p.onTargetChange?.(canonical));
      this.plugins.forEach((p) =>
        p.onSettle?.({
          position: written,
          target: this.domain.canonicalOf(target),
          velocity: this.velocity,
          direction: this.direction,
          limit: this.domain.limit,
        }),
      );
      return;
    }

    this.target = target;
    this.plugins.forEach((p) => p.onTargetChange?.(canonical));
    this.startLoop();
  }

  applyImpulse(d: number) {
    this.impulse += d;
    this.startLoop();
  }

  schedule(cb: (t?: number) => void): void {
    this.scheduler.start(cb);
  }

  /* ---------- internals ---------- */

  private applyPosition(next: number) {
    const { canonical, logical } = this.domain.mapPosition(
      next,
      this.motionValue,
    );

    this.driver.write(canonical);
    this.signal.set(canonical, "program");
    this.motionValue = logical;

    return canonical;
  }

  private startLoop() {
    if (this.running) return;
    this.running = true;
    let last = 0;

    const step = (now: number) => {
      if (last === 0) {
        last = now;
        this.scheduler.start(step);
        return;
      }
      const dt = now - last;
      last = now;

      if (this.impulse !== 0) {
        const { target, canonical } = this.domain.applyImpulse(
          this.target,
          this.impulse,
          this.motionValue,
          this.direction,
        );
        this.target = target;
        this.impulse = 0;
        this.plugins.forEach((p) => p.onTargetChange?.(canonical));
      }

      const cur = this.motionValue;
      const next = this.animator.step(cur, this.target, dt);

      if (next === null) {
        this.target = Math.round(this.motionValue);
        const written = this.applyPosition(this.target);
        const canonicalTarget = this.domain.canonicalOf(this.target);

        this.running = false;
        this.scheduler.stop();

        const info: SettleInfo = {
          position: written,
          target: canonicalTarget,
          velocity: this.velocity,
          direction: this.direction,
          limit: this.domain.limit,
        };
        this.plugins.forEach((p) => p.onSettle?.(info));
        return;
      }

      this.applyPosition(next);
      this.scheduler.start(step);
    };

    this.scheduler.start(step);
  }
}

export const expAnimator = (lerp = 0.1): Animator => {
  const freq = 1 / 60;
  const k = -Math.log(1 - lerp) / freq;
  return {
    step: (c, t, dt) => {
      const alpha = 1 - Math.exp((-k * dt) / 1000);
      const next = c + (t - c) * alpha;
      return Math.abs(t - next) < 0.25 ? null : next;
    },
  };
};

export type SpotAninmation = {
  from: number;
  to: number;
  animation: Animation;
};
