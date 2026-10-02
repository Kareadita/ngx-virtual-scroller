// Kavita test probes for the virtual scroller. Paste into DevTools, or run with Claude in Chrome's javascript tool, on a
// Kavita dev build (needs the `ng` debug global). Defines window.__vs helpers, then use, for example:
//
//   await __vs.check('library grid')                  // the visible scroller on the current page
//   await __vs.go('/lists/34'); await __vs.check('reading list')
//
// check() scrolls the visible scroller's real scroll element down then up, sampling right before each paint, and reports
// jump frames: frames where an item that is on screen in both samples did not move by exactly the scroll delta. That is
// what a user sees as rows jumping, and it doesn't depend on the scroller's own math. 0 is the expected result.
//
// The page must stay visible the whole time (document.visibilityState === 'visible'): Chrome pauses
// requestAnimationFrame in hidden or fully covered windows, and every helper here depends on it.
window.__vs = (() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const visibleScroller = () => [...document.querySelectorAll('virtual-scroller')].find((v) => v.offsetParent);

  // Moves items with the scroll exactly, or it's a jump. Keys items by their @for / ngTemplateOutlet $implicit
  const jumpProbe = async (vs, scrollEl, step, frames) => {
    const s = ng.getComponent(vs);
    const container = s.getItemsContainer();
    const positions = () => {
      const m = new Map();
      for (const k of container.children) {
        let item;
        try {
          item = ng.getContext(k)?.$implicit;
        } catch {}
        if (item !== undefined) m.set(item, k.getBoundingClientRect().top);
      }
      return m;
    };
    let prev = null;
    let prevScroll = 0;
    let samples = 0;
    const jumps = [];
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(probe);
    // ResizeObserver callbacks run after rAF callbacks and layout, right before paint
    const ro = new ResizeObserver(() => {
      const cur = positions();
      const scroll = scrollEl.scrollTop;
      ++samples;
      if (prev) {
        const dScroll = scroll - prevScroll;
        for (const [item, top] of cur) {
          if (prev.has(item)) {
            const dTop = top - prev.get(item);
            if (Math.abs(dTop + dScroll) > 1.5) {
              jumps.push({ index: s.items.indexOf(item), dTop: Math.round(dTop), dScroll: Math.round(dScroll) });
              break;
            }
          }
        }
      }
      prev = cur;
      prevScroll = scroll;
    });
    ro.observe(probe);
    let n = 0;
    let toggle = false;
    await new Promise((resolve) => {
      const loop = () => {
        toggle = !toggle;
        probe.style.width = toggle ? '2px' : '1px';
        if (n++ < frames) {
          // Scroll from a task between frames, so the scroll event fires before the next frame's rAF, like a user's
          setTimeout(() => (scrollEl.scrollTop += step));
          requestAnimationFrame(loop);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(loop);
    });
    await sleep(400);
    ro.disconnect();
    probe.remove();
    return { samples, jumpFrames: jumps.length, firstJumps: jumps.slice(0, 3), scrollTop: Math.round(scrollEl.scrollTop) };
  };

  // In-app navigation. A full reload (or the browser tool's navigate) tends to leave the tab hidden; this doesn't
  const go = async (url) => {
    history.pushState({}, '', url);
    dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      const vs = visibleScroller();
      if (vs && ng.getComponent(vs).items.length) break;
    }
    await sleep(1500);
  };

  const check = async (label, step = 60, frames = 150) => {
    if (document.visibilityState !== 'visible') throw new Error('Tab is hidden; bring the Chrome window to the front');
    const vs = visibleScroller();
    const s = ng.getComponent(vs);
    const el = s.getScrollElement();
    el.scrollTop = 0;
    await sleep(500);
    const down = await jumpProbe(vs, el, step, frames);
    const up = await jumpProbe(vs, el, -step, frames);
    return {
      label,
      items: s.items.length,
      rendered: s.getItemsContainer().children.length,
      pitch: s.measuredScrollPitch && Math.round(s.measuredScrollPitch * 10) / 10,
      down,
      up,
    };
  };

  // Clicks a Kavita nav tab by its label prefix (series detail: Storyline, Volumes, Chapters, Specials, ...)
  const tab = async (name) => {
    [...document.querySelectorAll('.nav-link')].find((t) => t.textContent.trim().startsWith(name)).click();
    await sleep(1500);
  };

  // Rendered vs total for every scroller on the page, visible or not
  const describe = () =>
    [...document.querySelectorAll('virtual-scroller')].map((vs) => {
      const s = ng.getComponent(vs);
      return {
        visible: !!vs.offsetParent,
        owner: ng.getOwningComponent(vs)?.constructor.name,
        items: s.items.length,
        rendered: s.getItemsContainer().children.length,
        range: [s.viewPortInfo.startIndexWithBuffer, s.viewPortInfo.endIndexWithBuffer],
        parent: s.parentScroll ? String(s.parentScroll.className || s.parentScroll.tagName).slice(0, 40) : 'self',
        pitch: s.measuredScrollPitch,
        minHeight: s.minMeasuredChildHeight,
      };
    });

  return { jumpProbe, go, check, tab, describe };
})();
