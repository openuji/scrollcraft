import type { EngineMiddleware, ScrollEngine } from "../core";

// export function compose(middlewares: EngineMiddleware[]) {
//   return (ctx: EngineContext, last: () => void) => {
//     let idx = -1;
//     const dispatch = (i: number): void => {
//       if (i <= idx) throw new Error("next() called multiple times");
//       idx = i;
//       if (i === middlewares.length) {
//         last();
//         return;
//       }
//       const fn = middlewares[i];
//       if (fn) fn(ctx, () => dispatch(i + 1));
//     };
//     dispatch(0);
//   };
// }

export function applyMiddlewares(
  engine: ScrollEngine,
  middlewares: EngineMiddleware[],
): ScrollEngine {
  const destroyers = middlewares.map((mw) => mw(engine));

  const origDestroy = engine.destroy.bind(engine);

  return {
    ...engine,
    destroy() {
      try {
        destroyers.forEach((d) => d && d());
      } finally {
        origDestroy();
      }
    },
  };
}
