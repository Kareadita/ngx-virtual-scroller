import { expect, Page, test } from '@playwright/test';
import { jumpProbe, JumpProbeOptions, JumpProbeResult } from './jump-probe';

interface Scenario {
  path: string;
  /** See JumpProbeOptions.scrollRoot */
  scrollRoot?: string;
  horizontal?: boolean;
  /** See JumpProbeOptions.spacing */
  spacing?: number;
}

const PARENT = '[data-scroll-root]';

/** Every demo page. The nav test below fails when a page is added without an entry here. */
const SCENARIOS: Scenario[] = [
  { path: 'list' },
  { path: 'grid', spacing: 16 },
  { path: 'horizontal', horizontal: true, spacing: 12 },
  { path: 'table' },
  { path: 'unequal' },
  { path: 'margins', spacing: 8 },
  { path: 'escaping-margin', spacing: 18 },
  { path: 'images' },
  { path: 'parent-scroll', scrollRoot: PARENT },
  { path: 'window-scroll', scrollRoot: 'window' },
  { path: 'tabs', scrollRoot: PARENT, spacing: 8 },
  { path: 'hover-scroll', scrollRoot: PARENT },
  { path: 'load-more' },
];

const scenario = (path: string) => SCENARIOS.find((s) => s.path === path)!;

async function open(page: Page, path: string): Promise<void> {
  await page.goto(`/${path}`);
  await expect(page.locator('virtual-scroller [data-index]').first()).toBeVisible();
  // Let the scroller's measuring passes settle
  await page.waitForTimeout(300);
}

/** Item count from the page's status line ("Showing a–b of N · k rendered") */
async function itemCount(page: Page): Promise<number> {
  const status = await page.getByTestId('status').textContent();
  return Number(/of (\d+)/.exec(status ?? '')![1]);
}

function probe(
  page: Page,
  s: Scenario,
  options: Pick<JumpProbeOptions, 'step' | 'frames' | 'lastId'>,
): Promise<JumpProbeResult> {
  return page.evaluate(jumpProbe, {
    scrollRoot: s.scrollRoot ?? null,
    horizontal: !!s.horizontal,
    spacing: s.spacing ?? 0,
    ...options,
  });
}

/** Asserts a clean probe, and that it really compared frames rather than passing vacuously */
function expectClean(result: JumpProbeResult, label: string): void {
  expect(result.jumps.slice(0, 3), `${label}: items moved by exactly the scroll delta`).toEqual([]);
  expect(result.gaps.slice(0, 3), `${label}: rendered items cover the viewport`).toEqual([]);
  expect(result.comparedFrames, `${label}: frames with items to compare`).toBeGreaterThan(
    result.samples * 0.8,
  );
}

/** Scrolls down then back up, checking every frame, and that only a window of the items is rendered */
async function scrollBothWays(page: Page, s: Scenario, count: number): Promise<void> {
  const lastId = count - 1;
  const atRest = await probe(page, s, { step: 0, frames: 2, lastId });
  expect(atRest.gaps, 'covered at rest').toEqual([]);

  const down = await probe(page, s, { step: 50, frames: 150, lastId });
  expectClean(down, 'scrolling down');
  expect(down.scrollEnd - down.scrollStart, 'the scroll moved').toBeGreaterThan(2000);
  expect(down.maxId, 'new items rendered').toBeGreaterThan(atRest.maxId + 10);
  expect(down.maxRendered, 'only a window of items is rendered').toBeLessThan(count / 2);

  const up = await probe(page, s, { step: -50, frames: 150, lastId });
  expectClean(up, 'scrolling up');
  expect(up.minId, 'earlier items rendered again').toBeLessThan(down.maxId - 10);
}

test('every demo page has an e2e scenario', async ({ page }) => {
  await page.goto('/');
  const paths = await page
    .locator('nav [data-scenario]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('data-scenario')));
  expect(paths.sort()).toEqual(SCENARIOS.map((s) => s.path).sort());
});

for (const throttle of [1, 4]) {
  test.describe(throttle === 1 ? 'scrolling' : `scrolling, CPU throttled ${throttle}x`, () => {
    test.beforeEach(async ({ page }) => {
      if (throttle > 1) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
      }
    });

    for (const s of SCENARIOS) {
      test(`${s.path}: items stay in place and cover the viewport`, async ({ page }) => {
        await open(page, s.path);
        // The tabs page has no status line: its first tab has 1000 items
        const count = s.path === 'tabs' ? 1000 : await itemCount(page);
        await scrollBothWays(page, s, s.path === 'load-more' ? 1000 : count);
      });
    }
  });
}

