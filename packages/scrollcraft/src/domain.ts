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
    period: driverLimit(),
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
    denormalize(v: number) {
      return v; // no wrapping in bounded domain
    },
  };
}

export function createCircularByBottomDomainRuntime(
  driverLimit: LimitProvider,
): DomainRuntime {
  const period = driverLimit();
  let _target = 0;

  return {
    period,
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
      const logical = _target + delta;
      const currentPeriodOffset = Math.floor(_target / period);
      const nonNegative = Math.max(currentPeriodOffset * period, logical);
      _target = nonNegative;
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
      return Math.abs(a - b);
    },
    normalize(v: number) {
      return modulo(v, period);
    },
    denormalize(v: number, target?: number) {
      const currentPeriodOffset = Math.floor((target ?? _target) / period);
      return v + currentPeriodOffset * period;
    }
  };
}
