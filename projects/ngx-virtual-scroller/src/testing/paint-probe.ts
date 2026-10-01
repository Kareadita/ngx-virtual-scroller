/**
 * Layout-only paint-consistency oracle. While scrolling programmatically, it checks right before each paint that every
 * rendered item is drawn at its true position: its offset from the scroll content origin equals the cumulative size of
 * everything before it. A frame where the scroller's padding and its rendered items disagree (the zoneless "row jump")
 * shows up as items drawn a row away from where they belong.
 *
 * It reads only the DOM, so it works the same for translate and margin modes, horizontal and vertical, and self or
 * parent scrolling, and it doesn't depend on the scroller's internals.
 */
export interface PaintProbeOptions {
  /** The element whose scrollTop/scrollLeft is driven (the scroller host, a parent, or document.scrollingElement) */
  scrollElement: Element;
  /** The scroller's `.total-padding` element; it scrolls with the content, so its edge is the content origin */
  origin: Element;
  /** Rendered items, each carrying `data-index` with its index in the items array */
  items: () => Iterable<HTMLElement>;
  /** True offset of the item at `index` from the content origin, in px */
  expectedOffset: (index: number) => number;
  /** Size of the item at `index` along the scroll axis, in px. When given, every frame must also have the visible
   * range fully covered by rendered items (no blank strip at either edge) */
  itemSize?: (index: number) => number;
  horizontal?: boolean;
  /** Pixels scrolled per frame. Negative scrolls back */
  step?: number;
  frames?: number;
  /** Allowed difference in px, for subpixel rounding */
  tolerance?: number;
}

export interface PaintMismatch {
  frame: number;
  scrollPosition: number;
  index: number;
  expected: number;
  actual: number;
}

export interface CoverageGap {
  frame: number;
  scrollPosition: number;
  /** Visible range in content coordinates */
  visible: [number, number];
  /** Range covered by the rendered items */
  rendered: [number, number];
}

export interface PaintProbeResult {
  frames: number;
  mismatchedFrames: number;
  mismatches: PaintMismatch[];
  gaps: CoverageGap[];
  /** Highest item index seen, to prove the scroll actually moved through the list */
  maxIndexSeen: number;
}

export const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

export async function waitFrames(count: number): Promise<void> {
  for (let i = 0; i < count; ++i) {
    await nextFrame();
  }
}

export async function scrollAndProbe(options: PaintProbeOptions): Promise<PaintProbeResult> {
  if (document.visibilityState !== 'visible') {
    throw new Error(
      'Document is hidden, so requestAnimationFrame is paused and the probe cannot run',
    );
  }

  const {
    scrollElement,
    origin,
    items,
    expectedOffset,
    itemSize,
    horizontal = false,
    step = 25,
    frames = 120,
    tolerance = 1,
  } = options;
  const scrollProp = horizontal ? 'scrollLeft' : 'scrollTop';
  const isDocument = scrollElement === document.scrollingElement;

  // The visible part of the scroll container, in viewport coordinates
  const visibleEdges = (): [number, number] => {
    if (isDocument) {
      return [0, horizontal ? innerWidth : innerHeight];
    }
    const rect = scrollElement.getBoundingClientRect();
    const start = horizontal
      ? rect.left + scrollElement.clientLeft
      : rect.top + scrollElement.clientTop;
    return [start, start + (horizontal ? scrollElement.clientWidth : scrollElement.clientHeight)];
  };

  const mismatches: PaintMismatch[] = [];
  const gaps: CoverageGap[] = [];
  const badFrames = new Set<number>();
  let frame = 0;
  let sampled = 0;
  let maxIndexSeen = -1;

  const sample = () => {
    ++sampled;
    const originRect = origin.getBoundingClientRect();
    const originEdge = horizontal ? originRect.left : originRect.top;
    let renderedStart = Infinity;
    let renderedEnd = -Infinity;
    for (const item of items()) {
      const index = Number(item.dataset['index']);
      maxIndexSeen = Math.max(maxIndexSeen, index);
      const rect = item.getBoundingClientRect();
      const actual = (horizontal ? rect.left : rect.top) - originEdge;
      const expected = expectedOffset(index);
      if (Math.abs(actual - expected) > tolerance) {
        badFrames.add(frame);
        mismatches.push({
          frame,
          scrollPosition: scrollElement[scrollProp],
          index,
          expected,
          actual,
        });
      }
      if (itemSize) {
        renderedStart = Math.min(renderedStart, expected);
        renderedEnd = Math.max(renderedEnd, expected + itemSize(index));
      }
    }

    if (itemSize) {
      // Clamp the visible range to the content, so the space past the last item doesn't count as a gap
      const contentLength = horizontal ? originRect.width : originRect.height;
      const [viewStart, viewEnd] = visibleEdges();
      const visible: [number, number] = [
        Math.max(0, viewStart - originEdge),
        Math.min(contentLength, viewEnd - originEdge),
      ];
      if (renderedStart > visible[0] + tolerance || renderedEnd < visible[1] - tolerance) {
        badFrames.add(frame);
        gaps.push({
          frame,
          scrollPosition: scrollElement[scrollProp],
          visible,
          rendered: [renderedStart, renderedEnd],
        });
      }
    }
  };

  // ResizeObserver callbacks run after requestAnimationFrame callbacks and layout, right before paint.
  // Resizing a hidden probe element every frame gives one callback per frame.
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:0;top:0;height:1px;width:1px;opacity:0;pointer-events:none';
  document.body.appendChild(probe);
  const observer = new ResizeObserver(sample);
  observer.observe(probe);

  try {
    await new Promise<void>((resolve) => {
      const tick = () => {
        ++frame;
        probe.style.width = frame % 2 ? '2px' : '1px';
        if (frame <= frames) {
          // Scroll from a task between frames, not inside this rAF callback. Then, like a user's scroll, the scroll
          // event fires at the start of the next frame, before that frame's rAF callbacks.
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
      await nextFrame();
    }
  } finally {
    observer.disconnect();
    probe.remove();
  }

  return { frames: sampled, mismatchedFrames: badFrames.size, mismatches, gaps, maxIndexSeen };
}
