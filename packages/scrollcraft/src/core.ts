export type ScrollAxisKeyword = "block" | "inline";
export type ScrollDirection = -1 | 0 | 1;

export type CurrentPosition = number | null;

export type DomainKind =
  | "bounded"
  | "end-unbounded"
  | "all-unbounded"
  | "circular-unbounded" // new: old circular semantics
  | "circular-end-unbounded";
export interface DomainDescriptor {
  kind: DomainKind;
  min?: number | null;
  max?: number | null;
  period?: number | null; // required > 0 when kind === "circular-unbounded" | "circular-end-unbounded"
}

export interface EngineScrollToOptions {
  immediate?: boolean;
  animator?: Animator | null;
  duration?: number | null; // ms
  easing?: string | null; // e.g., "linear", "ease", "cubic-bezier(…)"
  clamp?: boolean; // default true
  userCanInterrupt?: boolean; // default true
}

export interface FrameInfo {
  current: number | null;
  target: number;
  velocity: number;
  direction: ScrollDirection;
  dt: number;
  progress: number | null; // bounded [0,1], circular* [0,1), unbounded null
  limit: number | null; // bounded range, circular* period, unbounded null
  domain: DomainKind;
}

export interface AxisState {
  position: number;
}
export interface ScrollState {
  axes: AxisState[];
  timestamp: number;
}

export const clamp = (min: number, v: number, max: number) =>
  Math.max(min, Math.min(v, max));
export const modulo = (v: number, l: number) => ((v % l) + l) % l;

/* -------------------------------------------------------------------------- */
/*  reactive ScrollSignal                                                     */
/* -------------------------------------------------------------------------- */

export type Origin = "user" | "program" | "momentum";
export type Signal = (p: number, o: Origin) => void;

export class ScrollSignal {
  private _value = 0;
  private listeners = new Set<Signal>();
  get value() {
    return this._value;
  }
  on(fn: Signal) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  set(v: number, o: Origin) {
    if (Math.abs(v - this._value) < 0.0001) return;
    this._value = v;
    this.listeners.forEach((l) => {
      try {
        l(v, o);
      } catch {
        /* intentionally ignore */
      }
    });
  }
}

export type Authority = "host" | "engine";

export type AnimationStep = (current: number, dt: number) => number | null;

export interface ScrollEngine {
  readonly signal: ScrollSignal; // current position, reactive
  readonly driver: ScrollDriver;
  readonly domain: DomainRuntime; // DOM/native binding
  direction(): ScrollDirection;

  run(step: AnimationStep): void;
  destroy(): void;
  schedule(cb: (t?: number) => void): void;
}

export interface Scheduler {
  start(cb: (t: number) => void): number;
  stop(h?: number): void;
}

export interface Animator {
  step(current: number, dt: number, target: number): CurrentPosition;
  cancel?(): void;
}

export type SnapAnimatorData = {
  snapTarget: number;
  nearestCanonical: number;
  distToSnap: number;
  element: HTMLElement | null;
};
export interface SnapAnimator {
  step(current: number, dt: number, target: number): CurrentPosition;
  cancel?(): void;
  animator: Animator;
  data: SnapAnimatorData;
}

export type InputModule = (emit: (delta: number) => void) => () => void;

export interface DomainRuntime {
  period: number;
  setClampedTarget(delta: number, d: ScrollDirection): void;
  clampCanonical(v: number): number;

  // Target state - domain owns the target for shared access
  target: number;
  setTarget(v: number): void;

  // Position semantics - domain-aware distance and normalization
  distance(a: number, b: number): number;
  normalize(v: number): number;
  nearestEquivalent(from: number, to: number): number;
}

export interface ScrollEngineOptions {
  driver: ScrollDriver;
  scheduler: Scheduler;
}

export interface SettleInfo {
  position: number; // final written position
  target: number; // final target we eased to
  velocity: number; // last computed velocity
  direction: ScrollDirection;
  limit: number | null;
}

export interface ScrollEnginePlugin {
  name: string;
  init?(scroller: ScrollEngine): void;

  // user gesture scrolls (driver emits these only when it isn't ignoring)
  onUserScroll?(pos: number): void;

  // fires whenever the engine’s target changes (scrollTo or impulse applied)
  onTargetChange?(target: number): void;

  // fires exactly once when the animator stops (programmatic end-of-motion)
  onSettle?(info: SettleInfo): void;

  destroy?(): void;
}

export type EngineMiddleware = (engine: ScrollEngine) => () => void;

export interface ScrollWriteOptions {
  /**
   * If true, delegate to the browser's native scrolling
   * (window.scrollTo / element.scrollTo).
   *
   * If false or omitted, perform an immediate write (ignoring scroll-behavior).
   */
  native?: boolean;

  /** Used only when native === true. */
  behavior?: ScrollBehavior; // "auto" | "smooth"
}

export interface ScrollDriver {
  read(): number;
  write(pos: number, opts?: ScrollWriteOptions): void;
  limit(): number;
  domain?(): DomainDescriptor;
  onUserScroll(cb: (pos: number) => void): () => void;
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
