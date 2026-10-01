import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VirtualScrollerModule } from './ngx-virtual-scroller.module';
import { scrollAndProbe, waitFrames } from '../testing/paint-probe';

type Layout = 'grid' | 'list' | 'horizontal' | 'window';

const COLUMNS = 4;
const ROW_HEIGHT = 50;
const LIST_HEIGHT = 40;
const ITEM_WIDTH = 80;
const unequalHeight = (i: number) => 30 + (i % 5) * 10;

@Component({
  selector: 'vs-paint-host',
  imports: [VirtualScrollerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .vs { display: block; width: 400px; height: 300px; }
    .vs.horizontal { height: 120px; }
    .vs.window { height: auto; }
    .grid { display: grid; grid-template-columns: repeat(${COLUMNS}, 100px); }
    .item { box-sizing: border-box; overflow: hidden; }
  `,
  template: `
    @switch (layout()) {
      @case ('grid') {
        <virtual-scroller #scroll class="vs" [items]="items()" [bufferAmount]="1">
          <div #container class="grid">
            @for (item of scroll.viewPortItems; track item) {
              <div class="item" [attr.data-index]="item" [style.height.px]="${ROW_HEIGHT}">{{ item }}</div>
            }
          </div>
        </virtual-scroller>
      }
      @case ('horizontal') {
        <virtual-scroller #scroll class="vs" [items]="items()" [horizontal]="true">
          @for (item of scroll.viewPortItems; track item) {
            <div class="item" [attr.data-index]="item" [style.width.px]="${ITEM_WIDTH}" [style.height.px]="100">{{ item }}</div>
          }
        </virtual-scroller>
      }
      @case ('window') {
        <virtual-scroller #scroll class="vs window" [items]="items()" [parentScroll]="scroll.window">
          @for (item of scroll.viewPortItems; track item) {
            <div class="item" [attr.data-index]="item" [style.height.px]="${LIST_HEIGHT}">{{ item }}</div>
          }
        </virtual-scroller>
      }
      @default {
        <virtual-scroller #scroll class="vs" [items]="items()"
          [useMarginInsteadOfTranslate]="useMargin()" [enableUnequalChildrenSizes]="unequal()" [stripedTable]="striped()">
          @for (item of scroll.viewPortItems; track item) {
            <div class="item" [attr.data-index]="item" [style.height.px]="unequal() ? unequalHeight(item) : ${LIST_HEIGHT}">{{ item }}</div>
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
  readonly unequalHeight = unequalHeight;
}

interface Scenario {
  name: string;
  layout: Layout;
  useMargin?: boolean;
  unequal?: boolean;
  striped?: boolean;
  expectedOffset: (index: number) => number;
}

const unequalOffsets: number[] = [0];
for (let i = 1; i <= 2000; ++i) {
  unequalOffsets[i] = unequalOffsets[i - 1] + unequalHeight(i - 1);
}

const scenarios: Scenario[] = [
  { name: 'multi-column grid (#container)', layout: 'grid', expectedOffset: (i) => Math.floor(i / COLUMNS) * ROW_HEIGHT },
  { name: 'vertical list (translate)', layout: 'list', expectedOffset: (i) => i * LIST_HEIGHT },
  { name: 'vertical list (margin)', layout: 'list', useMargin: true, expectedOffset: (i) => i * LIST_HEIGHT },
  { name: 'vertical list (striped table)', layout: 'list', striped: true, expectedOffset: (i) => i * LIST_HEIGHT },
  { name: 'vertical list (unequal sizes)', layout: 'list', unequal: true, expectedOffset: (i) => unequalOffsets[i] },
  { name: 'horizontal list', layout: 'horizontal', expectedOffset: (i) => i * ITEM_WIDTH },
  { name: 'parentScroll = window', layout: 'window', expectedOffset: (i) => i * LIST_HEIGHT },
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
      host.striped.set(!!scenario.striped);
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
        horizontal,
      };

      const down = await scrollAndProbe({ ...probe, step: 25 });
      const up = await scrollAndProbe({ ...probe, step: -25 });

      expect(probe.items().length, 'only a window of items is rendered').toBeLessThan(100);
      expect(down.maxIndexSeen, 'the scroll moved through the list').toBeGreaterThan(40);
      expect(down.mismatches.slice(0, 5), 'scrolling down').toEqual([]);
      expect(up.mismatches.slice(0, 5), 'scrolling up').toEqual([]);
    });
  }
});
