import { Animator, DomainRuntime, SnapAnimator } from "./core";
import { ScrollAxisKeyword } from "./core";

const EPS = 0.25;
export const expAnimator = (lerp = 0.1): Animator => {
  const freq = 1 / 60;
  const k = -Math.log(1 - lerp) / freq;
  const animator: Animator = {
    step(c: number, dt: number, target: number) {
      const alpha = 1 - Math.exp((-k * dt) / 1000);
      const next = c + (target - c) * alpha;
      return Math.abs(target - next) < EPS ? null : next;
    },
  };
  return animator;
};

// === SNAP ANIMATOR =======================================================

export type SnapAlign = "start" | "center" | "end";
export type SnapType = "mandatory" | "proximity";

export interface SnapAnimatorOptions {
  animator: Animator;
  container: HTMLElement;
  domain: DomainRuntime; // domain provides distance semantics
  axis?: ScrollAxisKeyword; // "block" | "inline"
  selector?: string; // which children are snap points, default: ".snap"
  defaultAlign?: SnapAlign; // fallback when no per-element align is set
  type?: SnapType; // "mandatory" or "proximity"
  proximity?: number; // px radius for proximity snapping
  lerp?: number; // base easing strength (like expAnimator)
}

/**
 * DOM-aware animator that snaps to elements like:
 *   <section class="snap" style="scroll-snap-align:center">
 *   <section class="snap" data-snap-align="end">
 *
 * It eases towards animator.target, but as it comes to rest it
 * retargets to the nearest snap point according to `type`.
 */
export const createSnapAnimator = (opts: SnapAnimatorOptions): SnapAnimator => {
  const {
    animator,
    container,
    domain,
    axis = "block",
    selector = ".snap",
    defaultAlign = "start",
    type = "proximity",
    proximity = 250, // px
  } = opts;

  type SnapPoint = {
    element: HTMLElement;
    position: number; // scroll position at which alignment is satisfied
    align: SnapAlign;
  };

  let snapPoints: SnapPoint[] = [];

  const clientSizeProp = axis === "block" ? "clientHeight" : "clientWidth";
  const offsetProp = axis === "block" ? "offsetTop" : "offsetLeft";
  const sizeKey = axis === "block" ? "height" : "width";

  let lastClientSize = -1;
  let lastTarget: number | undefined;

  // helper to keep all positions in [0, maxScroll] (normalized)
  const clampToScrollRange = (pos: number): number => {
    if (!Number.isFinite(pos)) return 0;
    return Math.max(0, domain.normalize(pos));
  };

  const readAlign = (el: HTMLElement): SnapAlign => {
    const dataAlign = el.getAttribute("data-snap-align");
    if (
      dataAlign === "start" ||
      dataAlign === "center" ||
      dataAlign === "end"
    ) {
      return dataAlign;
    }

    // inline style scroll-snap-align
    const styleVal = el.style.getPropertyValue("scroll-snap-align");
    if (styleVal) {
      const token = styleVal.split(/\s+/)[0]?.trim();
      if (token === "start" || token === "center" || token === "end") {
        return token;
      }
    }

    return defaultAlign;
  };

  const offsetWithinContainer = (el: HTMLElement): number => {
    let offset = 0;
    let node: HTMLElement | null = el;
    while (node && node !== container) {
      const val = (node as HTMLElement)[
        offsetProp as "offsetTop" | "offsetLeft"
      ];
      offset += val || 0;
      node = node.offsetParent as HTMLElement | null;
    }
    return offset;
  };

  const measureSnapPoints = () => {
    const viewportSize =
      container[clientSizeProp as "clientHeight" | "clientWidth"];

    lastClientSize = viewportSize;

    const candidates = Array.from(
      container.querySelectorAll<HTMLElement>(selector),
    );

    snapPoints = candidates
      .map((el) => {
        const align = readAlign(el);
        const rect = el.getBoundingClientRect();
        const elemSize = rect[sizeKey as "height" | "width"];
        const offset = offsetWithinContainer(el);

        let position = offset; // start align

        if (align === "center") {
          position = offset - (viewportSize / 2 - elemSize / 2);
        } else if (align === "end") {
          position = offset - (viewportSize - elemSize);
        }

        // NEW: keep snap positions inside the scrollable range
        position = clampToScrollRange(position);

        return { element: el, position, align };
      })
      .sort((a, b) => a.position - b.position);
  };

  const ensureMeasured = () => {
    const size = container[clientSizeProp as "clientHeight" | "clientWidth"];
    if (!snapPoints.length || size !== lastClientSize) {
      measureSnapPoints();
    }
  };

  const findNearestSnap = (pos: number): SnapPoint | null => {
    if (!snapPoints.length) return null;

    // Use domain.distance for circular-aware nearest calculation
    let best = snapPoints[0]!;
    let bestDist = domain.distance(best.position, pos);

    for (let i = 0; i < snapPoints.length; i++) {
      const sp = snapPoints[i]!;
      const d = domain.distance(sp.position, pos);
      if (d < bestDist) {
        best = sp;
        bestDist = d;
      }
    }
    return best;
  };

  // Optionally keep things fresh on resize.
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      measureSnapPoints();
    });
    ro.observe(container);
  }

  const SNAP_SETTLE_FACTOR = 0.05; // how close to target we must be before snapping

  const snapAnimator: SnapAnimator = {
    animator,
    data: {
      snapTarget: 0,
      nearestCanonical: 0,
      distToSnap: 0,
      element: null,
    },
    step(current: number, dt: number, target: number) {
      ensureMeasured();

      const next = animator.step(current, dt, target);
      if (next === null) return null;

      if (!snapPoints.length) {
        // no snap points, behave like plain expAnimator
        return next;
      }

      const nearest = findNearestSnap(next);
      if (!nearest) {
        return next;
      }

      // Calculate the actual target position for this snap point
      // and clamp it into the scroll range
      const snapTarget = nearest.position;

      const distToSnap = domain.distance(snapTarget, next);
      const distCurrentToTarget = domain.distance(target, current);

      // Only consider snapping when we're already "settling" near our target.
      // This prevents the first snap from acting like a sticky gravity well.
      const lastTargetChanged =
        lastTarget !== undefined && lastTarget !== target; // treat any change as active input (trackpads send tiny deltas)
      lastTarget = target;

      const isSettling =
        !lastTargetChanged &&
        distCurrentToTarget < proximity * SNAP_SETTLE_FACTOR;

      this.data.snapTarget = snapTarget;
      this.data.nearestCanonical = nearest.position;
      this.data.element = nearest.element;
      this.data.distToSnap = distToSnap;
      if (type === "proximity" && distToSnap > proximity) {
        this.data.distToSnap = Infinity;
      }

      if (isSettling && (distToSnap < proximity || type === "mandatory")) {
        domain.target = snapTarget;
        return next;
      }

      return next;
    },
  };

  return snapAnimator;
};
