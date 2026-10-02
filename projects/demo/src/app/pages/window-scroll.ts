import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { makeItems } from '../shared/data';
import { ScrollControls } from '../shared/scroll-controls';

@Component({
  selector: 'demo-window-scroll-page',
  imports: [VirtualScrollerComponent, ScrollControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Window scroll</h1>
    <p class="lede">
      <code>[parentScroll]="scroll.window"</code>: the page itself scrolls. The scroller measures
      <code>document.scrollingElement</code>, which is only viewport-sized when the page constrains
      <code>&lt;html&gt;</code>, so this demo sets <code>html {{ '{' }} height: 100% {{ '}' }}</code
      >.
    </p>
    <demo-scroll-controls [scroller]="scroll" [count]="items.length" />
    <virtual-scroller #scroll class="list" [items]="items" [parentScroll]="scroll.window">
      @for (item of scroll.viewPortItems; track item.id) {
        <div class="row" [attr.data-index]="item.id">
          <span class="badge">{{ item.id }}</span>
          {{ item.name }}
        </div>
      }
    </virtual-scroller>
  `,
  styles: `
    .list {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
    }
    .row {
      height: 48px;
    }
  `,
})
export class WindowScrollPage {
  protected readonly items = makeItems(5000);
}
