import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';
import { SCENARIO_GROUPS, SCENARIOS } from '../scenarios';
import { makeItems } from '../shared/data';
import { ScrollControls } from '../shared/scroll-controls';

const INSTALL = 'npm install @kareadita/ngx-virtual-scroller';

const QUICK_START = `import { Component } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';

@Component({
  selector: 'app-books',
  imports: [VirtualScrollerComponent],
  styles: 'virtual-scroller { height: 400px; }',
  template: \`
    <virtual-scroller #scroll [items]="books">
      @for (book of scroll.viewPortItems; track book.id) {
        <app-book-row [book]="book" />
      }
    </virtual-scroller>
  \`,
})
export class Books {
  readonly books = [/* as many as you like */];
}`;

const OPTIONS = `// app.config.ts: defaults for every scroller in the app (or provide it on a component)
providers: [
  provideZonelessChangeDetection(),
  provideVirtualScrollerOptions({ scrollAnimationTime: 300, scrollThrottlingTime: 16 }),
]`;

const ALIAS = `"@iharbeck/ngx-virtual-scroller": "npm:@kareadita/ngx-virtual-scroller@^22.0.0"`;

@Component({
  selector: 'demo-home-page',
  imports: [VirtualScrollerComponent, ScrollControls, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomePage {
  protected readonly items = makeItems(100_000);
  protected readonly install = INSTALL;
  protected readonly quickStart = QUICK_START;
  protected readonly options = OPTIONS;
  protected readonly alias = ALIAS;
  protected readonly groups = SCENARIO_GROUPS.map((group) => ({
    name: group,
    scenarios: SCENARIOS.filter((scenario) => scenario.group === group),
  }));
}
