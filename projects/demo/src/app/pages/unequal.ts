import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { makeItems } from '../shared/data';
import { ScrollControls } from '../shared/scroll-controls';

/** Deterministic heights from 40px to 112px */
const heightOf = (id: number) => 40 + ((id * 7) % 5) * 18;

@Component({
  selector: 'demo-unequal-page',
  imports: [VirtualScrollerComponent, ScrollControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Unequal sizes</h1>
    <p class="lede">
      <code>[enableUnequalChildrenSizes]="true"</code>: rows from 40px to 112px. The scroller caches
      each row's measured size, and estimates the rows it hasn't rendered yet from the average.
    </p>
    <demo-scroll-controls [scroller]="scroll" [count]="items.length" />
    <virtual-scroller #scroll class="viewport" [items]="items" [enableUnequalChildrenSizes]="true">
      @for (item of scroll.viewPortItems; track item.id) {
        <div class="row" [attr.data-index]="item.id" [style.height.px]="heightOf(item.id)">
          <span class="badge">{{ item.id }}</span>
          {{ item.name }}
          <span class="size">{{ heightOf(item.id) }}px</span>
        </div>
      }
    </virtual-scroller>
  `,
  styles: `
    .size {
      margin-left: auto;
      color: var(--text-muted);
    }
  `,
})
export class UnequalPage {
  protected readonly items = makeItems(5000);
  protected readonly heightOf = heightOf;
}
