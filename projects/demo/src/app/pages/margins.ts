import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { makeItems } from '../shared/data';
import { ScrollControls } from '../shared/scroll-controls';

/** Items with vertical margins that collapse between neighbours */
@Component({
  selector: 'demo-margins-page',
  imports: [VirtualScrollerComponent, ScrollControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Collapsing margins</h1>
    <p class="lede">
      64px items with <code>margin: 8px 0</code>. Adjacent vertical margins collapse, so the items
      sit 72px apart, not the 80px that the box plus both margins would suggest. The scroller
      measures the distance between items.
    </p>
    <demo-scroll-controls [scroller]="scroll" [count]="items.length" />
    <virtual-scroller #scroll class="viewport" [items]="items">
      @for (item of scroll.viewPortItems; track item.id) {
        <div class="item" [attr.data-index]="item.id">
          <span class="badge">{{ item.id }}</span>
          {{ item.name }}
        </div>
      }
    </virtual-scroller>
  `,
  styles: `
    .item {
      display: flex;
      box-sizing: border-box;
      align-items: center;
      gap: 0.75rem;
      height: 64px;
      margin: 8px 12px;
      padding: 0 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
    }
  `,
})
export class MarginsPage {
  protected readonly items = makeItems(5000);
}
