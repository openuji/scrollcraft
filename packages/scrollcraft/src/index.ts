export * from "./dom";
export type {
  Scheduler,
  ScrollDriver,
  ScrollEngine,
  SnapAnimatorData,
} from "./core";

// import { EngineWithMiddlewareBuilder } from "./builder";
// export { EngineWithMiddlewareBuilder };
import {
  createRafScheduler,
  createDOMDriver,
  createEngine,
  createGesturePort,
  createCommandPort,
} from "./dom";

import { createSnapAnimator, expAnimator } from "./animators";
import { wheelInput, touchInput } from "./inputs";
import {
  createCircularByBottomDomainRuntime,
  createDomainRuntime,
} from "./domain";

const inputs = [
  wheelInput({ element: document.body }),
  touchInput({ element: document.body, multiplier: 2 }),
];

export const defaultScrollEngine = () => {
  const driver = createDOMDriver(window, "block");

  const scheduler = createRafScheduler();

  // const snapAnimator = createSnapAnimator({
  //   container: document.body,
  //   axis: "block",
  //   selector: ".snap",
  //   lerp: 0.05,
  // });

  const animator = expAnimator(0.1);
  const domain = createDomainRuntime(driver.limit);

  const rawEngine = createEngine(driver, scheduler, domain);
  const engine = rawEngine;
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

  // Calculate the period based on where the footer ends
  // This makes the scroll wrap from footer back to header, creating a seamless loop
  const getLoopPeriod = () => {
    const footer = document.querySelector("footer");
    if (footer) {
      // Find footer's offset from top + its height = where it ends
      let offset = 0;
      let el = footer as HTMLElement;
      while (el && el !== document.body) {
        offset += el.offsetTop || 0;
        el = el.offsetParent as HTMLElement;
      }
      // Add footer's own height to get the bottom position
      return offset + footer.offsetHeight;
    }
    // Fallback to driver limit if footer not found
    return driver.limit();
  };

  const domain = createCircularByBottomDomainRuntime(getLoopPeriod);

  const snapAnimator = createSnapAnimator({
    animator: expAnimator(0.1),
    container: document.body,
    axis: "block",
    selector: ".snap",
    period: getLoopPeriod(), // Enable circular-aware snapping with same period
  });

  const rawEngine = createEngine(driver, scheduler, domain);

  const engine = rawEngine;

  const guestures = createGesturePort({
    inputs,
    engine,
    animator: snapAnimator,
  });

  const command = createCommandPort({ engine, animator: snapAnimator });

  return {
    engine,
    guestures,
    command,
  };
};

export const snapScrollEngine = () => {
  const driver = createDOMDriver(window, "block");
  const scheduler = createRafScheduler();

  const snapAnimator = createSnapAnimator({
    animator: expAnimator(0.1),
    container: document.documentElement,
    axis: "block",
    selector: ".snap",
    //type: "mandatory",
    proximity: 200,
    period: driver.limit(), // Enable circular-aware snapping with same period
  });
  const domain = createDomainRuntime(driver.limit);

  const rawEngine = createEngine(driver, scheduler, domain);

  const engine = rawEngine;

  const guestures = createGesturePort({
    inputs,
    engine,
    animator: snapAnimator,
  });

  const command = createCommandPort({ engine, animator: snapAnimator });

  return {
    engine,
    guestures,
    command,
    snapAnimator,
  };
};
