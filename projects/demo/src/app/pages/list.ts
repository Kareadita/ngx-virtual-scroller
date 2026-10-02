import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { makeItems } from '../shared/data';
import { ScrollControls } from '../shared/scroll-controls';

const COUNT = 10_000;

@Component({
  selector: 'demo-list-page',
  imports: [VirtualScrollerComponent, ScrollControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Vertical list</h1>
    <p class="lede">
      {{ count }} rows of 56px in a scroller that scrolls itself. The buttons replace the
      <code>items</code> array: the scroller doesn't detect changes made to the array in place.
    </p>
    <demo-scroll-controls [scroller]="scroll" [count]="items().length">
      <button type="button" (click)="prepend()">Prepend 10</button>
      <button type="button" (click)="append()">Append 10</button>
      <button type="button" (click)="reverse()">Reverse</button>
      <button type="button" (click)="reset()">Reset</button>
    </demo-scroll-controls>
    <virtual-scroller #scroll class="viewport" [items]="items()">
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
  `,
})
export class ListPage {
  protected readonly count = COUNT;
  protected readonly items = signal(makeItems(COUNT));

  protected prepend(): void {
    this.items.update((items) => [...makeItems(10, (items[0]?.id ?? 0) - 10), ...items]);
  }

  protected append(): void {
    this.items.update((items) => [...items, ...makeItems(10, (items.at(-1)?.id ?? -1) + 1)]);
  }

  protected reverse(): void {
    this.items.update((items) => [...items].reverse());
  }

  protected reset(): void {
    this.items.set(makeItems(COUNT));
  }
}
