# ngx-virtual-scroller

Render a list of any length with a few dozen DOM nodes. A virtual scroller for zoneless Angular: vertical or
horizontal, single or multi-column, fixed or variable sizes.

[![npm](https://img.shields.io/npm/v/@kareadita/ngx-virtual-scroller)](https://www.npmjs.com/package/@kareadita/ngx-virtual-scroller)

**[Demo and examples](https://kareadita.github.io/ngx-virtual-scroller/)** ·
[Changelog](https://github.com/Kareadita/ngx-virtual-scroller/blob/master/CHANGELOG.md)

- Built for zoneless Angular: `viewPortItems` and `viewPortInfo` are signal-backed, so `OnPush` templates update on
  their own.
- Lists, multi-column grids (detected from your CSS layout) and table rows.
- Horizontal scrolling, including right to left.
- Fixed-size items are measured once, grid gaps and collapsing margins included. Variable sizes are measured per item.
- Scroll the list itself, an ancestor element, or the whole page.
- `scrollToIndex`, `scrollInto` and `scrollToPosition`, with an optional eased animation.
- No dependencies besides Angular and tslib.

## How it works

The scroller measures your items, renders just enough of them to fill the viewport, and pads the space before and after
so the scrollbar behaves as if every item were there. As you scroll, it swaps in the next slice of items. The number
of DOM elements stays small and constant however long the list grows.

## Compatibility

| Library | Angular | Change detection    |
| ------- | ------- | ------------------- |
| 22.x    | 22+     | Zoneless only       |
| 20.0.1  | 20–22   | Zone.js or zoneless |

Each Angular major gets a matching library major. 20.0.1 is the last 20.x release and is no longer maintained.

## Install

```sh
npm install @kareadita/ngx-virtual-scroller
```

## Quick start

Import the standalone component and render `scroll.viewPortItems` instead of your full array:

```ts
import { Component } from '@angular/core';
import { VirtualScrollerComponent } from '@kareadita/ngx-virtual-scroller';

@Component({
  selector: 'app-books',
  imports: [VirtualScrollerComponent],
  styles: `
    virtual-scroller { height: 400px; }
    app-book-row { display: block; height: 48px; }
  `,
  template: `
    <virtual-scroller #scroll [items]="books">
      @for (book of scroll.viewPortItems; track book.id) {
        <app-book-row [book]="book" />
      }
    </virtual-scroller>
  `,
})
export class Books {
  readonly books = [/* as many as you like */];
}
```

Two things the scroller needs from you:

- **A size for the scroller.** Give `<virtual-scroller>` a height (or a width when `horizontal`), or point
  `[parentScroll]` at the element that scrolls (see [Scroll containers](#scroll-containers)).
- **Stable item sizes.** Items are measured as they render, and a measurement sticks until it is invalidated. Give
  anything that loads late, like images, a fixed size, or use [variable sizes](#variable-sizes).

The component also works as an attribute: `<div virtualScroller #scroll [items]="items">`.

### Changing the list

Assign a new `items` array to change the list. Changes made to the same array in place (`push`, `splice`, `sort`) are
not detected:

```ts
this.items = [...this.items, ...nextPage];
this.items = [...this.items].sort(byTitle);
```

With a signal: `items = signal<Book[]>([])`, bind `[items]="items()"`, and use `items.update(...)` with a new array.

## Default options

Set defaults for every scroller with `provideVirtualScrollerOptions`, in your application config or in a component's
`providers` for that subtree:

```ts
import { provideZonelessChangeDetection } from '@angular/core';
import { provideVirtualScrollerOptions } from '@kareadita/ngx-virtual-scroller';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideVirtualScrollerOptions({ scrollAnimationTime: 300, scrollThrottlingTime: 16 }),
  ],
};
```

Options you leave out keep their defaults. The configurable options are `modifyOverflowStyleOfParentScroll`,
`resizeBypassRefreshThreshold`, `scrollAnimationTime`, `scrollDebounceTime`, `scrollThrottlingTime`,
`scrollbarHeight`, `scrollbarWidth` and `stripedTable`. You can also provide the `VIRTUAL_SCROLLER_DEFAULT_OPTIONS`
token yourself.

## Scroll containers

By default the scroller is its own scroll container. To use an ancestor's scrollbar instead, pass that element to
`parentScroll`. The ancestor needs a defined size.

```html
<div #scrollingBlock class="panel">
  <h2>Results</h2>
  <virtual-scroller #scroll [items]="items" [parentScroll]="scrollingBlock">
    @for (item of scroll.viewPortItems; track item.id) {
      <app-row [item]="item" />
    }
  </virtual-scroller>
</div>
```

If the ancestor is an Angular component rather than a plain element, the template variable holds the component. Pass
its host element instead, for example from a `viewChild('scrollingBlock', { read: ElementRef })`.

To scroll with the page, use the window:

```html
<virtual-scroller #scroll [items]="items" [parentScroll]="scroll.window">…</virtual-scroller>
```

In window mode the scroller measures `document.scrollingElement`, so the page itself must be the thing that scrolls.

By default the scroller sets the overflow style of `parentScroll` so it scrolls in the right direction. Set
`modifyOverflowStyleOfParentScroll` to `false` to manage that yourself.

### Other content inside the scroller

To put other elements inside the scroller next to the list (a search box, a heading), wrap the list in an element
marked `#container`. The scroller then measures that element instead of all of its content:

```html
<virtual-scroller #scroll [items]="items">
  <input type="search" />
  <div #container>
    @for (item of scroll.viewPortItems; track item.id) {
      <app-row [item]="item" />
    }
  </div>
</virtual-scroller>
```

### Tables

Render the rows into a `<tbody #container>`. The scroller measures the rows and offsets them by the header's height.
For a sticky header and footer, make the cells `position: sticky` and set `useMarginInsteadOfTranslate`: the default
`transform` would move them a second time, after the browser has already pinned them.

```html
<virtual-scroller #scroll [items]="rows" [useMarginInsteadOfTranslate]="true">
  <table>
    <thead><tr><th>Name</th></tr></thead>
    <tbody #container>
      @for (row of scroll.viewPortItems; track row.id) {
        <tr><td>{{ row.name }}</td></tr>
      }
    </tbody>
    <tfoot><tr><td>{{ rows.length }} rows</td></tr></tfoot>
  </table>
</virtual-scroller>
```

```css
th, tfoot td { position: sticky; }
th { top: 0; }
tfoot td { bottom: 0; }
```

Set `stripedTable` for striped rows, so rows are added and removed two at a time and the stripes don't flip.

Content marked with a `tab-header` or `tab-footer` attribute is projected outside the scrolling content, before and
after it.

## Item sizes

### Fixed sizes (the default)

All items are assumed to be the same size as the first one measured. Once two rows (or columns) are rendered, the item
size is the distance between them, so CSS grid `gap` and collapsing vertical margins are included. In a grid, the
number of columns is counted from the items that share a row.

### Variable sizes

For items of different sizes, set `enableUnequalChildrenSizes`. Each item is measured as it renders, and
`bufferAmount` defaults to 5 extra items on each side to absorb the estimates for items not measured yet:

```html
<virtual-scroller #scroll [items]="items" [enableUnequalChildrenSizes]="true">…</virtual-scroller>
```

### When an item's size changes

Measurements are cached. If an item changes size after it was measured (it expands, or an image without a fixed size
loads), tell the scroller to measure again:

```ts
scroller.invalidateAllCachedMeasurements();
scroller.invalidateCachedMeasurementForItem(item);
scroller.invalidateCachedMeasurementAtIndex(index);
```

Changes to the scroller's own size, or its `parentScroll`'s, are detected with a `ResizeObserver`. A scroller that is
hidden (for example in an inactive tab) waits until it is shown before measuring.

### Item state is not kept

Items scrolled out of view are removed from the DOM, so a row component loses its internal state (expanded, selected)
when it scrolls away. Keep that state in your data and bind it:

```html
@for (item of scroll.viewPortItems; track item.id) {
  <app-row [item]="item" [expanded]="expandedIds().has(item.id)" />
}
```

## Scrolling to an item

```ts
readonly scroller = viewChild.required(VirtualScrollerComponent);

showBook(book: Book): void {
  this.scroller().scrollInto(book);
}
```

`scrollToIndex(index)` does the same by position. Both take `alignToBeginning` (default `true`), an `additionalOffset`
in pixels, an animation time in milliseconds (default `scrollAnimationTime`, 750; `0` jumps) and a completion
callback. `scrollToPosition(px)` scrolls to a pixel offset.

In a zoneless app the completion callback doesn't trigger change detection on its own. If the callback changes what a
template shows, store that state in a signal.

## Loading more

`(vsEnd)` fires when the last visible item changes. Fetch the next page when it reaches the end of your array:

```ts
@Component({
  imports: [VirtualScrollerComponent],
  template: `
    <virtual-scroller #scroll [items]="books()" (vsEnd)="loadMore($event)">
      @for (book of scroll.viewPortItems; track book.id) {
        <app-book-row [book]="book" />
      }
      @if (loading()) {
        <div class="loader">Loading…</div>
      }
    </virtual-scroller>
  `,
})
export class BookList {
  private readonly api = inject(BookApi);
  protected readonly books = signal<Book[]>([]);
  protected readonly loading = signal(false);

  protected loadMore(event: IPageInfo): void {
    const count = this.books().length;
    if (this.loading() || event.endIndex !== count - 1) {
      return;
    }
    this.loading.set(true);
    this.api.fetch(count, 20).subscribe((page) => {
      this.books.update((books) => [...books, ...page]);
      this.loading.set(false);
    });
  }
}
```

## API

### Inputs

| Input                               | Type and default                           | Description |
| ----------------------------------- | ------------------------------------------ | ----------- |
| `items`                             | `any[]`                                    | The full list. Assign a new array to change it. |
| `bufferAmount`                      | `number`, 5 with unequal sizes, otherwise 0 | Extra items rendered before and after the visible ones. |
| `compareItems`                      | `(a, b) => boolean`, `===`                 | How items are matched when `items` changes: to keep the same items in view when items are prepended, and to keep cached measurements of unchanged items. |
| `enableUnequalChildrenSizes`        | `boolean`, `false`                         | Measure each item separately. See [Variable sizes](#variable-sizes). |
| `horizontal`                        | `boolean`, `false`                         | Scroll horizontally. |
| `RTL`                               | `boolean`, `false`                         | Right-to-left horizontal scrolling. |
| `parentScroll`                      | `Element \| Window \| undefined`           | The element (or `scroll.window`) whose scrollbar to use. Must be an ancestor. |
| `modifyOverflowStyleOfParentScroll` | `boolean`, `true`                          | Set the overflow style of `parentScroll` so it scrolls. |
| `scrollAnimationTime`               | `number`, `750`                            | Default animation time in ms for the scroll methods. `0` disables animation. |
| `scrollThrottlingTime`              | `number`, `0`                              | Refresh at most once per this many ms while scrolling. |
| `scrollDebounceTime`                | `number`, `0`                              | Refresh only after scrolling stops for this many ms. Takes precedence over throttling. |
| `resizeBypassRefreshThreshold`      | `number`, `5`                              | Ignore resizes smaller than this many pixels. |
| `useMarginInsteadOfTranslate`       | `boolean`, `false`                         | Offset items with a margin instead of a CSS transform. A transform creates a containing block, which breaks `position: fixed` in items. |
| `stripedTable`                      | `boolean`, `false`                         | Add and remove rows two at a time, to keep stripes stable. |
| `childWidth` / `childHeight`        | `number \| undefined`                      | Minimum item size in px, if measuring isn't good enough. Prefer the defaults. |
| `scrollbarWidth` / `scrollbarHeight` | `number \| undefined`                     | Override the measured scrollbar size. |
| `ssrChildWidth` / `ssrChildHeight`  | `number \| undefined`                      | Item size to assume during server-side rendering. |
| `ssrViewportWidth` / `ssrViewportHeight` | `number`, `1920` / `1080`             | Viewport size to assume during server-side rendering. |

### Outputs

| Output     | Emits       | When |
| ---------- | ----------- | ---- |
| `vsUpdate` | `any[]`     | The rendered range or the scroll position changed. Emits the new `viewPortItems`. |
| `vsChange` | `IPageInfo` | The first or last visible item changed. |
| `vsStart`  | `IPageInfo` | The first visible item changed. |
| `vsEnd`    | `IPageInfo` | The last visible item changed. |

### Properties and methods

| Member | Description |
| ------ | ----------- |
| `viewPortItems: any[]` | The items to render: the visible slice of `items`, plus the buffer. |
| `viewPortInfo: IPageInfo` | The current range and scroll positions. |
| `window: Window` | The window, for `[parentScroll]="scroll.window"`. |
| `scrollInto(item, alignToBeginning?, additionalOffset?, animationMilliseconds?, animationCompletedCallback?)` | Scroll to an item. |
| `scrollToIndex(index, alignToBeginning?, additionalOffset?, animationMilliseconds?, animationCompletedCallback?)` | Scroll to an index. |
| `scrollToPosition(scrollPosition, animationMilliseconds?, animationCompletedCallback?)` | Scroll to a pixel offset. |
| `refresh()` | Measure and render again. Rarely needed: item and size changes are detected. |
| `invalidateAllCachedMeasurements()` | Forget every cached item size. |
| `invalidateCachedMeasurementForItem(item)` | Forget one item's cached size. |
| `invalidateCachedMeasurementAtIndex(index)` | Forget the cached size at an index. |

```ts
interface IPageInfo {
  startIndex: number;
  endIndex: number;
  scrollStartPosition: number;
  scrollEndPosition: number;
  startIndexWithBuffer: number;
  endIndexWithBuffer: number;
  maxScrollPosition: number;
}
```

`startIndex` and `endIndex` are the 0-based indexes of the first and last visible items, without the buffer.

## Performance

The scroller only renders what is on screen, so scrolling cost is mostly the cost of your row components. Use
`OnPush` row components, keep template expressions cheap, and `track` by a stable id so rows that stay on screen are
reused.

`scrollThrottlingTime` and `scrollDebounceTime` reduce how often the scroller refreshes while scrolling. Use them only
if refreshing is measurably expensive: if the user scrolls past the buffer before a refresh, they see empty space.

## Server-side rendering

Nothing can be measured on the server, so the scroller renders as many items as fit in `ssrViewportWidth` ×
`ssrViewportHeight` at `ssrChildWidth` × `ssrChildHeight`. Set those to typical values for your layout. In the
browser, real measurements take over.

## Coming from ngx-virtual-scroller

This is the maintained fork of `@iharbeck/ngx-virtual-scroller`, which continued Rinto Jose's original
`ngx-virtual-scroller`. The API is the same, apart from what zoneless Angular no longer needs:

- `VirtualScrollerComponent` is standalone. `VirtualScrollerModule` still works but is deprecated.
- `provideVirtualScrollerOptions()` (or the `VIRTUAL_SCROLLER_DEFAULT_OPTIONS` token) replaces the
  `'virtual-scroller-default-options'` string token.
- Removed: `executeRefreshOutsideAngularZone`, `checkResizeInterval` (resizes are observed instead of polled),
  detection of in-place array changes, and the `@tweenjs/tween.js` dependency.
- Outputs are `output()`s. `.subscribe()` still works and returns an `OutputRefSubscription`.

The [changelog](https://github.com/Kareadita/ngx-virtual-scroller/blob/master/CHANGELOG.md) lists every breaking
change. To switch without changing your imports, alias the old package name in `package.json`:

```json
"@iharbeck/ngx-virtual-scroller": "npm:@kareadita/ngx-virtual-scroller@^22.0.0"
```

## Known issues

**Nested scrollbars.** The mouse wheel scrolls the nearest scrollable ancestor under the pointer. If the scroller sits
inside a page that also scrolls, scrolling to the end of the list with the wheel doesn't continue into the page until
the pointer leaves the list.

## Contributing

Issues and pull requests are welcome at [Kareadita/ngx-virtual-scroller](https://github.com/Kareadita/ngx-virtual-scroller).
See [CONTRIBUTING.md](https://github.com/Kareadita/ngx-virtual-scroller/blob/master/CONTRIBUTING.md) for setup, the
checks to run, and how releases are made.

## Authors

- **Rinto Jose** (rintoj), original author
- **Devin Garner** (speige)
- **Pavel Kukushkin** (kykint)
- **Ingo Harbeck** and **Bernhard Behrendt**, `@iharbeck/ngx-virtual-scroller`
- Maintained by the [Kavita](https://github.com/Kareadita/Kavita) team

## AI usage

This fork is maintained by the Kavita team with the help of AI. It is built first for Kavita, but is tested on its
own (unit, browser and end-to-end tests across every layout in the demo) and is safe to use in other projects.

## License

MIT. See [LICENSE](https://github.com/Kareadita/ngx-virtual-scroller/blob/master/LICENSE).
