import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { coverUrl, makeItems } from '../shared/data';
import { ScrollControls } from '../shared/scroll-controls';

@Component({
  selector: 'demo-images-page',
  imports: [VirtualScrollerComponent, ScrollControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Lazy images</h1>
    <p class="lede">
      Covers load lazily, after the row has been measured. Each image has a fixed size, so loading
      it doesn't change the row's height. Without a fixed size, rows grow after measurement and the
      scroll length goes wrong.
    </p>
    <demo-scroll-controls [scroller]="scroll" [count]="items.length" />
    <virtual-scroller #scroll class="viewport" [items]="items">
      @for (item of scroll.viewPortItems; track item.id) {
        <div class="row" [attr.data-index]="item.id">
          <img [src]="coverUrl(item.id)" width="64" height="96" loading="lazy" alt="" />
          <div>
            <div class="title">{{ item.name }}</div>
            <span class="badge">#{{ item.id }}</span>
          </div>
        </div>
      }
    </virtual-scroller>
  `,
  styles: `
    .row {
      height: 112px;
    }
    img {
      flex: none;
      width: 64px;
      height: 96px;
      border-radius: 4px;
      object-fit: cover;
    }
    .title {
      margin-bottom: 0.25rem;
      font-weight: 600;
    }
  `,
})
export class ImagesPage {
  protected readonly items = makeItems(3000);
  protected readonly coverUrl = coverUrl;
}
