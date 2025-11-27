import { Animator } from "./core";

export const expAnimator = (lerp = 0.1): Animator => {
  const freq = 1 / 60;
  const k = -Math.log(1 - lerp) / freq;
  const animator = {
    target: 0,
    step: function (c: number, dt: number) {
      const alpha = 1 - Math.exp((-k * dt) / 1000);
      const next = c + (this.target - c) * alpha;
      return Math.abs(this.target - next) < 0.25 ? null : next;
    },
  };
  return animator;
};
