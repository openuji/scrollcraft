import {
  clamp,
  modulo,
  DomainRuntime,
  ScrollDirection,
  Animator,
} from "./core";

type LimitProvider = () => number;

export type ApplyImpulseResult = { target: number; canonical: number };

export interface DomainApplyImpulseCtx {
  currentTarget: number;
  impulse: number;
  motionValue: number;
  direction: ScrollDirection;
  runtime: DomainRuntime;
}

export interface DomainPlugin {
  name: string;

  applyImpulse?(
    ctx: DomainApplyImpulseCtx,
    next: (ctx: DomainApplyImpulseCtx) => ApplyImpulseResult,
  ): ApplyImpulseResult;

  wrapAnimator?(animator: Animator, runtime: DomainRuntime): Animator;
}

// export function withDomainPlugins(
//   base: DomainRuntime,
//   plugins: DomainPlugin[],
// ): DomainRuntime {
//   const impulseChain = composeDomain<DomainApplyImpulseCtx, ApplyImpulseResult>(
//     plugins
//       .map((p) => p.applyImpulse)
//       .filter((f): f is NonNullable<typeof f> => !!f),
//     (ctx) =>
//       base.applyImpulse(
//         ctx.currentTarget,
//         ctx.impulse,
//         ctx.motionValue,
//         ctx.direction,
//       ),
//   );

//   const runtime: DomainRuntime = {
//     ...base,
//     applyImpulse(currentTarget, impulse, motionValue, direction) {
//       return impulseChain({
//         currentTarget,
//         impulse,
//         motionValue,
//         direction,
//         runtime: base,
//       });
//     },
//   };

//   return runtime;
// }

export function createDomainRuntime(driverLimit: LimitProvider): DomainRuntime {
  let _target = 0;

  return {
    // Target state
    get target() {
      return _target;
    },
    set target(v: number) {
      _target = v;
    },
    setTarget(v: number) {
      _target = v;
    },

    // Clamping
    setClampedTarget(delta: number) {
      _target = clamp(0, _target + delta, driverLimit());
    },
    clampCanonical(canonical: number) {
      return canonical;
    },

    // Position semantics (linear/bounded)
    distance(a: number, b: number) {
      return Math.abs(a - b);
    },
    normalize(v: number) {
      return v; // already canonical in bounded domain
    },
    nearestEquivalent(_from: number, to: number) {
      return to; // no wrapping in bounded domain
    },
  };
}

export function createCircularByBottomDomainRuntime(
  driverLimit: LimitProvider,
): DomainRuntime {
  const period = driverLimit();
  let _target = 0;

  return {
    // Target state
    get target() {
      return _target;
    },
    set target(v: number) {
      _target = v;
    },
    setTarget(v: number) {
      _target = v;
    },

    // Clamping
    setClampedTarget(delta: number, direction: ScrollDirection) {
      const logical = _target + delta;
      const nonNegative = Math.max(0, logical);

      if (direction > 0) {
        //
        // Scrolling DOWN:
        //  - allow > period, so canonical modulo() can wrap
        //  - only prevent going above the top (negative).
        //
        _target = nonNegative;
      } else {
        //
        // Scrolling UP (or initial dir 0):
        //  - clamp into [0, period]
        //  - this means you can't go below 0 *or* above period,
        //    so modulo never sees out-of-range values → no wrap.
        //
        _target = Math.min(period, nonNegative);
      }
    },
    clampCanonical(canonical: number) {
      if (canonical < 0) {
        // TOP: clamp, don't wrap
        return 0;
      }
      const clamped = modulo(canonical, period);
      return clamped;
    },

    // Position semantics (circular)
    distance(a: number, b: number) {
      // Normalize both positions into [0, period)
      const na = modulo(a, period);
      const nb = modulo(b, period);
      const linear = Math.abs(na - nb);
      // Circular distance is the shorter path
      return Math.min(linear, period - linear);
    },
    normalize(v: number) {
      return modulo(v, period);
    },
    nearestEquivalent(from: number, to: number) {
      // Find the equivalent of `to` that is closest to `from`
      // by checking to, to + period, to - period
      const normalizedTo = modulo(to, period);
      const candidates = [
        normalizedTo,
        normalizedTo + period,
        normalizedTo - period,
      ];
      let best = candidates[0]!;
      let bestDist = Math.abs(from - best);
      for (const c of candidates) {
        const d = Math.abs(from - c);
        if (d < bestDist) {
          best = c;
          bestDist = d;
        }
      }
      return best;
    },
  };
}
