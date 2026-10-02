import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { IPageInfo, VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { makeItems } from '../shared/data';
import { ScrollControls } from '../shared/scroll-controls';

const PAGE_SIZE = 40;
const MAX_ITEMS = 1000;
const LATENCY_MS = 400;

@Component({
  selector: 'demo-load-more-page',
  imports: [VirtualScrollerComponent, ScrollControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Load more</h1>
    <p class="lede">
      Pages of {{ pageSize }} items are fetched (with a simulated {{ latency }}ms delay) when
      <code>(vsEnd)</code> reports that the last item is in view, up to {{ maxItems }} items. Each
      page replaces the <code>items</code> array with a longer one.
    </p>
    <demo-scroll-controls [scroller]="scroll" [count]="items().length">
      <span class="loading" data-testid="loading">{{ loading() ? 'Loading…' : '' }}</span>
    </demo-scroll-controls>
    <virtual-scroller #scroll class="viewport" [items]="items()" (vsEnd)="onEnd($event)">
      @for (item of scroll.viewPortItems; track item.id) {
        <div class="row" [attr.data-index]="item.id">
          <span class="badge">{{ item.id }}</span>
          {{ item.name }}
        </div>
      }
    </virtual-scroller>
  `,
  styles: `
    .row {
      height: 56px;
    }
    .loading {
      color: var(--accent);
    }
  `,
})
export class LoadMorePage {
  protected readonly pageSize = PAGE_SIZE;
  protected readonly maxItems = MAX_ITEMS;
  protected readonly latency = LATENCY_MS;
  protected readonly items = signal(makeItems(PAGE_SIZE));
  protected readonly loading = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onEnd(event: IPageInfo): void {
    const count = this.items().length;
    if (this.loading() || count >= MAX_ITEMS || event.endIndex !== count - 1) {
      return;
    }
    this.loading.set(true);
    this.timer = setTimeout(() => {
      this.items.update((items) => [...items, ...makeItems(PAGE_SIZE, items.length)]);
      this.loading.set(false);
    }, LATENCY_MS);
  }
}
