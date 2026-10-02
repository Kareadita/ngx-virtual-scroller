import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { makeItems } from '../shared/data';
import { ScrollControls } from '../shared/scroll-controls';

@Component({
  selector: 'demo-horizontal-page',
  imports: [VirtualScrollerComponent, ScrollControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Horizontal</h1>
    <p class="lede">
      <code>[horizontal]="true"</code>: 5,000 cards, 150px wide plus a 12px right margin. Horizontal
      margins don't collapse, so the item size is the box plus its margins.
      <code>[RTL]="true"</code>
      lays the list out right to left.
    </p>
    <demo-scroll-controls [scroller]="scroll" [count]="items.length">
      <button type="button" [attr.aria-pressed]="rtl()" (click)="rtl.set(!rtl())">
        Right to left
      </button>
    </demo-scroll-controls>
    <virtual-scroller #scroll class="strip" [items]="items" [horizontal]="true" [RTL]="rtl()">
      @for (item of scroll.viewPortItems; track item.id) {
        <div class="card" [attr.data-index]="item.id">
          <span class="badge">#{{ item.id }}</span>
          <div class="title">{{ item.name }}</div>
        </div>
      }
    </virtual-scroller>
  `,
  styles: `
    .strip {
      height: 220px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
    }
    .card {
      display: flex;
      box-sizing: border-box;
      flex-direction: column;
      justify-content: space-between;
      width: 150px;
      height: 180px;
      margin: 12px 12px 0 0;
      padding: 10px;
      border-radius: 6px;
      background: var(--accent-soft);
    }
    .badge {
      align-self: start;
      background: var(--surface);
    }
    .title {
      font-weight: 600;
    }
  `,
})
export class HorizontalPage {
  protected readonly items = makeItems(5000);
  protected readonly rtl = signal(false);
}
