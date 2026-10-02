import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { makeItems } from '../shared/data';
import { ScrollControls } from '../shared/scroll-controls';

/** A responsive card grid: a #container CSS grid with a gap, bufferAmount 1 */
@Component({
  selector: 'demo-grid-page',
  imports: [VirtualScrollerComponent, ScrollControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Card grid</h1>
    <p class="lede">
      A responsive CSS grid inside a <code>#container</code>, with a 16px <code>gap</code> and
      <code>bufferAmount</code> 1. The gap isn't part of any card's box, so the scroller measures
      the item size as the distance between rows. Resize the window to change the number of columns.
    </p>
    <demo-scroll-controls [scroller]="scroll" [count]="items.length" />
    <virtual-scroller #scroll class="viewport" [items]="items" [bufferAmount]="1">
      <div #container class="grid">
        @for (item of scroll.viewPortItems; track item.id) {
          <div class="card" [attr.data-index]="item.id">
            <div class="cover" [style.--hue]="(item.id * 47) % 360"></div>
            <div class="title">{{ item.name }}</div>
            <span class="badge">#{{ item.id }}</span>
          </div>
        }
      </div>
    </virtual-scroller>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 16px;
      padding: 12px;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      height: 240px;
      overflow: hidden;
    }
    .cover {
      flex: none;
      height: 180px;
      border-radius: 6px;
      background: hsl(var(--hue) 55% 55%);
    }
    .title {
      overflow: hidden;
      font-weight: 600;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .badge {
      align-self: start;
    }
  `,
})
export class GridPage {
  protected readonly items = makeItems(3000);
}
