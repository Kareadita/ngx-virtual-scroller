import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  viewChild,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { VirtualScrollerComponent } from './ngx-virtual-scroller.component';
import { provideVirtualScrollerOptions } from './virtual-scroller-options';
import { waitFrames } from '../testing/paint-probe';

@Component({
  selector: 'vs-standalone-host',
  // The component on its own, without VirtualScrollerModule
  imports: [VirtualScrollerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    virtual-scroller {
      display: block;
      width: 300px;
      height: 300px;
    }
    .item {
      height: 40px;
    }
  `,
  template: `
    <virtual-scroller #scroll [items]="items">
      @for (item of scroll.viewPortItems; track item) {
        <div class="item" [attr.data-index]="item">{{ item }}</div>
      }
    </virtual-scroller>
  `,
})
class StandaloneHost {
  readonly items = Array.from({ length: 1000 }, (_, i) => i);
  readonly scroller = viewChild.required(VirtualScrollerComponent);
}

describe('VirtualScrollerComponent as a standalone import', () => {
  const settle = async (fixture: { whenStable(): Promise<unknown> }) => {
    await fixture.whenStable();
    await waitFrames(10);
    await fixture.whenStable();
  };

  it('renders without VirtualScrollerModule or any provider', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(StandaloneHost);
    await settle(fixture);

    const rendered = fixture.nativeElement.querySelectorAll('[data-index]');
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(20);
    expect(fixture.componentInstance.scroller().scrollAnimationTime).toBe(750);
    fixture.destroy();
  });

  it('takes its defaults from provideVirtualScrollerOptions', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideVirtualScrollerOptions({ scrollAnimationTime: 0 }),
      ],
    });
    const fixture = TestBed.createComponent(StandaloneHost);
    await settle(fixture);
    const scroller = fixture.componentInstance.scroller();

    expect(scroller.scrollAnimationTime).toBe(0);
    // Unset options keep their defaults
    expect(scroller.resizeBypassRefreshThreshold).toBe(5);

    // With no animation time, scrolling completes without waiting out the 750ms default
    let completed = false;
    scroller.scrollToIndex(300, true, 0, undefined, () => (completed = true));
    await settle(fixture);
    expect(completed).toBe(true);
    expect(scroller.viewPortInfo.startIndex).toBe(300);
    fixture.destroy();
  });
});
