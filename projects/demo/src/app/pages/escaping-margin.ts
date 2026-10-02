import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { makeItems } from '../shared/data';
import { ScrollControls } from '../shared/scroll-controls';

/** A heading's margin collapses out through the top of its row, so rows sit further apart than their boxes */
@Component({
  selector: 'demo-escaping-margin-page',
  imports: [VirtualScrollerComponent, ScrollControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Escaping margin</h1>
    <p class="lede">
      Each row's heading has an 18px top margin, and the row has no top border or padding to contain
      it. The margin collapses out through the row, so rows sit 18px further apart than their boxes.
      Fixed-size mode measures the distance between rows, so this works. With
      <code>enableUnequalChildrenSizes</code>, which measures each box, contain the margin with
      <code>display: flow-root</code> on the row.
    </p>
    <demo-scroll-controls [scroller]="scroll" [count]="items.length" />
    <virtual-scroller #scroll class="viewport" [items]="items">
      @for (item of scroll.viewPortItems; track item.id) {
        <div class="entry" [attr.data-index]="item.id">
          <h2>
            {{ item.name }} <span class="badge">{{ item.id }}</span>
          </h2>
          <p>Review of volume {{ (item.id % 30) + 1 }}</p>
        </div>
      }
    </virtual-scroller>
  `,
  styles: `
    .entry {
      padding: 0 1rem;
      border-bottom: 1px solid var(--border);
    }
    .entry h2 {
      height: 22px;
      margin: 18px 0 4px;
      font-size: 1rem;
      line-height: 22px;
    }
    .entry p {
      height: 20px;
      margin: 0 0 8px;
      color: var(--text-muted);
      line-height: 20px;
    }
  `,
})
export class EscapingMarginPage {
  protected readonly items = makeItems(5000);
}
