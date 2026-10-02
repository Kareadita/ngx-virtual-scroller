import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  signal,
  viewChild,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VirtualScrollerComponent } from './ngx-virtual-scroller.component';
import { VirtualScrollerModule } from './ngx-virtual-scroller.module';
import { waitFrames } from '../testing/paint-probe';

const ITEM_HEIGHT = 40;
const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);

@Component({
  selector: 'vs-behavior-host',
  imports: [VirtualScrollerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    virtual-scroller {
      display: block;
      width: 300px;
    }
    .item {
      box-sizing: border-box;
      height: ${ITEM_HEIGHT}px;
    }
  `,
  template: `
    <span class="max-scroll">{{ scroll.viewPortInfo.maxScrollPosition }}</span>
    <virtual-scroller #scroll [items]="items()" [style.height.px]="height()">
      @for (item of scroll.viewPortItems; track item) {
        <div class="item" [attr.data-index]="item">{{ item }}</div>
      }
    </virtual-scroller>
  `,
})
class BehaviorHost {
  readonly items = signal(range(0, 1000));
  readonly height = signal(300);
  readonly scroller = viewChild.required(VirtualScrollerComponent);
}

describe('VirtualScrollerComponent behavior (zoneless)', () => {
  let fixture: ComponentFixture<BehaviorHost>;
  let host: BehaviorHost;
  let element: HTMLElement;

  const settle = async () => {
    await fixture.whenStable();
    await waitFrames(10);
    await fixture.whenStable();
  };
  const scrollerElement = () => element.querySelector<HTMLElement>('virtual-scroller')!;
  const renderedIndexes = () =>
    Array.from(element.querySelectorAll<HTMLElement>('[data-index]'), (el) =>
      Number(el.dataset['index']),
    );
  // The first item whose bottom edge is below the top of the viewport
  const firstVisibleIndex = () => {
    const top = scrollerElement().getBoundingClientRect().top;
    const visible = Array.from(element.querySelectorAll<HTMLElement>('[data-index]')).find(
      (el) => el.getBoundingClientRect().bottom > top + 1,
    );
    return Number(visible!.dataset['index']);
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(BehaviorHost);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    await settle();
  });

  afterEach(() => fixture.destroy());

  it('renders only the items around the viewport', () => {
    const rendered = renderedIndexes();

    expect(rendered[0]).toBe(0);
    expect(rendered.length).toBeGreaterThanOrEqual(300 / ITEM_HEIGHT);
    expect(rendered.length).toBeLessThan(20);
  });

  it('scrolls to an index in the middle and at the end', async () => {
    host.scroller().scrollToIndex(500, true, 0, 0);
    await settle();
    expect(firstVisibleIndex()).toBe(500);

    host.scroller().scrollToIndex(999, true, 0, 0);
    await settle();
    expect(renderedIndexes()).toContain(999);
    expect(scrollerElement().scrollTop).toBe(
      scrollerElement().scrollHeight - scrollerElement().clientHeight,
    );
  });

  it('animates scrollToIndex and calls the completion callback once it arrives', async () => {
    let completed = false;
    host.scroller().scrollToIndex(200, true, 0, 150, () => (completed = true));
    await waitFrames(2);
    expect(completed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 600));
    await settle();
    expect(completed).toBe(true);
    expect(firstVisibleIndex()).toBe(200);
  });

  it('scrollInto scrolls to the given item', async () => {
    host.scroller().scrollInto(host.items()[321], true, 0, 0);
    await settle();

    expect(firstVisibleIndex()).toBe(321);
  });

  it('keeps the same items visible when items are prepended', async () => {
    host.scroller().scrollToIndex(500, true, 0, 0);
    await settle();
    expect(firstVisibleIndex()).toBe(500);

    host.items.set([...range(-10, 10), ...host.items()]);
    await settle();

    expect(firstVisibleIndex()).toBe(500);
  });

  it('renders the new items when the items array is replaced', async () => {
    host.items.set(range(5000, 50));
    await settle();

    expect(renderedIndexes()[0]).toBe(5000);
    expect(host.scroller().viewPortItems[0]).toBe(5000);
  });

  it('refreshes when the scroll container is resized', async () => {
    const before = renderedIndexes().length;

    host.height.set(600);
    await settle();

    expect(renderedIndexes().length).toBeGreaterThan(before);
  });

  // F2: zoneless OnPush templates must see viewPortInfo changes even when the rendered slice stays the same
  it('updates templates bound to viewPortInfo when only the scroll metrics change', async () => {
    const maxScroll = () => Number(element.querySelector('.max-scroll')!.textContent);
    const initial = maxScroll();
    expect(initial).toBe(host.scroller().viewPortInfo.maxScrollPosition);

    // 300px -> 310px keeps ceil(height / 40) = 8 items per page, so start and end stay put
    host.height.set(310);
    await settle();

    expect(host.scroller().viewPortInfo.maxScrollPosition).toBe(initial - 10);
    expect(maxScroll()).toBe(initial - 10);
  });
});
