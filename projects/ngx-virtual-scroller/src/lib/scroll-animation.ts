export interface ScrollAnimation {
  stop(): void;
}

/** Quadratic ease-out, the same curve as tween.js `Easing.Quadratic.Out` */
export const easeOutQuad = (t: number): number => t * (2 - t);

/**
 * Animates a value from `from` to `to` over `durationMs`, calling `onFrame` with the eased value once per animation
 * frame and `onDone` after the final frame. `stop()` cancels it without calling `onDone`.
 */
export function animateScroll(
  from: number,
  to: number,
  durationMs: number,
  onFrame: (position: number) => void,
  onDone: () => void,
): ScrollAnimation {
  let frameId = 0;
  let start: number | undefined;
  const step = (now: number) => {
    start ??= now;
    const t = durationMs > 0 ? Math.min((now - start) / durationMs, 1) : 1;
    onFrame(from + (to - from) * easeOutQuad(t));
    if (t < 1) {
      frameId = requestAnimationFrame(step);
    } else {
      onDone();
    }
  };
  frameId = requestAnimationFrame(step);
  return { stop: () => cancelAnimationFrame(frameId) };
}
