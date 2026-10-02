export interface JumpProbeOptions {
  /** The scroll element: null for the visible <virtual-scroller> itself, 'window' for document.scrollingElement, or a
   * CSS selector for a parent */
  scrollRoot: string | null;
  horizontal: boolean;
  /** Pixels scrolled per frame; negative scrolls back. 0 just samples */
  step: number;
  frames: number;
  /** Space between items that no item covers (gaps, margins), allowed at the viewport edges */
  spacing: number;
  /** Id of the last item; the end of the viewport may be uncovered once it's rendered */
  lastId: number;
}

export interface JumpProbeResult {
  samples: number;
  /** Samples with at least one item also on screen in the previous sample, so the jump check actually ran */
  comparedFrames: number;
  jumps: { frame: number; id: number; moved: number; scrolled: number }[];
  gaps: { frame: number; visible: [number, number]; rendered: [number, number] }[];
  minId: number;
  maxId: number;
  maxRendered: number;
  scrollStart: number;
  scrollEnd: number;
}

/**
 * Layout-only paint oracle, run in the page with `page.evaluate(jumpProbe, options)`, so it must be self-contained.
 *
 * Scrolls the scroll element `step` px per frame and samples right before each paint (a ResizeObserver callback runs
 * after rAF callbacks and layout). It checks two things in every sample:
 * - jumps: every item on screen in both this and the previous sample moved by exactly the scroll delta. A wrong item
 *   size, an unmeasured gap or margin, or padding painted a frame before its items all break this.
 * - coverage: the rendered items cover the visible part of the scroll element, with no blank strip at either edge.
 *
 * Items are keyed by `data-index`. It reads only the DOM, never the scroller's own state.
 */
export async function jumpProbe(options: JumpProbeOptions): Promise<JumpProbeResult> {
  const { scrollRoot, horizontal, step, frames, spacing, lastId } = options;
  if (document.visibilityState !== 'visible') {
    throw new Error('The page is hidden, so requestAnimationFrame is paused');
  }

  const scroller = [...document.querySelectorAll<HTMLElement>('virtual-scroller')].find(
    (element) => element.offsetParent !== null,
  );
  if (!scroller) {
    throw new Error('No visible <virtual-scroller>');
  }
  const isWindow = scrollRoot === 'window';
  const scrollElement = isWindow
    ? document.scrollingElement!
    : scrollRoot
      ? document.querySelector(scrollRoot)!
      : scroller;
  const scrollProp = horizontal ? 'scrollLeft' : 'scrollTop';

  const visibleEdges = (): [number, number] => {
    if (isWindow) {
      return [0, horizontal ? innerWidth : innerHeight];
    }
    const rect = scrollElement.getBoundingClientRect();
    const start = horizontal
      ? rect.left + scrollElement.clientLeft
      : rect.top + scrollElement.clientTop;
    return [start, start + (horizontal ? scrollElement.clientWidth : scrollElement.clientHeight)];
  };

  const tolerance = 1.5;
  const jumps: JumpProbeResult['jumps'] = [];
  const gaps: JumpProbeResult['gaps'] = [];
  let previous: Map<number, number> | undefined;
  let previousScroll = 0;
  let frame = 0;
  let samples = 0;
  let comparedFrames = 0;
  let minId = Infinity;
  let maxId = -Infinity;
  let maxRendered = 0;

  const sample = () => {
    ++samples;
    const scroll = scrollElement[scrollProp];
    const positions = new Map<number, number>();
    let renderedStart = Infinity;
    let renderedEnd = -Infinity;
    let firstRendered = false;
    let lastRendered = false;
    const items = scroller.querySelectorAll<HTMLElement>('[data-index]');
    maxRendered = Math.max(maxRendered, items.length);
    for (const item of items) {
      const id = Number(item.dataset['index']);
      const rect = item.getBoundingClientRect();
      const start = horizontal ? rect.left : rect.top;
      const end = horizontal ? rect.right : rect.bottom;
      positions.set(id, start);
      renderedStart = Math.min(renderedStart, start);
      renderedEnd = Math.max(renderedEnd, end);
      firstRendered ||= id === 0;
      lastRendered ||= id === lastId;
    }

    if (previous) {
      const scrolled = scroll - previousScroll;
      let compared = false;
      for (const [id, start] of positions) {
        const before = previous.get(id);
        if (before === undefined) {
          continue;
        }
        compared = true;
        const moved = start - before;
        if (Math.abs(moved + scrolled) > tolerance) {
          jumps.push({ frame, id, moved: Math.round(moved), scrolled: Math.round(scrolled) });
          break;
        }
      }
      if (compared) {
        ++comparedFrames;
      }
    }

    for (const id of positions.keys()) {
      minId = Math.min(minId, id);
      maxId = Math.max(maxId, id);
    }

    // Before the first item and after the last there is other content (headers, footers), not a gap
    const [viewStart, viewEnd] = visibleEdges();
    const startGap = !firstRendered && renderedStart > viewStart + spacing + tolerance;
    const endGap = !lastRendered && renderedEnd < viewEnd - spacing - tolerance;
    if (positions.size === 0 || startGap || endGap) {
      gaps.push({
        frame,
        visible: [Math.round(viewStart), Math.round(viewEnd)],
        rendered: [Math.round(renderedStart), Math.round(renderedEnd)],
      });
    }

    previous = positions;
    previousScroll = scroll;
  };

  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:0;top:0;height:1px;width:1px;opacity:0;pointer-events:none';
  document.body.appendChild(probe);
  const observer = new ResizeObserver(sample);
  observer.observe(probe);
  const scrollStart = scrollElement[scrollProp];

  try {
    await new Promise<void>((resolve) => {
      const tick = () => {
        ++frame;
        probe.style.width = frame % 2 ? '2px' : '1px';
        if (frame <= frames) {
          // Scroll from a task between frames, like a user's scroll: the scroll event then fires at the start of the
          // next frame, before its rAF callbacks
          setTimeout(() => (scrollElement[scrollProp] += step));
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
    // Let the last refresh settle and be sampled too
    for (let i = 0; i < 10; ++i) {
      ++frame;
      probe.style.width = frame % 2 ? '2px' : '1px';
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  } finally {
    observer.disconnect();
    probe.remove();
  }

  return {
    samples,
    comparedFrames,
    jumps,
    gaps,
    minId,
    maxId,
    maxRendered,
    scrollStart: Math.round(scrollStart),
    scrollEnd: Math.round(scrollElement[scrollProp]),
  };
}
