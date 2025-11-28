import {
  ScrollEngine,
  ScrollSignal,
  ScrollDriver,
  AnimationStep,
  Scheduler,
  Animator,
  AXIS,
} from "./core";
import type {
  DomainDescriptor,
  DomainRuntime,
  InputModule,
  ScrollAxisKeyword,
  ScrollDirection,
} from "./core";

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

  const write = (pos: number) => {
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

export function createEngine(
  driver: ScrollDriver,
  scheduler: Scheduler,
  domain: DomainRuntime,
): ScrollEngine {
  let animationStep: AnimationStep | null = null;
  let lastTime = 0;
  let lastPosition: number | null = null;
  let direction: ScrollDirection = 0;

  const signal = new ScrollSignal(); // keeps pos in sync

  // Initialize signal with current scroll position
  signal.set(driver.read(), "user");

  signal.on((p, o) => {
    if (o === "program") {
      const wrapped = domain.clampCanonical(p);
      driver.write(wrapped);
    }
  });

  signal.on((p) => {
    direction = p - (lastPosition || 0) > 0 ? 1 : -1;
    lastPosition = p;
  });

  // Listen for user-initiated scrolls (e.g., scrollbar, keyboard)
  const offUser = driver.onUserScroll((pos) => {
    signal.set(pos, "user");
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

  function schedule(cb: (t?: number) => void) {
    // one-shot via scheduler
    const id = scheduler.start((t) => {
      scheduler.stop(id);
      cb(t);
    });
  }

  function destroy() {
    offUser?.();
    stopLoop();
  }

  return {
    signal,
    driver,
    domain,
    direction,
    schedule,
    destroy,
    run(step) {
      if (animationStep === step) return;
      if (!step) {
        animationStep = null;
        stopLoop();
        return;
      }
      animationStep = step;
      startLoop();
    },
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

  // Initialize animator target with current scroll position
  // This ensures target is in sync even if signal events were missed during initialization
  animator.target = engine.signal.value;

  engine.signal.on((pos, origin) => {
    if (origin === "user") {
      //console.log("createGesturePort user scroll target", pos);
      animator.target = pos;
    }
  });

  inputs.forEach((mod) => {
    destroyers.push(
      mod((d) => {
        animator.target = engine.domain.clampLogical(
          animator.target + d,
          engine.direction,
        );
        engine.run(stepper); // gesture takes control
      }),
    );
  });

  return {
    destroy() {
      destroyers.forEach((d) => d());
    },
  };
}

export const createCommandPort = ({
  engine,
  animator,
}: {
  engine: ScrollEngine;
  animator: Animator;
}) => {
  const stepper: AnimationStep = (current, dt) => {
    const next = animator.step(current, dt);
    return next; // engine loop writes it
  };

  return {
    scrollTo(pos: number) {
      animator.target = pos;
      engine.run(stepper);
    },
  };
};
