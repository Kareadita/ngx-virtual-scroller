import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { makeItems } from '../shared/data';

/** One scroll parent shared by a scroller per tab; inactive tabs are display: none */
@Component({
  selector: 'demo-tabs-page',
  imports: [VirtualScrollerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Tabs</h1>
    <p class="lede">
      Three scrollers share one scroll parent. Only the active tab is displayed, but every scroller
      gets the parent's scroll events. Hidden scrollers skip measuring (their items would measure
      0px) and catch up when shown.
    </p>
    <div class="tabs" role="tablist">
      @for (tab of tabs; track tab.id) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="active() === tab.id"
          [attr.data-tab]="tab.id"
          (click)="active.set(tab.id)"
        >
          {{ tab.label }} ({{ tab.items.length }})
        </button>
      }
    </div>
    <div #parent class="viewport parent" data-scroll-root>
      @for (tab of tabs; track tab.id) {
        <div role="tabpanel" [style.display]="active() === tab.id ? 'block' : 'none'">
          <!-- modifyOverflowStyleOfParentScroll must come before parentScroll: the parentScroll setter reads it -->
          <virtual-scroller
            #scroll
            [items]="tab.items"
            [modifyOverflowStyleOfParentScroll]="false"
            [parentScroll]="parent"
          >
            @for (item of scroll.viewPortItems; track item.id) {
              <div class="item" [attr.data-index]="item.id">
                <span class="badge">{{ item.id }}</span>
                {{ tab.label }} · {{ item.name }}
              </div>
            }
          </virtual-scroller>
        </div>
      }
    </div>
  `,
  styles: `
    .tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .parent {
      overflow-y: auto;
    }
    .item {
      display: flex;
      box-sizing: border-box;
      align-items: center;
      gap: 0.75rem;
      height: 52px;
      margin: 8px 12px;
      padding: 0 1rem;
      border-radius: 6px;
      background: var(--accent-soft);
    }
  `,
})
export class TabsPage {
  protected readonly tabs = [
    { id: 'storyline', label: 'Storyline', items: makeItems(1000) },
    { id: 'volumes', label: 'Volumes', items: makeItems(400) },
    { id: 'chapters', label: 'Chapters', items: makeItems(2500) },
  ];
  protected readonly active = signal('storyline');
}
