import { ScrollEngine, ScrollSignal, ScrollDriver, AnimationStep, Scheduler, Animator, AXIS } from "./core";
import type { DomainDescriptor, InputModule, ScrollAxisKeyword, ScrollWriteOptions } from "./core";



export function createRafScheduler(): Scheduler {
  let handle: number | null = null;

  return {
    start(cb) {
      handle = requestAnimationFrame(cb);
      return handle;
    },

    stop() {
      if (handle !== null) {
        cancelAnimationFrame(handle);
        handle = null;
      }
    },
  };
}

export function createDOMDriver(
  target: Window | HTMLElement,
  axisKeyword: ScrollAxisKeyword,
): ScrollDriver {
  const ax = AXIS[axisKeyword];
  const el: HTMLElement =
    target === window
      ? (document.scrollingElement as HTMLElement | null) ||
      document.documentElement
      : (target as HTMLElement);

  let ignore = false;

  const read = () => el[ax.scrollProp] as number;

  const write = (pos: number, opts?: ScrollWriteOptions) => {
    ignore = true;

    if (target === window) {
      window.scrollTo({ [ax.scrollToProp]: pos, behavior: "instant" });
    } else {
      el[ax.scrollProp] = pos;
    }
  };

  const onUserScroll = (cb: (n: number) => void) => {
    const h = () => {
      if (ignore) {
        ignore = false;
        return;
      }
      cb(read());
    };
    (target === window ? window : el).addEventListener("scroll", h, {
      passive: true,
    });
    return () =>
      (target === window ? window : el).removeEventListener("scroll", h);
  };
  const limit = () =>
    (el[ax.scrollSizeProp] as number) - (el[ax.clientSizeProp] as number);
  const domain = (): DomainDescriptor => ({
    kind: "bounded",
    min: 0,
    max: Math.max(0, limit()),
  });
  return {
    read,
    write,
    limit,
    domain,
    onUserScroll,
  };
}

export function createEngine(driver: ScrollDriver, scheduler: Scheduler): ScrollEngine {
  let animationStep: AnimationStep | null = null;
  let lastTime = 0;

  const signal = new ScrollSignal(); // keeps pos in sync

  signal.on((p, o) => {
    if (o === "program") {
      driver.write(p);
    }
  });

  function loop(time: number) {
    if (!animationStep) {
      stopLoop();
      return;
    }

    const dt = lastTime ? time - lastTime : 0;
    lastTime = time;

    const current = signal.value;
    const next = animationStep(current, dt);


    if (next == null) {
      animationStep = null;

      stopLoop();
      return;
    }
    signal.set(next, "program");
    scheduler.start(loop);
  }

  function startLoop() {
    if (!animationStep) return;
    lastTime = 0;
    scheduler.start(loop);
  }

  function stopLoop() {
    scheduler.stop();
  }

  return {
    driver,
    run(step) {
      if (animationStep === step) return;
      if (!step) {
        stopLoop();
        return;
      }
      animationStep = step;
      startLoop();
    }
  };
}

export function createGesturePort(opts: {
  engine: ScrollEngine;
  animator: Animator;
  inputs: InputModule[];
}) {
  const { engine, animator, inputs } = opts;
  const destroyers: (() => void)[] = [];

  const stepper: AnimationStep = (current, dt) => {
    const next = animator.step(current, dt);
    return next; // engine loop writes it
  };

  inputs.forEach(mod => {
    destroyers.push(mod((d) => {

      animator.target += d;
      engine.run(stepper); // gesture takes control
    }));
  });

  return {
    destroy() {
      destroyers.forEach(d => d());
    },
  };
}


