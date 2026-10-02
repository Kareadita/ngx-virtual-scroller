import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { makeItems } from '../shared/data';
import { ScrollControls } from '../shared/scroll-controls';

@Component({
  selector: 'demo-table-page',
  imports: [VirtualScrollerComponent, ScrollControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Table</h1>
    <p class="lede">
      Rows rendered into a <code>&lt;tbody #container&gt;</code>. The scroller measures the rows in
      the container and offsets them by the header's height. The header and footer are
      <code>position: sticky</code>, which needs <code>[useMarginInsteadOfTranslate]="true"</code>:
      the default <code>transform</code> would move them a second time, after the browser has
      already pinned them.
    </p>
    <demo-scroll-controls [scroller]="scroll" [count]="items.length" />
    <virtual-scroller #scroll class="viewport" [items]="items" [useMarginInsteadOfTranslate]="true">
      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Name</th>
            <th>Shelf</th>
          </tr>
        </thead>
        <tbody #container>
          @for (item of scroll.viewPortItems; track item.id) {
            <tr [attr.data-index]="item.id">
              <td class="num">{{ item.id }}</td>
              <td>{{ item.name }}</td>
              <td>Shelf {{ (item.id % 40) + 1 }}</td>
            </tr>
          }
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">{{ items.length }} rows</td>
          </tr>
        </tfoot>
      </table>
    </virtual-scroller>
  `,
  styles: `
    table {
      width: 100%;
      border-spacing: 0;
    }
    tr {
      height: 40px;
    }
    th,
    td {
      box-sizing: border-box;
      padding: 0 1rem;
      border-bottom: 1px solid var(--border);
      text-align: left;
      white-space: nowrap;
    }
    th,
    tfoot td {
      position: sticky;
      background: var(--accent-soft);
    }
    th {
      top: 0;
    }
    tfoot td {
      bottom: 0;
      color: var(--text-muted);
    }
    .num {
      width: 6rem;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class TablePage {
  protected readonly items = makeItems(10_000);
}
