import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VirtualScrollerModule } from './ngx-virtual-scroller.module';
import { scrollAndProbe, waitFrames } from '../testing/paint-probe';

type Layout = 'grid' | 'list' | 'horizontal' | 'window';

const COLUMNS = 4;
const ROW_HEIGHT = 50;
const LIST_HEIGHT = 40;
const ITEM_WIDTH = 80;
const unequalHeight = (i: number) => 30 + (i % 5) * 10;
// The demo's unequal page: bigger differences between neighbours, so a size cached for the wrong item shows
const steppedHeight = (i: number) => 40 + ((i * 7) % 5) * 18;

@Component({
  selector: 'vs-paint-host',
  imports: [VirtualScrollerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .vs {
      display: block;
      width: 400px;
      height: 300px;
    }
    .vs.horizontal {
      height: 120px;
    }
    .vs.window {
      height: auto;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(${COLUMNS}, 100px);
    }
    .item {
      box-sizing: border-box;
      overflow: hidden;
    }
  `,
  template: `
    @switch (layout()) {
      @case ('grid') {
        <virtual-scroller #scroll class="vs" [items]="items()" [bufferAmount]="1">
          <div #container class="grid" [style.row-gap.px]="gridGap()">
            @for (item of scroll.viewPortItems; track item) {
              <div class="item" [attr.data-index]="item" [style.height.px]="rowHeight">
                {{ item }}
              </div>
            }
          </div>
        </virtual-scroller>
      }
      @case ('horizontal') {
        <virtual-scroller #scroll class="vs" [items]="items()" [horizontal]="true">
          @for (item of scroll.viewPortItems; track item) {
            <div
              class="item"
              [attr.data-index]="item"
              [style.width.px]="itemWidth"
              [style.height.px]="100"
            >
              {{ item }}
            </div>
          }
        </virtual-scroller>
      }
      @case ('window') {
        <virtual-scroller
          #scroll
          class="vs window"
          [items]="items()"
          [parentScroll]="scroll.window"
        >
          @for (item of scroll.viewPortItems; track item) {
            <div class="item" [attr.data-index]="item" [style.height.px]="listHeight">
              {{ item }}
            </div>
          }
        </virtual-scroller>
      }
      @default {
        <virtual-scroller
          #scroll
          class="vs"
          [items]="items()"
          [useMarginInsteadOfTranslate]="useMargin()"
          [enableUnequalChildrenSizes]="unequal()"
          [stripedTable]="striped()"
        >
          @for (item of scroll.viewPortItems; track item) {
            <div
              class="item"
              [attr.data-index]="item"
              [style.height.px]="unequal() ? heightOf()(item) : listHeight"
              [style.margin-top.px]="itemMargin()"
              [style.margin-bottom.px]="itemMargin()"
            >
              {{ item }}
            </div>
          }
        </virtual-scroller>
      }
    }
  `,
})
class PaintHost {
  readonly layout = signal<Layout>('list');
  readonly items = signal(Array.from({ length: 2000 }, (_, i) => i));
  readonly useMargin = signal(false);
  readonly unequal = signal(false);
  readonly striped = signal(false);
  readonly itemMargin = signal(0);
  readonly gridGap = signal(0);
  readonly heightOf = signal(unequalHeight);
  readonly rowHeight = ROW_HEIGHT;
  readonly listHeight = LIST_HEIGHT;
  readonly itemWidth = ITEM_WIDTH;
}

interface Scenario {
  name: string;
  layout: Layout;
  useMargin?: boolean;
  unequal?: boolean;
  /** Item height in unequal mode; defaults to unequalHeight */
  heightOf?: (index: number) => number;
  striped?: boolean;
  itemMargin?: number;
  gridGap?: number;
  /** Space between items that no item covers, allowed at the viewport edges */
  spacing?: number;
  /** Pixels scrolled per frame; defaults to 25 */
  step?: number;
  expectedOffset: (index: number) => number;
  itemSize: (index: number) => number;
}

const offsetsOf = (height: (index: number) => number) => {
  const offsets = [0];
  for (let i = 1; i <= 2000; ++i) {
    offsets[i] = offsets[i - 1] + height(i - 1);
  }
  return offsets;
};
const unequalOffsets = offsetsOf(unequalHeight);
const steppedOffsets = offsetsOf(steppedHeight);

const ITEM_MARGIN = 5;
const GRID_GAP = 10;

const scenarios: Scenario[] = [
  {
    name: 'multi-column grid (#container)',
    layout: 'grid',
    expectedOffset: (i) => Math.floor(i / COLUMNS) * ROW_HEIGHT,
    itemSize: () => ROW_HEIGHT,
  },
  {
    // Row gaps are space between items that no item's box includes
    name: 'multi-column grid with a row gap',
    layout: 'grid',
    gridGap: GRID_GAP,
    spacing: GRID_GAP,
    expectedOffset: (i) => Math.floor(i / COLUMNS) * (ROW_HEIGHT + GRID_GAP),
    itemSize: () => ROW_HEIGHT,
  },
  {
    // Adjacent vertical margins collapse, so items sit height + margin apart, not height + 2 * margin
    name: 'vertical list (collapsing item margins)',
    layout: 'list',
    itemMargin: ITEM_MARGIN,
    spacing: ITEM_MARGIN,
    expectedOffset: (i) => ITEM_MARGIN + i * (LIST_HEIGHT + ITEM_MARGIN),
    itemSize: () => LIST_HEIGHT,
  },
  {
    name: 'vertical list (translate)',
    layout: 'list',
    expectedOffset: (i) => i * LIST_HEIGHT,
    itemSize: () => LIST_HEIGHT,
  },
  {
    name: 'vertical list (margin)',
    layout: 'list',
    useMargin: true,
    expectedOffset: (i) => i * LIST_HEIGHT,
    itemSize: () => LIST_HEIGHT,
  },
  {
    name: 'vertical list (striped table)',
    layout: 'list',
    striped: true,
    expectedOffset: (i) => i * LIST_HEIGHT,
    itemSize: () => LIST_HEIGHT,
  },
  {
    name: 'vertical list (unequal sizes)',
    layout: 'list',
    unequal: true,
    expectedOffset: (i) => unequalOffsets[i],
    itemSize: unequalHeight,
  },
  {
    // Neighbours differ by up to 72px and the scroll moves more than an item per frame
    name: 'vertical list (unequal sizes, large steps)',
    layout: 'list',
    unequal: true,
    heightOf: steppedHeight,
    step: 50,
    expectedOffset: (i) => steppedOffsets[i],
    itemSize: steppedHeight,
  },
  {
    name: 'horizontal list',
    layout: 'horizontal',
    expectedOffset: (i) => i * ITEM_WIDTH,
    itemSize: () => ITEM_WIDTH,
  },
  {
    name: 'parentScroll = window',
    layout: 'window',
    expectedOffset: (i) => i * LIST_HEIGHT,
    itemSize: () => LIST_HEIGHT,
  },
];

describe('paint consistency (zoneless)', () => {
  let fixture: ComponentFixture<PaintHost>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    fixture?.destroy();
    document.documentElement.style.height = '';
    document.scrollingElement!.scrollTop = 0;
  });

  for (const scenario of scenarios) {
    it(`paints items at their true position while scrolling: ${scenario.name}`, async () => {
      if (scenario.layout === 'window') {
        // Window mode measures document.scrollingElement, which is only viewport-sized when the page constrains <html>
        document.documentElement.style.height = '100%';
      }
      fixture = TestBed.createComponent(PaintHost);
      const host = fixture.componentInstance;
      host.layout.set(scenario.layout);
      host.useMargin.set(!!scenario.useMargin);
      host.unequal.set(!!scenario.unequal);
      host.heightOf.set(scenario.heightOf ?? unequalHeight);
      host.striped.set(!!scenario.striped);
      host.itemMargin.set(scenario.itemMargin ?? 0);
      host.gridGap.set(scenario.gridGap ?? 0);
      await fixture.whenStable();
      await waitFrames(10);

      const scroller: HTMLElement = fixture.nativeElement.querySelector('virtual-scroller');
      const horizontal = scenario.layout === 'horizontal';
      const scrollElement = scenario.layout === 'window' ? document.scrollingElement! : scroller;
      const probe = {
        scrollElement,
        origin: scroller.querySelector('.total-padding')!,
        items: () => scroller.querySelectorAll<HTMLElement>('[data-index]'),
        expectedOffset: scenario.expectedOffset,
        itemSize: scenario.itemSize,
        coverageTolerance: 1 + (scenario.spacing ?? 0),
        horizontal,
      };

      const step = scenario.step ?? 25;
      const down = await scrollAndProbe({ ...probe, step });
      const up = await scrollAndProbe({ ...probe, step: -step });

      expect(probe.items().length, 'only a window of items is rendered').toBeLessThan(100);
      expect(down.maxIndexSeen, 'the scroll moved through the list').toBeGreaterThan(40);
      expect(down.mismatches.slice(0, 5), 'scrolling down').toEqual([]);
      expect(up.mismatches.slice(0, 5), 'scrolling up').toEqual([]);
      expect(down.gaps.slice(0, 5), 'visible range covered scrolling down').toEqual([]);
      expect(up.gaps.slice(0, 5), 'visible range covered scrolling up').toEqual([]);
    });
  }
});
