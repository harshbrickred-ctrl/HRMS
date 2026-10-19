import type { Transition } from "motion/react";

export const loginEase = [0.22, 0.61, 0.36, 1] as const;

const duration = 0.42;
const stagger = 0.045;

export function enter(reduce: boolean, index: number) {
  if (reduce) {
    return {
      initial: { opacity: 1, y: 0 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0 } satisfies Transition,
    };
  }

  return {
    initial: { opacity: index === 0 ? 1 : 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      type: "tween",
      duration,
      ease: loginEase,
      delay: index * stagger,
    } satisfies Transition,
  };
}

export function fadeTransition(reduce: boolean, seconds = 0.16): Transition {
  return {
    type: "tween",
    duration: reduce ? 0 : seconds,
    ease: loginEase,
  };
}
