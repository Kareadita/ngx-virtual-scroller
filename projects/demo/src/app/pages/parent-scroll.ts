import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { makeItems } from '../shared/data';
import { ScrollControls } from '../shared/scroll-controls';

@Component({
  selector: 'demo-parent-scroll-page',
  imports: [VirtualScrollerComponent, ScrollControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Parent scroll</h1>
    <p class="lede">
      <code>[parentScroll]</code> points at an ancestor that scrolls other content too. The list
      starts below a header, and the scroller offsets its positions by that distance.
    </p>
    <demo-scroll-controls [scroller]="scroll" [count]="items.length" />
    <div #parent class="viewport parent" data-scroll-root>
      <section class="intro">
        <h2>Series header</h2>
        <p>Everything above the list scrolls away with it.</p>
      </section>
      <virtual-scroller #scroll [items]="items" [parentScroll]="parent">
        @for (item of scroll.viewPortItems; track item.id) {
          <div class="row" [attr.data-index]="item.id">
            <span class="badge">{{ item.id }}</span>
            {{ item.name }}
          </div>
        }
      </virtual-scroller>
      <p class="end">End of the list</p>
    </div>
  `,
  styles: `
    .parent {
      overflow-y: auto;
    }
    .intro {
      height: 180px;
      box-sizing: border-box;
      padding: 1rem;
      background: var(--accent-soft);
    }
    h2 {
      margin: 0 0 0.5rem;
    }
    .row {
      height: 48px;
    }
    .end {
      margin: 0;
      padding: 1rem;
      color: var(--text-muted);
    }
  `,
})
export class ParentScrollPage {
  protected readonly items = makeItems(5000);
}