test.describe('smoke', () => {
  /** Positions of the scroll element's visible start and of an item's leading and trailing edges */
  const edges = (page: Page, s: Scenario, id: number) =>
    page.evaluate(
      ({ scrollRoot, horizontal, id }) => {
        const scroller = [...document.querySelectorAll<HTMLElement>('virtual-scroller')].find(
          (element) => element.offsetParent !== null,
        )!;
        const root =
          scrollRoot === 'window'
            ? null
            : scrollRoot
              ? document.querySelector(scrollRoot)!
              : scroller;
        const rootRect = root?.getBoundingClientRect();
        const viewStart = root
          ? horizontal
            ? rootRect!.left + root.clientLeft
            : rootRect!.top + root.clientTop
          : 0;
        const viewEnd =
          viewStart +
          (root
            ? horizontal
              ? root.clientWidth
              : root.clientHeight
            : horizontal
              ? innerWidth
              : innerHeight);
        const item = scroller.querySelector(`[data-index="${id}"]`)?.getBoundingClientRect();
        return {
          viewStart,
          viewEnd,
          itemStart: item && (horizontal ? item.left : item.top),
          itemEnd: item && (horizontal ? item.right : item.bottom),
        };
      },
      { scrollRoot: s.scrollRoot ?? null, horizontal: !!s.horizontal, id },
    );

  for (const path of ['list', 'grid', 'horizontal', 'table', 'parent-scroll', 'window-scroll']) {
    test(`${path}: scrollToIndex puts the item at the start of the viewport`, async ({ page }) => {
      const s = scenario(path);
      await open(page, path);
      await page.getByTestId('scroll-to-index').fill('500');
      await page.getByRole('button', { name: 'Scroll to' }).click();
      await expect
        .poll(async () => {
          const { viewStart, itemStart } = await edges(page, s, 500);
          return itemStart === undefined ? undefined : Math.round(itemStart - viewStart) + 0;
        })
        // The grid's container has 12px of padding above its first row
        .toBe(path === 'grid' ? 12 : 0);
    });
  }

  for (const s of SCENARIOS.filter((s) => !['load-more', 'tabs'].includes(s.path))) {
    test(`${s.path}: scrolling to the end renders the last item at its true position`, async ({
      page,
    }) => {
      await open(page, s.path);
      const lastId = (await itemCount(page)) - 1;
      const jumpToEnd = () =>
        page.evaluate(
          ({ scrollRoot, horizontal }) => {
            const scroller = [...document.querySelectorAll<HTMLElement>('virtual-scroller')].find(
              (element) => element.offsetParent !== null,
            )!;
            const root =
              scrollRoot === 'window'
                ? document.scrollingElement!
                : scrollRoot
                  ? document.querySelector(scrollRoot)!
                  : scroller;
            root[horizontal ? 'scrollLeft' : 'scrollTop'] = 1e9;
          },
          { scrollRoot: s.scrollRoot ?? null, horizontal: !!s.horizontal },
        );
      // With equal sizes the scroll length is exact once the first rows are measured, so one jump reaches the end.
      // With unequal sizes it's an estimate from the sizes seen so far, which grows as the items near the end are
      // measured, so it takes a few jumps, like a user who keeps scrolling.
      const jumps = s.path === 'unequal' ? 5 : 1;
      for (let i = 0; i < jumps && (await edges(page, s, lastId)).itemEnd === undefined; ++i) {
        await jumpToEnd();
        await page.waitForTimeout(300);
      }
      await expect.poll(async () => (await edges(page, s, lastId)).itemEnd).toBeDefined();
      await page.waitForTimeout(300);

      // .total-padding spans the scroller's estimate of the content length. With a wrong item size (an unmeasured gap
      // or margin, a size that changed after measuring) the last item ends far from it, by a little per item. A
      // correct one ends within a header or a margin of it.
      const mismatch = await page.evaluate(
        ({ horizontal, lastId }) => {
          const scroller = [...document.querySelectorAll<HTMLElement>('virtual-scroller')].find(
            (element) => element.offsetParent !== null,
          )!;
          const padding = scroller.querySelector('.total-padding')!.getBoundingClientRect();
          const last = scroller.querySelector(`[data-index="${lastId}"]`)!.getBoundingClientRect();
          return horizontal ? last.right - padding.right : last.bottom - padding.bottom;
        },
        { horizontal: !!s.horizontal, lastId },
      );
      expect(Math.abs(mismatch), 'last item ends where the scroll length says').toBeLessThan(60);

      const result = await probe(page, s, { step: -30, frames: 30, lastId });
      if (s.path === 'unequal') {
        // Scrolling back into items never measured shifts them; see the fixme below
        expect(result.gaps.slice(0, 3), 'rendered items cover the viewport').toEqual([]);
      } else {
        expectClean(result, 'back from the end');
      }
    });
  }

  // Known limitation (F25), not a regression. After jumping past items whose sizes were never measured, their space
  // is estimated from the average size. Scrolling back up renders them, the real sizes replace the estimate, and the
  // items below shift by the difference. Fixing it needs scroll anchoring in unequal mode.
  test.fixme('unequal: scrolling back up through items never measured keeps them in place', () => {});

  test('grid: resizing the window changes the columns and keeps the viewport covered', async ({
    page,
  }) => {
    const s = scenario('grid');
    await page.setViewportSize({ width: 1400, height: 900 });
    await open(page, 'grid');
    const lastId = (await itemCount(page)) - 1;
    await probe(page, s, { step: 50, frames: 40, lastId });
    const columnsAt = () =>
      page.evaluate(
        () =>
          getComputedStyle(document.querySelector('.grid')!).gridTemplateColumns.split(' ').length,
      );
    const wide = await columnsAt();

    await page.setViewportSize({ width: 700, height: 600 });
    await page.waitForTimeout(500);
    expect(await columnsAt()).toBeLessThan(wide);
    const after = await probe(page, s, { step: 50, frames: 80, lastId });
    expectClean(after, 'after the resize');
  });

  test('tabs: a tab shown after its scroll parent moved renders the right slice', async ({
    page,
  }) => {
    const s = scenario('tabs');
    await open(page, 'tabs');
    await probe(page, s, { step: 60, frames: 60, lastId: 999 });

    for (const [tab, count] of [
      ['chapters', 2500],
      ['volumes', 400],
    ] as const) {
      await page.locator(`[data-tab="${tab}"]`).click();
      await page.waitForTimeout(300);
      const shown = await probe(page, s, { step: 0, frames: 2, lastId: count - 1 });
      expect(shown.gaps, `${tab}: covered once shown`).toEqual([]);
      expect(shown.maxRendered, `${tab}: only a window rendered`).toBeLessThan(count / 2);
      const scrolled = await probe(page, s, { step: 50, frames: 60, lastId: count - 1 });
      expectClean(scrolled, `${tab}: scrolling`);
    }
  });

  test('hover-scroll: a real wheel scroll over the hover-only parent', async ({ page }) => {
    const s = scenario('hover-scroll');
    await open(page, 'hover-scroll');
    const root = page.locator(PARENT);
    await root.hover();
    for (let i = 0; i < 10; ++i) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(300);
    expect(await root.evaluate((element) => element.scrollTop)).toBeGreaterThan(1500);
    const result = await probe(page, s, { step: 0, frames: 2, lastId: 4999 });
    expect(result.gaps).toEqual([]);
    expect(result.minId).toBeGreaterThan(20);
  });

  test('load-more: reaching the end loads the next page', async ({ page }) => {
    await open(page, 'load-more');
    expect(await itemCount(page)).toBe(40);
    for (let i = 0; i < 4; ++i) {
      await page.locator('virtual-scroller').evaluate((element) => (element.scrollTop = 1e9));
      await expect.poll(() => itemCount(page)).toBe(80 + i * 40);
    }
    const ids = await page
      .locator('virtual-scroller [data-index]')
      .evaluateAll((items) => items.map((item) => Number(item.getAttribute('data-index'))));
    expect(ids).toEqual(Array.from({ length: ids.length }, (_, i) => ids[0] + i));
  });
});
