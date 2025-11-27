export * from "./dom";
export type { Scheduler, ScrollDriver, ScrollEngine } from "./core";
import { Scheduler, ScrollDriver, ScrollEngine } from "./core";

// import { EngineWithMiddlewareBuilder } from "./builder";
// export { EngineWithMiddlewareBuilder };
import { sessionStoragePersistence } from "./middleware/sessionStoragePersistence";
import {
  createRafScheduler,
  createDOMDriver,
  createEngine,
  createGesturePort,
} from "./dom";

import { expAnimator } from "./animators";
import { wheelInput, touchInput } from "./inputs";

export const defaultScrollEngine = () => {

  const driver = createDOMDriver(window, "block");
  const inputs = [
    wheelInput({ element: document.body }),
    touchInput({ element: document.body, multiplier: 2 }),
  ];
  const scheduler = createRafScheduler();
  const animator = expAnimator(0, 0.1);

  const engine = createEngine(driver, scheduler);

  const guestures = createGesturePort({
    inputs,
    engine,
    animator,
  });

  return {
    engine,
    guestures,
  };

}

export const circularScrollEngine = () => {

  const driver = createDOMDriver(window, "block");

  return createEngine(driver, createRafScheduler());
}


// // new EngineWithMiddlewareBuilder()
// //   .withOptions({
// //     driver: createDOMDriver(window, "block"),
// //     inputs: [
// //       wheelInput({ element: document.body }),
// //       touchInput({ element: document.body, multiplier: 2 }),
// //     ],
// //     scheduler: createRafScheduler(),
// //     animator: expAnimator(0.1),
// //     plugins: [],
// //   })
// //   .use(sessionStoragePersistence({ restoreMode: "immediate" })) // ← seeds before init()
// //   .build();

// /** Virtual circular driver that keeps position in memory. */
// function createVirtualCircularDriver(): ScrollDriver {
//   const base = createDOMDriver(window, "block");

//   return {
//     ...base,
//     domain: () => {
//       const lim = Math.max(0, base.limit());
//       return {
//         kind: "circular-end-unbounded",
//         min: 0,
//         max: lim,
//         period: lim,
//       } as const;
//     },
//   };
// }

// export const circularScrollEngine = (
//   scheduler: Scheduler = createRafScheduler(),
// ): ScrollEngine => {
//   const driver = createVirtualCircularDriver();
//   return new EngineWithMiddlewareBuilder()
//     .withOptions({
//       driver,
//       inputs: [
//         wheelInput({ element: document.body }),
//         touchInput({ element: document.body, multiplier: 2 }),
//       ],
//       scheduler,
//       animator: expAnimator(0.15), // slightly snappier default for loops
//       plugins: [],
//     })
//     .use(sessionStoragePersistence({ restoreMode: "immediate" })) // ← seeds before init()
//     .build();
// };
