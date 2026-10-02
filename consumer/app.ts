import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  IPageInfo,
  provideVirtualScrollerOptions,
  VirtualScrollerComponent,
  VirtualScrollerModule,
} from '@kareadita/ngx-virtual-scroller';

interface Row {
  id: number;
  name: string;
}

const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, id) => ({ id, name: `Row ${id}` }));

/** Uses the deprecated module, as existing consumers do, to check it still compiles and renders */
@Component({
  selector: 'app-legacy-list',
  imports: [VirtualScrollerModule],
  template: `
    <virtual-scroller #scroll class="legacy" [items]="items">
      @for (item of scroll.viewPortItems; track item.id) {
        <div class="row" [attr.data-legacy]="item.id">{{ item.name }}</div>
      }
    </virtual-scroller>
  `,
  styles: `
    .legacy {
      display: block;
      height: 120px;
    }
    .row {
      height: 40px;
    }
  `,
})
export class LegacyList {
  protected readonly items = rows(100);
}

/** Replaces the generated root component of a fresh `ng new` app. See scripts/consumer-check.mjs */
@Component({
  selector: 'app-root',
  imports: [VirtualScrollerComponent, LegacyList],
  providers: [provideVirtualScrollerOptions({ scrollAnimationTime: 0 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>
      <button type="button" (click)="scroll.scrollToIndex(5000)">Jump to 5000</button>
      <span data-testid="range">{{ range() }}</span>
    </p>
    <virtual-scroller
      #scroll
      class="list"
      [items]="items"
      [ssrChildHeight]="40"
      [ssrViewportHeight]="400"
      (vsChange)="onChange($event)"
    >
      @for (item of scroll.viewPortItems; track item.id) {
        <div class="row" [attr.data-index]="item.id">{{ item.name }}</div>
      }
    </virtual-scroller>
    <app-legacy-list />
  `,
  styles: `
    .list {
      display: block;
      height: 400px;
    }
    .row {
      height: 40px;
      box-sizing: border-box;
      border-bottom: 1px solid #ccc;
    }
  `,
})
export class App {
  protected readonly items = rows(10_000);
  protected readonly range = signal('');

  protected onChange(info: IPageInfo): void {
    this.range.set(`${info.startIndex}-${info.endIndex}`);
  }
}
