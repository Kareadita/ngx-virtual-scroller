import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  signal,
  viewChild,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VirtualScrollerComponent } from './ngx-virtual-scroller.component';
import { waitFrames } from '../testing/paint-probe';

const ITEM_HEIGHT = 40;
const PARENT_BORDER = 7;
const HOST_BORDER = 3;

/**
 * A list below other content in a scroll parent, where both the parent and the scroller have borders and the scroller
 * has a margin. Scroll positions are relative to the parent's padding box and items are laid out inside the scroller's
 * padding box, so none of these may shift where the scroller thinks its items are.
 */
@Component({
  selector: 'vs-offset-host',
  imports: [VirtualScrollerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .parent {
      height: 300px;
      width: 300px;
      overflow-y: auto;
      border: ${PARENT_BORDER}px solid;
    }
    .header {
      height: 100px;
    }
    virtual-scroller {
      display: block;
      margin-top: 11px;
      border: ${HOST_BORDER}px solid;
    }
    .item {
      height: ${ITEM_HEIGHT}px;
    }
  `,
  template: `
    @if (window()) {
      <div class="header"></div>
      <virtual-scroller #scroll [items]="items" [parentScroll]="scroll.window">
        @for (item of scroll.viewPortItems; track item) {
          <div class="item" [attr.data-index]="item">{{ item }}</div>
        }
      </virtual-scroller>
    } @else {
      <div class="parent" #parent>
        <div class="header"></div>
        <virtual-scroller #scroll [items]="items" [parentScroll]="parent">
          @for (item of scroll.viewPortItems; track item) {
            <div class="item" [attr.data-index]="item">{{ item }}</div>
          }
        </virtual-scroller>
      </div>
    }
  `,
})
class OffsetHost {
  readonly items = Array.from({ length: 1000 }, (_, i) => i);
  readonly window = signal(false);
  readonly scroller = viewChild.required(VirtualScrollerComponent);
}

describe('VirtualScrollerComponent offset from its scroll parent', () => {
  let fixture: ComponentFixture<OffsetHost>;

  const settle = async () => {
    await fixture.whenStable();
    await waitFrames(10);
    await fixture.whenStable();
  };
  const itemTop = (index: number) =>
    fixture.nativeElement.querySelector(`[data-index="${index}"]`)!.getBoundingClientRect().top;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    fixture?.destroy();
    document.documentElement.style.height = '';
    document.scrollingElement!.scrollTop = 0;
  });

  it('scrollToIndex aligns the item with the top of a bordered parent', async () => {
    fixture = TestBed.createComponent(OffsetHost);
    await settle();

    fixture.componentInstance.scroller().scrollToIndex(200, true, 0, 0);
    await settle();

    const parent: HTMLElement = fixture.nativeElement.querySelector('.parent');
    const contentTop = parent.getBoundingClientRect().top + parent.clientTop;
    expect(itemTop(200)).toBe(contentTop);
  });

  it('scrollToIndex aligns the item with the top of the window', async () => {
    // Window mode measures document.scrollingElement, which is only viewport-sized when the page constrains <html>
    document.documentElement.style.height = '100%';
    fixture = TestBed.createComponent(OffsetHost);
    fixture.componentInstance.window.set(true);
    await settle();

    fixture.componentInstance.scroller().scrollToIndex(200, true, 0, 0);
    await settle();

    expect(itemTop(200)).toBe(0);
  });
});
