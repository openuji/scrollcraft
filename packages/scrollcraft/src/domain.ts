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
  return {
    clampLogical(canonical: number) {
      return clamp(0, canonical, driverLimit());
    },
    clampCanonical(canonical: number) {
      return canonical;
    },
  };
}

export function createCircularByBottomDomainRuntime(
  driverLimit: LimitProvider,
): DomainRuntime {
  const period = driverLimit();

  return {
    clampLogical(logical: number, direction: ScrollDirection) {
      const nonNegative = Math.max(0, logical);

      if (direction > 0) {
        //
        // Scrolling DOWN:
        //  - allow > period, so canonical modulo() can wrap
        //  - only prevent going above the top (negative).
        //
        return nonNegative;
      }

      //
      // Scrolling UP (or initial dir 0):
      //  - clamp into [0, period]
      //  - this means you can’t go below 0 *or* above period,
      //    so modulo never sees out-of-range values → no wrap.
      //
      const clamped = Math.min(period, nonNegative);
      return clamped;
    },
    clampCanonical(canonical: number) {
      if (canonical < 0) {
        // TOP: clamp, don't wrap
        return 0;
      }
      const clamped = modulo(canonical, period);
      return clamped;
    },
  };
}
