export * from "./dom";
export type { Scheduler, ScrollDriver, ScrollEngine } from "./core";

// import { EngineWithMiddlewareBuilder } from "./builder";
// export { EngineWithMiddlewareBuilder };
import { sessionStoragePersistence } from "./middleware/sessionStoragePersistence";
import {
  createRafScheduler,
  createDOMDriver,
  createEngine,
  createGesturePort,
  createCommandPort,
} from "./dom";

import { expAnimator } from "./animators";
import { wheelInput, touchInput } from "./inputs";
import {
  createCircularByBottomDomainRuntime,
  createDomainRuntime,
} from "./domain";
import { applyMiddlewares } from "./middleware/compose";

const inputs = [
  wheelInput({ element: document.body }),
  touchInput({ element: document.body, multiplier: 2 }),
];

export const defaultScrollEngine = () => {
  const driver = createDOMDriver(window, "block");

  const scheduler = createRafScheduler();
  const animator = expAnimator(0.1);
  const domain = createDomainRuntime(driver.limit);

  const rawEngine = createEngine(driver, scheduler, domain);
  const engine = applyMiddlewares(rawEngine, [
    sessionStoragePersistence({ key: () => "scroll-main" }),
  ]);
  const guestures = createGesturePort({
    inputs,
    engine,
    animator,
  });
  const command = createCommandPort({ engine, animator });
  return {
    engine,
    guestures,
    command,
  };
};

export const circularScrollEngine = () => {
  const driver = createDOMDriver(window, "block");
  const scheduler = createRafScheduler();
  const domain = createCircularByBottomDomainRuntime(driver.limit);

  const animator = expAnimator(0.1);

  const rawEngine = createEngine(driver, scheduler, domain);

  const engine = applyMiddlewares(rawEngine, [
    sessionStoragePersistence({ key: () => "scroll-main" }),
  ]);

  const guestures = createGesturePort({
    inputs,
    engine,
    animator,
  });

  const command = createCommandPort({ engine, animator });

  return {
    engine,
    guestures,
    command,
  };
};
