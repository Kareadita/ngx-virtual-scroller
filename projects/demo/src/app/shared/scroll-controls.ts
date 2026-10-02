import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';

/**
 * Scroll-to-index and a live status line for a scroller. `viewPortInfo` and `viewPortItems` are signal-backed, so this
 * OnPush component updates as the scroller scrolls without any manual change detection.
 */
@Component({
  selector: 'demo-scroll-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="controls" (submit)="$event.preventDefault(); scrollTo(index.valueAsNumber)">
      <label>
        Index
        <input
          #index
          type="number"
          name="index"
          min="0"
          [max]="count() - 1"
          value="500"
          data-testid="scroll-to-index"
        />
      </label>
      <button type="submit">Scroll to</button>
      <ng-content />
      <span class="status" data-testid="status">
        Showing {{ scroller().viewPortInfo.startIndex }}–{{ scroller().viewPortInfo.endIndex }} of
        {{ count() }} · {{ scroller().viewPortItems.length }} rendered
      </span>
    </form>
  `,
  styles: `
    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    input {
      width: 6rem;
      margin-left: 0.25rem;
    }
    .status {
      margin-left: auto;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class ScrollControls {
  readonly scroller = input.required<VirtualScrollerComponent>();
  readonly count = input.required<number>();

  protected scrollTo(index: number): void {
    if (!Number.isNaN(index)) {
      // No animation (0 ms), like Kavita
      this.scroller().scrollToIndex(index, true, 0, 0);
    }
  }
}
