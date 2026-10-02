// Paint-consistency probe: checks that the scroller's padding matches the items actually rendered, sampled right
// before each paint, while scrolling programmatically. A mismatched frame is drawn with the rows shifted (the
// zoneless "row jump"). Paste into DevTools (or run through Claude in Chrome) on a dev build of the app, since it
// needs the `ng` debug global. The result is the value of the last expression.
//
// Defaults target Kavita's card-detail-layout (e.g. /library/1). For another page, change the options below.
await (async ({
  scrollerSelector = 'virtual-scroller',
  // Element whose children are the rendered items (the scroller's #container, or .scrollable-content)
  containerSelector = '#card-detail-layout-items-container',
  // Maps a rendered item element to its index in scroller.items
  indexOf = (el, scroller) => {
    const card = el.querySelector('app-series-card');
    if (!card) return -1;
    const c = ng.getComponent(card);
    const s = typeof c.series === 'function' ? c.series() : c.series;
    return scroller.items.findIndex((x) => x.id === s.id);
  },
  pixelsPerFrame = 40,
  frames = 150,
} = {}) => {
  const vs = document.querySelector(scrollerSelector);
  const scroller = ng.getComponent(vs);
  const content = vs.querySelector('.scrollable-content');
  const container = vs.querySelector(containerSelector) ?? content;
  const scrollElement = scroller.getScrollElement();
  const vertical = !scroller.horizontal;
  const prop = vertical ? 'scrollTop' : 'scrollLeft';

  const appliedPadding = () => {
    if (scroller.useMarginInsteadOfTranslate) return parseFloat(content.style[vertical ? 'marginTop' : 'marginLeft']) || 0;
    const m = /translate[XY]\((-?[\d.]+)px\)/.exec(content.style.transform);
    return m ? +m[1] : 0;
  };

  scrollElement[prop] = 0;
  await new Promise((r) => setTimeout(r, 500));

  const log = [];
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;height:1px;opacity:0;pointer-events:none';
  document.body.appendChild(probe);
  let running = true;
  let toggle = false;
  // ResizeObserver callbacks run after rAF callbacks and layout, right before paint
  const ro = new ResizeObserver(() => {
    const first = container.firstElementChild;
    const index = first ? indexOf(first, scroller) : -1;
    const expected = index >= 0 ? scroller.calculatePadding(index, scroller.calculateDimensions()) : null;
    const applied = appliedPadding();
    log.push({ position: scrollElement[prop], index, applied, expected, bad: expected !== null && Math.abs(applied - expected) > 1 });
  });
  ro.observe(probe);
  const tick = () => {
    if (!running) return;
    toggle = !toggle;
    probe.style.width = toggle ? '2px' : '1px';
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  let n = 0;
  await new Promise((resolve) => {
    const step = () => {
      scrollElement[prop] += pixelsPerFrame;
      if (++n < frames) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
  await new Promise((r) => setTimeout(r, 500));
  running = false;
  ro.disconnect();
  probe.remove();

  const bad = log.filter((e) => e.bad);
  return { frames: log.length, mismatchedFrames: bad.length, firstMismatches: bad.slice(0, 5) };
})();
