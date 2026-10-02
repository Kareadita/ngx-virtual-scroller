import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  signal,
  viewChildren,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { VirtualScrollerComponent } from './ngx-virtual-scroller.component';
import { waitFrames } from '../testing/paint-probe';

// 24px items with 8px margins: adjacent margins collapse, so items sit 32px apart
const ITEM_HEIGHT = 24;
const ITEM_MARGIN = 8;
const ITEM_PITCH = ITEM_HEIGHT + ITEM_MARGIN;

/**
 * Two lists sharing one scroll parent, like tabs on a page: only one is displayed at a time, but both listen to the
 * parent's scroll events.
 */
@Component({
  selector: 'vs-tabs-host',
  imports: [VirtualScrollerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .page {
      height: 300px;
      width: 300px;
      overflow-y: auto;
    }
    .item {
      height: ${ITEM_HEIGHT}px;
      margin: ${ITEM_MARGIN}px 0;
    }
  `,
  template: `
    <div class="page" #page>
      @for (tab of [0, 1]; track tab) {
        <div [style.display]="activeTab() === tab ? 'block' : 'none'">
          <virtual-scroller
            #scroll
            [items]="items"
            [parentScroll]="page"
            [modifyOverflowStyleOfParentScroll]="false"
          >
            @for (item of scroll.viewPortItems; track item) {
              <div class="item" [attr.data-index]="item">{{ item }}</div>
            }
          </virtual-scroller>
        </div>
      }
    </div>
  `,
})
class TabsHost {
  readonly items = Array.from({ length: 500 }, (_, i) => i);
  readonly activeTab = signal(0);
  readonly scrollers = viewChildren(VirtualScrollerComponent);
}

describe('VirtualScrollerComponent while hidden', () => {
  it('ignores scroll events while hidden, then measures and follows the scroll position once shown', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(TabsHost);
    const settle = async () => {
      await fixture.whenStable();
      await waitFrames(10);
      await fixture.whenStable();
    };
    await settle();
    const page: HTMLElement = fixture.nativeElement.querySelector('.page');
    const [, hidden] = fixture.componentInstance.scrollers();

    // Scroll the shared parent while tab 1 is hidden
    for (let i = 0; i < 10; ++i) {
      page.scrollTop += 300;
      await waitFrames(2);
    }
    await settle();

    // A hidden scroller can't measure its items (they are 0px tall, plus margins). It must not render the whole list
    expect(hidden.viewPortItems.length).toBeLessThan(50);

    fixture.componentInstance.activeTab.set(1);
    await settle();
    // While hidden it had no scroll length, so showing it shrinks the page and the browser resets scrollTop; scroll back
    expect(hidden.viewPortInfo.startIndex).toBe(Math.floor(page.scrollTop / ITEM_PITCH));
    page.scrollTop = 3000;
    await settle();

    const rendered = Array.from(
      fixture.nativeElement
        .querySelectorAll('virtual-scroller')[1]
        .querySelectorAll('[data-index]'),
      (el: HTMLElement) => Number(el.dataset['index']),
    );
    expect(rendered.length).toBeLessThan(50);
    // 3000px down at 32px per item
    expect(rendered).toContain(Math.floor(3000 / ITEM_PITCH));
    expect(hidden.viewPortInfo.startIndex).toBe(Math.floor(3000 / ITEM_PITCH));
    fixture.destroy();
  });
});
