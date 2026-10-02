import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { makeItems } from '../shared/data';
import { ScrollControls } from '../shared/scroll-controls';

/** Mirrors Kavita's .companion-bar: the scroll parent only becomes scrollable while hovered */
@Component({
  selector: 'demo-hover-scroll-page',
  imports: [VirtualScrollerComponent, ScrollControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Hover-only scroll</h1>
    <p class="lede">
      The scroll parent is <code>overflow-y: hidden</code>, and <code>auto</code> only while
      hovered, so the scrollbar appears and disappears.
      <code>[modifyOverflowStyleOfParentScroll]="false"</code> keeps the scroller from overriding
      that styling.
    </p>
    <demo-scroll-controls [scroller]="scroll" [count]="items.length" />
    <div #parent class="viewport hover" data-scroll-root>
      <virtual-scroller
        #scroll
        [items]="items"
        [modifyOverflowStyleOfParentScroll]="false"
        [parentScroll]="parent"
      >
        @for (item of scroll.viewPortItems; track item.id) {
          <div class="row" [attr.data-index]="item.id">
            <span class="badge">{{ item.id }}</span>
            {{ item.name }}
          </div>
        }
      </virtual-scroller>
    </div>
  `,
  styles: `
    .hover {
      overflow-y: hidden;
    }
    .hover:hover {
      overflow-y: auto;
    }
    .row {
      height: 48px;
    }
  `,
})
export class HoverScrollPage {
  protected readonly items = makeItems(5000);
}
