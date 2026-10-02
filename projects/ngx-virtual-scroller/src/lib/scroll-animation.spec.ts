import { animateScroll, easeOutQuad } from './scroll-animation';

describe('animateScroll', () => {
  let callbacks: Map<number, FrameRequestCallback>;
  let nextId: number;

  // Runs the pending animation frame at the given timestamp
  const frame = (now: number) => {
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach((cb) => cb(now));
  };

  beforeEach(() => {
    callbacks = new Map();
    nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.set(nextId, cb);
      return nextId++;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('eases out quadratically, like tween.js Easing.Quadratic.Out', () => {
    expect(easeOutQuad(0)).toBe(0);
    expect(easeOutQuad(0.5)).toBe(0.75);
    expect(easeOutQuad(1)).toBe(1);
  });

  it('moves from start to end over the duration, then calls onDone once', () => {
    const positions: number[] = [];
    const onDone = vi.fn();
    animateScroll(100, 300, 1000, (p) => positions.push(p), onDone);

    frame(5000); // first frame sets the start time
    frame(5500);
    expect(onDone).not.toHaveBeenCalled();
    frame(6000);

    expect(positions).toEqual([100, 100 + 200 * 0.75, 300]);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);
  });

  it('lands on the end position even when frames overshoot the duration', () => {
    const positions: number[] = [];
    animateScroll(0, 50, 100, (p) => positions.push(p), vi.fn());

    frame(0);
    frame(250);

    expect(positions.at(-1)).toBe(50);
  });

  it('jumps straight to the end for a zero duration', () => {
    const positions: number[] = [];
    const onDone = vi.fn();
    animateScroll(10, 20, 0, (p) => positions.push(p), onDone);

    frame(0);

    expect(positions).toEqual([20]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stop() cancels without calling onDone', () => {
    const onFrame = vi.fn();
    const onDone = vi.fn();
    const animation = animateScroll(0, 100, 1000, onFrame, onDone);

    frame(0);
    animation.stop();
    frame(500);

    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
});
