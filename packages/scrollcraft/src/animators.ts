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

/** Represents a measured snap point in the scroll container */
interface SnapPoint {
  element: HTMLElement;
  /** Scroll position where alignment is satisfied */
  position: number;
  align: SnapAlign;
}

export interface SnapAnimatorOptions {
  animator: Animator;
  container: HTMLElement;
  /** Domain provides distance semantics (e.g., circular wrapping) */
  domain: DomainRuntime;
  /** Scroll axis: "block" (vertical) or "inline" (horizontal) */
  axis?: ScrollAxisKeyword;
  /** CSS selector for snap-able children (default: ".snap") */
  selector?: string;
  /** Fallback alignment when element has none specified */
  defaultAlign?: SnapAlign;
  /** Snap behavior: "mandatory" always snaps, "proximity" only within range */
  type?: SnapType;
  /** Pixel radius for proximity snapping (default: 250) */
  proximity?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALIGNMENT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const VALID_ALIGNS: readonly SnapAlign[] = ["start", "center", "end"];

function isValidAlign(value: string | null): value is SnapAlign {
  return value !== null && VALID_ALIGNS.includes(value as SnapAlign);
}

/**
 * Reads snap alignment from element's data attribute or inline style.
 * Priority: data-snap-align > scroll-snap-align style > defaultAlign
 */
function readAlignFromElement(el: HTMLElement, defaultAlign: SnapAlign): SnapAlign {
  // Check data attribute first
  const dataAlign = el.getAttribute("data-snap-align");
  if (isValidAlign(dataAlign)) {
    return dataAlign;
  }

  // Fall back to inline style
  const styleVal = el.style.getPropertyValue("scroll-snap-align");
  if (styleVal) {
    const firstToken = styleVal.split(/\s+/)[0]?.trim() ?? "";
    if (isValidAlign(firstToken)) {
      return firstToken;
    }
  }

  return defaultAlign;
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFSET CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

type OffsetProperty = "offsetTop" | "offsetLeft";

/**
 * Calculates total offset of an element relative to a container,
 * walking up the offsetParent chain.
 */
function calculateOffsetWithinContainer(
  el: HTMLElement,
  container: HTMLElement,
  offsetProp: OffsetProperty,
): number {
  let offset = 0;
  let node: HTMLElement | null = el;

  while (node && node !== container) {
    offset += node[offsetProp] || 0;
    node = node.offsetParent as HTMLElement | null;
  }

  return offset;
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAP POSITION CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the scroll position needed to satisfy the given alignment
 * for an element within a viewport.
 */
function calculateAlignedPosition(
  elementOffset: number,
  elementSize: number,
  viewportSize: number,
  align: SnapAlign,
): number {
  switch (align) {
    case "start":
      return elementOffset;
    case "center":
      return elementOffset - (viewportSize - elementSize) / 2;
    case "end":
      return elementOffset - (viewportSize - elementSize);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a DOM-aware animator that snaps to elements.
 *
 * Snap elements can specify alignment via:
 * - `data-snap-align="start|center|end"`
 * - `style="scroll-snap-align: start|center|end"`
 *
 * @example
 * ```html
 * <section class="snap" data-snap-align="center">...</section>
 * <section class="snap" style="scroll-snap-align: end">...</section>
 * ```
 *
 * The animator eases toward the target position, but when settling
 * (velocity near zero), it retargets to the nearest snap point.
 */
export const createSnapAnimator = (opts: SnapAnimatorOptions): SnapAnimator => {
  // ─── Configuration ───────────────────────────────────────────────────────
  const {
    animator,
    container,
    domain,
    axis = "block",
    selector = ".snap",
    defaultAlign = "start",
    type = "proximity",
    proximity = 250,
  } = opts;

  // Axis-dependent property names
  const isBlockAxis = axis === "block";
  const clientSizeProp = isBlockAxis ? "clientHeight" : "clientWidth";
  const offsetProp: OffsetProperty = isBlockAxis ? "offsetTop" : "offsetLeft";
  const rectSizeKey = isBlockAxis ? "height" : "width";

  // Threshold: how close to target before considering snap (5% of proximity)
  const SETTLE_THRESHOLD = proximity * 0.05;

  // ─── State ───────────────────────────────────────────────────────────────
  let snapPoints: SnapPoint[] = [];
  let lastMeasuredSize = -1;
  let previousTarget: number | undefined;
  let lastSnappedTarget: number | undefined;

  // ─── Measurement ─────────────────────────────────────────────────────────

  const clampToScrollRange = (pos: number): number => {
    if (!Number.isFinite(pos)) return 0;
    return Math.max(0, domain.normalize(pos));
  };

  const measureSnapPoints = (): void => {
    const viewportSize = container[clientSizeProp];
    lastMeasuredSize = viewportSize;

    const elements = container.querySelectorAll<HTMLElement>(selector);

    snapPoints = Array.from(elements)
      .map((el, index): SnapPoint => {
        const align = readAlignFromElement(el, defaultAlign);
        const elementSize = el.getBoundingClientRect()[rectSizeKey];
        const elementOffset = calculateOffsetWithinContainer(el, container, offsetProp);

        const rawPosition = calculateAlignedPosition(
          elementOffset,
          elementSize,
          viewportSize,
          align,
        );

        return {
          element: el,
          position: clampToScrollRange(rawPosition),
          align,
        };
      })
      .sort((a, b) => a.position - b.position);
  };

  const ensureMeasured = (): void => {
    const currentSize = container[clientSizeProp];
    const needsRemeasure = snapPoints.length === 0 || currentSize !== lastMeasuredSize;

    if (needsRemeasure) {
      measureSnapPoints();
    }
  };

  // ─── Snap Finding ────────────────────────────────────────────────────────

  const findNearestSnapPoint = (position: number): SnapPoint | null => {
    if (snapPoints.length === 0) return null;

    let nearest = snapPoints[0]!;
    let nearestDistance = domain.distance(nearest.position, position);
    //console.log('nearestDistance', nearestDistance, nearest.position, position);

    for (const point of snapPoints) {
      const distance = domain.distance(point.position, position);
      if (distance < nearestDistance) {
        nearest = point;
        nearestDistance = distance;
      }
    }
    //console.log('nearest ->', nearest.position);
    return nearest;
  };

  // ─── Resize Observer ─────────────────────────────────────────────────────

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => measureSnapPoints()).observe(container);
  }

  // ─── Animator ────────────────────────────────────────────────────────────

  return {
    animator,

    data: {
      snapTarget: 0,
      nearestCanonical: 0,
      distToSnap: 0,
      element: null,
    },

    step(current: number, dt: number, target: number): number | null {
      ensureMeasured();

      // Delegate to base animator
      let next = animator.step(current, dt, target);

      if (next === null) return null;

      // No snap points? Just pass through
      if (snapPoints.length === 0) return next;

      // Find nearest snap point to projected position
      const nearest = findNearestSnapPoint(domain.normalize(next));
      if (!nearest) return next;

      // Calculate distances
      const snapTarget = nearest.position;
      const distanceToSnap = domain.distance(snapTarget, domain.normalize(next));
      // Use RAW distance (not normalized) to detect settling - normalized distance
      // would always be small at period boundaries, causing constant re-snapping
      const distanceToTarget = Math.abs(target - current);

      // Detect if user is actively scrolling (target changed since last frame)
      const targetChanged = previousTarget !== undefined && previousTarget !== target;
      previousTarget = target;

      // "Settling" = user stopped scrolling and we're close to target
      const isSettling = !targetChanged && distanceToTarget < SETTLE_THRESHOLD;

      // Update diagnostic data
      this.data.snapTarget = snapTarget;
      this.data.nearestCanonical = nearest.position;
      this.data.element = nearest.element;
      this.data.distToSnap = type === "proximity" && distanceToSnap > proximity
        ? Infinity
        : distanceToSnap;

      // Calculate the full (non-normalized) snap target for this cycle
      const periodOffset = Math.floor(next / domain.period);
      const fullSnapTarget = snapTarget + periodOffset * domain.period;

      // Don't re-snap to the same position we just snapped to - user is trying to scroll away
      // Allow re-snap only if user has moved away significantly (past proximity range)
      const alreadyAtThisSnap = lastSnappedTarget !== undefined &&
        Math.abs(fullSnapTarget - lastSnappedTarget) < 1;
      const hasMovedAwayFromLastSnap = lastSnappedTarget === undefined ||
        Math.abs(target - lastSnappedTarget) > proximity;

      // Apply snap if settling and within range (or mandatory)
      const shouldSnap = isSettling &&
        (type === "mandatory" || distanceToSnap < proximity) &&
        (!alreadyAtThisSnap || hasMovedAwayFromLastSnap);

      if (shouldSnap) {
        console.log('[SNAP]', {
          next,
          snapTarget,
          fullSnapTarget,
          period: domain.period,
          periodOffset,
          current,
          target,
          normalizedNext: domain.normalize(next),
          lastSnappedTarget
        });
        domain.target = fullSnapTarget;
        lastSnappedTarget = fullSnapTarget;
      }

      // Reset lastSnappedTarget when user starts scrolling away
      if (targetChanged && lastSnappedTarget !== undefined) {
        const movingAway = Math.abs(target - lastSnappedTarget) > proximity;
        if (movingAway) {
          lastSnappedTarget = undefined;
        }
      }

      return next;
    },
  };
};
