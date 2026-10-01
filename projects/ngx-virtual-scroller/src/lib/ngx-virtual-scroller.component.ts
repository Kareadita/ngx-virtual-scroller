/* eslint-disable @typescript-eslint/no-explicit-any -- items are whatever the consumer renders, and templates need to
   read their properties, so the public item type stays `any` */
import { isPlatformServer } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  DOCUMENT,
  ElementRef,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  output,
  PLATFORM_ID,
  signal,
  SimpleChanges,
  viewChild,
} from '@angular/core';
import { VIRTUAL_SCROLLER_DEFAULT_OPTIONS } from './virtual-scroller-options';
import { animateScroll, ScrollAnimation } from './scroll-animation';

export interface WrapGroupDimensions {
  maxChildSizePerWrapGroup: (WrapGroupDimension | undefined)[];
  numberOfKnownWrapGroupChildSizes: number;
  sumOfKnownWrapGroupChildHeights: number;
  sumOfKnownWrapGroupChildWidths: number;
}

export interface WrapGroupDimension {
  childHeight: number;
  childWidth: number;
  items: any[];
}

export interface IDimensions {
  childHeight: number;
  childWidth: number;
  itemCount: number;
  itemsPerPage: number;
  itemsPerWrapGroup: number;
  maxScrollPosition: number;
  pageCount_fractional: number;
  scrollLength: number;
  viewportLength: number;
  wrapGroupsPerPage: number;
}

export interface IPageInfo {
  endIndex: number;
  endIndexWithBuffer: number;
  maxScrollPosition: number;
  scrollEndPosition: number;
  scrollStartPosition: number;
  startIndex: number;
  startIndexWithBuffer: number;
}

export interface IViewport extends IPageInfo {
  padding: number;
  scrollLength: number;
  scrollbarLength: number;
}

interface ElementSize {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

type ThrottledFunction = (() => void) & { cancel(): void };

const isWindow = (value: unknown): value is Window => !!value && (value as Window).window === value;

@Component({
  selector: 'virtual-scroller,[virtualScroller]',
  exportAs: 'virtualScroller',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content select="[tab-header]" />
    <div
      class="total-padding"
      [style.height.px]="horizontal ? null : renderedScrollLength()"
      [style.width.px]="horizontal ? renderedScrollLength() : null"
    ></div>
    <div
      #content
      class="scrollable-content"
      [style.transform]="contentTransform()"
      [style.margin-top.px]="useMarginInsteadOfTranslate && !horizontal ? renderedPadding() : null"
      [style.margin-left.px]="useMarginInsteadOfTranslate && horizontal ? renderedPadding() : null"
    >
      <ng-content />
    </div>
    <ng-content select="[tab-footer]" />
  `,
  host: {
    '[class.horizontal]': 'horizontal',
    '[class.vertical]': '!horizontal',
    '[class.selfScroll]': '!parentScroll',
    '[class.rtl]': 'RTL',
  },
  styles: `
    :host {
      position: relative;
      display: block;
      -webkit-overflow-scrolling: touch;
    }

    :host.horizontal.selfScroll {
      overflow-y: visible;
      overflow-x: auto;
    }

    :host.horizontal.selfScroll.rtl {
      transform: scaleX(-1);
    }

    :host.vertical.selfScroll {
      overflow-y: auto;
      overflow-x: visible;
    }

    .scrollable-content {
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      max-width: 100vw;
      max-height: 100vh;
      position: absolute;
    }

    .scrollable-content ::ng-deep > * {
      box-sizing: border-box;
    }

    :host.horizontal {
      white-space: nowrap;
    }

    :host.horizontal .scrollable-content {
      display: flex;
    }

    :host.horizontal .scrollable-content ::ng-deep > * {
      flex-shrink: 0;
      flex-grow: 0;
      white-space: initial;
    }

    :host.horizontal.rtl .scrollable-content ::ng-deep > * {
      transform: scaleX(-1);
    }

    .total-padding {
      width: 1px;
      opacity: 0;
    }

    :host.horizontal .total-padding {
      height: 100%;
    }
  `,
})
export class VirtualScrollerComponent implements OnInit, OnChanges, OnDestroy {
  protected readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  protected readonly document = inject(DOCUMENT);
  protected readonly isAngularUniversalSSR = isPlatformServer(inject(PLATFORM_ID));

  protected readonly contentElementRef = viewChild.required('content', {
    read: ElementRef<HTMLElement>,
  });
  protected readonly containerElementRef = contentChild('container', {
    read: ElementRef<HTMLElement>,
  });

  // Rendering state. Templates (the consumer's and this component's) read these through signals, so a change is
  // rendered in one pass: the items, the padding that positions them, and the total scroll length together.
  protected readonly _viewPortItems = signal<any[]>([]);
  protected readonly _viewport = signal<IViewport | undefined>(undefined);
  protected readonly renderedScrollLength = signal<number | null>(null);
  protected readonly renderedPadding = signal<number | null>(null);

  /** The items currently rendered: the visible slice of `items`, plus the buffer */
  public get viewPortItems(): any[] {
    return this._viewPortItems();
  }

  /** The window this scroller lives in. Bind `[parentScroll]="scroll.window"` to scroll with the page */
  public get window(): Window {
    return this.document.defaultView as Window;
  }

  public get viewPortInfo(): IPageInfo {
    const pageInfo: Partial<IViewport> = this._viewport() ?? {};
    return {
      startIndex: pageInfo.startIndex || 0,
      endIndex: pageInfo.endIndex || 0,
      scrollStartPosition: pageInfo.scrollStartPosition || 0,
      scrollEndPosition: pageInfo.scrollEndPosition || 0,
      maxScrollPosition: pageInfo.maxScrollPosition || 0,
      startIndexWithBuffer: pageInfo.startIndexWithBuffer || 0,
      endIndexWithBuffer: pageInfo.endIndexWithBuffer || 0,
    };
  }

  protected _enableUnequalChildrenSizes = false;
  @Input()
  public get enableUnequalChildrenSizes(): boolean {
    return this._enableUnequalChildrenSizes;
  }

  public set enableUnequalChildrenSizes(value: boolean) {
    if (this._enableUnequalChildrenSizes === value) {
      return;
    }

    this._enableUnequalChildrenSizes = value;
    this.minMeasuredChildWidth = undefined;
    this.minMeasuredChildHeight = undefined;
  }

  @Input()
  public RTL = false;

  @Input()
  public useMarginInsteadOfTranslate = false;

  @Input()
  public modifyOverflowStyleOfParentScroll: boolean;

  @Input()
  public stripedTable: boolean;

  @Input()
  public scrollbarWidth: number | undefined;

  @Input()
  public scrollbarHeight: number | undefined;

  @Input()
  public childWidth: number | undefined;

  @Input()
  public childHeight: number | undefined;

  @Input()
  public ssrChildWidth: number | undefined;

  @Input()
  public ssrChildHeight: number | undefined;

  @Input()
  public ssrViewportWidth = 1920;

  @Input()
  public ssrViewportHeight = 1080;

  protected _bufferAmount: number | undefined;
  @Input()
  public get bufferAmount(): number {
    if (typeof this._bufferAmount === 'number' && this._bufferAmount >= 0) {
      return this._bufferAmount;
    } else {
      return this.enableUnequalChildrenSizes ? 5 : 0;
    }
  }

  public set bufferAmount(value: number | undefined) {
    this._bufferAmount = value;
  }

  @Input()
  public scrollAnimationTime: number;

  @Input()
  public resizeBypassRefreshThreshold: number;

  protected _scrollThrottlingTime = 0;
  @Input()
  public get scrollThrottlingTime(): number {
    return this._scrollThrottlingTime;
  }

  public set scrollThrottlingTime(value: number) {
    this._scrollThrottlingTime = value;
    this.updateOnScrollFunction();
  }

  protected _scrollDebounceTime = 0;
  @Input()
  public get scrollDebounceTime(): number {
    return this._scrollDebounceTime;
  }

  public set scrollDebounceTime(value: number) {
    this._scrollDebounceTime = value;
    this.updateOnScrollFunction();
  }

  protected onScroll!: () => void;

  protected updateOnScrollFunction(): void {
    // Scroll events are measured right away instead of in the next animation frame. Scroll events fire before the
    // frame's rAF callbacks, so the render this schedules still lands before the frame paints.
    if (this.scrollDebounceTime) {
      this.onScroll = this.debounce(
        () => this.refresh_internal(false, undefined, 2, true),
        this.scrollDebounceTime,
      );
    } else if (this.scrollThrottlingTime) {
      this.onScroll = this.throttleTrailing(
        () => this.refresh_internal(false, undefined, 2, true),
        this.scrollThrottlingTime,
      );
    } else {
      this.onScroll = () => this.refresh_internal(false, undefined, 2, true);
    }
  }

  protected _items: any[] = [];
  /** The full list. Replace the array to change it; in-place mutations are not detected */
  @Input()
  public get items(): any[] {
    return this._items;
  }

  public set items(value: any[]) {
    if (value === this._items) {
      return;
    }

    this._items = value || [];
    this.refresh_internal(true);
  }

  @Input()
  public compareItems: (item1: any, item2: any) => boolean = (item1: any, item2: any) =>
    item1 === item2;

  protected _horizontal = false;
  @Input()
  public get horizontal(): boolean {
    return this._horizontal;
  }

  public set horizontal(value: boolean) {
    this._horizontal = value;
    this.updateDirection();
  }

  protected revertParentOverscroll(): void {
    const scrollElement = this.getScrollElement();
    if (scrollElement && this.oldParentScrollOverflow) {
      scrollElement.style.overflowY = this.oldParentScrollOverflow.y;
      scrollElement.style.overflowX = this.oldParentScrollOverflow.x;
    }

    this.oldParentScrollOverflow = undefined;
  }

  protected oldParentScrollOverflow: { x: string; y: string } | undefined;
  protected _parentScroll: Element | Window | undefined;
  @Input()
  public get parentScroll(): Element | Window | undefined {
    return this._parentScroll;
  }

  public set parentScroll(value: Element | Window | undefined) {
    if (this._parentScroll === value) {
      return;
    }

    this.revertParentOverscroll();
    this._parentScroll = value;
    this.addScrollEventHandlers();

    const scrollElement = this.getScrollElement();
    if (this.modifyOverflowStyleOfParentScroll && scrollElement !== this.element.nativeElement) {
      this.oldParentScrollOverflow = {
        x: scrollElement.style.overflowX,
        y: scrollElement.style.overflowY,
      };
      scrollElement.style.overflowY = this.horizontal ? 'visible' : 'auto';
      scrollElement.style.overflowX = this.horizontal ? 'auto' : 'visible';
    }
  }

  public readonly vsUpdate = output<any[]>();

  public readonly vsChange = output<IPageInfo>();

  public readonly vsStart = output<IPageInfo>();

  public readonly vsEnd = output<IPageInfo>();

  constructor() {
    const options = inject(VIRTUAL_SCROLLER_DEFAULT_OPTIONS);

    this.modifyOverflowStyleOfParentScroll = options.modifyOverflowStyleOfParentScroll;
    this.resizeBypassRefreshThreshold = options.resizeBypassRefreshThreshold;
    this.scrollAnimationTime = options.scrollAnimationTime;
    this.scrollDebounceTime = options.scrollDebounceTime;
    this.scrollThrottlingTime = options.scrollThrottlingTime;
    this.scrollbarHeight = options.scrollbarHeight;
    this.scrollbarWidth = options.scrollbarWidth;
    this.stripedTable = options.stripedTable;

    this.horizontal = false;
    this.resetWrapGroupDimensions();
  }

  public ngOnInit(): void {
    this.addScrollEventHandlers();
    this.observeVisibility();
  }

  public ngOnDestroy(): void {
    this.destroyed = true;
    this.currentAnimation?.stop();
    this.disposeVisibilityObserver?.();
    this.removeScrollEventHandlers();
    this.revertParentOverscroll();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    const indexLengthChanged = this.cachedItemsLength !== this.items.length;
    this.cachedItemsLength = this.items.length;

    const firstRun: boolean =
      !changes['items'] ||
      !changes['items'].previousValue ||
      changes['items'].previousValue.length === 0;
    this.refresh_internal(indexLengthChanged || firstRun);
  }

  public refresh(): void {
    this.refresh_internal(true);
  }

  public invalidateAllCachedMeasurements(): void {
    this.wrapGroupDimensions = {
      maxChildSizePerWrapGroup: [],
      numberOfKnownWrapGroupChildSizes: 0,
      sumOfKnownWrapGroupChildWidths: 0,
      sumOfKnownWrapGroupChildHeights: 0,
    };

    this.minMeasuredChildWidth = undefined;
    this.minMeasuredChildHeight = undefined;

    this.refresh_internal(false);
  }

  public invalidateCachedMeasurementForItem(item: any): void {
    if (this.enableUnequalChildrenSizes) {
      const index = this.items && this.items.indexOf(item);
      if (index >= 0) {
        this.invalidateCachedMeasurementAtIndex(index);
      }
    } else {
      this.minMeasuredChildWidth = undefined;
      this.minMeasuredChildHeight = undefined;
    }

    this.refresh_internal(false);
  }

  public invalidateCachedMeasurementAtIndex(index: number): void {
    if (this.enableUnequalChildrenSizes) {
      const cachedMeasurement = this.wrapGroupDimensions.maxChildSizePerWrapGroup[index];
      if (cachedMeasurement) {
        this.wrapGroupDimensions.maxChildSizePerWrapGroup[index] = undefined;
        --this.wrapGroupDimensions.numberOfKnownWrapGroupChildSizes;
        this.wrapGroupDimensions.sumOfKnownWrapGroupChildWidths -=
          cachedMeasurement.childWidth || 0;
        this.wrapGroupDimensions.sumOfKnownWrapGroupChildHeights -=
          cachedMeasurement.childHeight || 0;
      }
    } else {
      this.minMeasuredChildWidth = undefined;
      this.minMeasuredChildHeight = undefined;
    }

    this.refresh_internal(false);
  }

  public scrollInto(
    item: any,
    alignToBeginning = true,
    additionalOffset = 0,
    animationMilliseconds?: number,
    animationCompletedCallback?: () => void,
  ): void {
    const index: number = this.items.indexOf(item);
    if (index === -1) {
      return;
    }

    this.scrollToIndex(
      index,
      alignToBeginning,
      additionalOffset,
      animationMilliseconds,
      animationCompletedCallback,
    );
  }

  public scrollToIndex(
    index: number,
    alignToBeginning = true,
    additionalOffset = 0,
    animationMilliseconds?: number,
    animationCompletedCallback?: () => void,
  ): void {
    let maxRetries = 5;

    const retryIfNeeded = () => {
      --maxRetries;
      if (maxRetries <= 0) {
        animationCompletedCallback?.();
        return;
      }

      const dimensions = this.calculateDimensions();
      const desiredStartIndex = Math.min(Math.max(index, 0), dimensions.itemCount - 1);
      if (this.previousViewPort.startIndex === desiredStartIndex) {
        animationCompletedCallback?.();
        return;
      }

      this.scrollToIndex_internal(index, alignToBeginning, additionalOffset, 0, retryIfNeeded);
    };

    this.scrollToIndex_internal(
      index,
      alignToBeginning,
      additionalOffset,
      animationMilliseconds,
      retryIfNeeded,
    );
  }

  protected scrollToIndex_internal(
    index: number,
    alignToBeginning = true,
    additionalOffset = 0,
    animationMilliseconds?: number,
    animationCompletedCallback?: () => void,
  ): void {
    animationMilliseconds =
      animationMilliseconds === undefined ? this.scrollAnimationTime : animationMilliseconds;

    const dimensions = this.calculateDimensions();
    let scroll = this.calculatePadding(index, dimensions) + additionalOffset;
    if (!alignToBeginning) {
      scroll -= dimensions.wrapGroupsPerPage * dimensions[this._childScrollDim];
    }

    this.scrollToPosition(scroll, animationMilliseconds, animationCompletedCallback);
  }

  public scrollToPosition(
    scrollPosition: number,
    animationMilliseconds?: number,
    animationCompletedCallback?: () => void,
  ): void {
    scrollPosition += this.getElementsOffset();

    animationMilliseconds =
      animationMilliseconds === undefined ? this.scrollAnimationTime : animationMilliseconds;

    const scrollElement = this.getScrollElement();

    this.currentAnimation?.stop();
    this.currentAnimation = undefined;

    if (!animationMilliseconds) {
      scrollElement[this._scrollType] = scrollPosition;
      this.refresh_internal(false, animationCompletedCallback);
      return;
    }

    this.currentAnimation = animateScroll(
      scrollElement[this._scrollType],
      scrollPosition,
      animationMilliseconds,
      (position) => {
        scrollElement[this._scrollType] = position;
        this.refresh_internal(false);
      },
      () => {
        this.currentAnimation = undefined;
        this.refresh_internal(false, animationCompletedCallback);
      },
    );
  }

  protected getElementSize(element: HTMLElement): ElementSize {
    const result = element.getBoundingClientRect();
    const styles = this.window.getComputedStyle(element);
    const marginTop = parseInt(styles.marginTop, 10) || 0;
    const marginBottom = parseInt(styles.marginBottom, 10) || 0;
    const marginLeft = parseInt(styles.marginLeft, 10) || 0;
    const marginRight = parseInt(styles.marginRight, 10) || 0;

    return {
      top: result.top + marginTop,
      bottom: result.bottom + marginBottom,
      left: result.left + marginLeft,
      right: result.right + marginRight,
      width: result.width + marginLeft + marginRight,
      height: result.height + marginTop + marginBottom,
    };
  }

  protected previousScrollBoundingRect: ElementSize | undefined;

  protected checkScrollElementResized(): void {
    const boundingRect = this.getElementSize(this.getScrollElement());

    let sizeChanged: boolean;
    if (!this.previousScrollBoundingRect) {
      sizeChanged = true;
    } else {
      const widthChange = Math.abs(boundingRect.width - this.previousScrollBoundingRect.width);
      const heightChange = Math.abs(boundingRect.height - this.previousScrollBoundingRect.height);
      sizeChanged =
        widthChange > this.resizeBypassRefreshThreshold ||
        heightChange > this.resizeBypassRefreshThreshold;
    }

    if (sizeChanged) {
      this.previousScrollBoundingRect = boundingRect;
      if (boundingRect.width > 0 && boundingRect.height > 0) {
        this.refresh_internal(false);
      }
    }
  }

  protected _offsetType!: 'offsetLeft' | 'offsetTop';
  protected _scrollType!: 'scrollLeft' | 'scrollTop';
  protected _pageOffsetType!: 'scrollX' | 'scrollY';
  protected _childScrollDim!: 'childWidth' | 'childHeight';

  protected updateDirection(): void {
    if (this.horizontal) {
      this._childScrollDim = 'childWidth';
      this._offsetType = 'offsetLeft';
      this._pageOffsetType = 'scrollX';
      this._scrollType = 'scrollLeft';
    } else {
      this._childScrollDim = 'childHeight';
      this._offsetType = 'offsetTop';
      this._pageOffsetType = 'scrollY';
      this._scrollType = 'scrollTop';
    }
  }

  protected contentTransform(): string | null {
    const padding = this.renderedPadding();
    if (this.useMarginInsteadOfTranslate || padding === null) {
      return null;
    }
    return `${this.horizontal ? 'translateX' : 'translateY'}(${padding}px)`;
  }

  protected debounce(func: () => void, wait: number): ThrottledFunction {
    const throttled = this.throttleTrailing(func, wait);
    const result = (() => {
      throttled.cancel();
      throttled();
    }) as ThrottledFunction;
    result.cancel = () => throttled.cancel();

    return result;
  }

  protected throttleTrailing(func: () => void, wait: number): ThrottledFunction {
    let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
    const result = (() => {
      if (timeout) {
        return;
      }

      if (wait <= 0) {
        func();
      } else {
        timeout = setTimeout(() => {
          timeout = undefined;
          func();
        }, wait);
      }
    }) as ThrottledFunction;
    result.cancel = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
    };

    return result;
  }

  protected calculatedScrollbarWidth = 0;
  protected calculatedScrollbarHeight = 0;

  protected previousViewPort: IViewport = {} as IViewport;
  protected currentAnimation: ScrollAnimation | undefined;
  protected cachedItemsLength: number | undefined;
  protected destroyed = false;
  protected refreshPendingWhileHidden = false;
  protected itemsModifiedWhileHidden = false;
  protected disposeVisibilityObserver: (() => void) | undefined;

  /** True when the scroller isn't rendered, e.g. it sits in an inactive tab */
  protected isHidden(): boolean {
    return !this.isAngularUniversalSSR && this.element.nativeElement.getClientRects().length === 0;
  }

  /** Runs the refreshes skipped while hidden as soon as the scroller is shown again */
  protected observeVisibility(): void {
    if (this.isAngularUniversalSSR || typeof ResizeObserver !== 'function') {
      return;
    }

    // Going from display: none to displayed changes the element's size, which fires the observer
    const observer = new ResizeObserver(() => {
      if (!this.refreshPendingWhileHidden || this.isHidden()) {
        return;
      }

      const itemsArrayModified = this.itemsModifiedWhileHidden;
      this.refreshPendingWhileHidden = false;
      this.itemsModifiedWhileHidden = false;
      this.refresh_internal(itemsArrayModified);
    });
    observer.observe(this.element.nativeElement);
    this.disposeVisibilityObserver = () => observer.disconnect();
  }

  protected disposeScrollHandler: (() => void) | undefined;
  protected disposeResizeHandler: (() => void) | undefined;

  protected refresh_internal(
    itemsArrayModified: boolean,
    refreshCompletedCallback?: () => void,
    maxRunTimes = 2,
    immediate = false,
  ): void {
    //note: maxRunTimes is to force it to keep recalculating if the previous iteration caused a re-render (different sliced items in viewport or scrollPosition changed).
    //The default of 2x max will probably be accurate enough without causing too large a performance bottleneck
    //The code would typically quit out on the 2nd iteration anyways. The main time it'd think more than 2 runs would be necessary would be for vastly different sized child items or if this is the 1st time the items array was initialized.
    //Without maxRunTimes, If the user is actively scrolling this code would become an infinite loop until they stopped scrolling. This would be okay, except each scroll event would start an additional infinte loop. We want to short-circuit it to prevent this.

    if (
      itemsArrayModified &&
      this.previousViewPort &&
      this.previousViewPort.scrollStartPosition > 0
    ) {
      //if items were prepended, scroll forward to keep same items visible
      const oldViewPort = this.previousViewPort;
      const oldViewPortItems = this.viewPortItems;

      const oldRefreshCompletedCallback = refreshCompletedCallback;
      refreshCompletedCallback = () => {
        const scrollLengthDelta = this.previousViewPort.scrollLength - oldViewPort.scrollLength;
        if (scrollLengthDelta > 0 && this.viewPortItems) {
          const oldStartItem = oldViewPortItems[0];
          const oldStartItemIndex = this.items.findIndex((x) => this.compareItems(oldStartItem, x));
          if (oldStartItemIndex > this.previousViewPort.startIndexWithBuffer) {
            let itemOrderChanged = false;
            for (let i = 1; i < this.viewPortItems.length; ++i) {
              if (!this.compareItems(this.items[oldStartItemIndex + i], oldViewPortItems[i])) {
                itemOrderChanged = true;
                break;
              }
            }

            if (!itemOrderChanged) {
              this.scrollToPosition(
                this.previousViewPort.scrollStartPosition + scrollLengthDelta,
                0,
                oldRefreshCompletedCallback,
              );
              return;
            }
          }
        }

        oldRefreshCompletedCallback?.();
      };
    }

    const refresh = () => {
      if (this.destroyed) {
        return;
      }

      // A hidden scroller (display: none somewhere above it, like an inactive tab) can't measure its items. Measuring
      // anyway would cache their 0px height as the item size, and the scroller would then render the whole list.
      // Catch up once it is shown again (see observeVisibility).
      if (this.isHidden()) {
        this.refreshPendingWhileHidden = true;
        this.itemsModifiedWhileHidden ||= itemsArrayModified;
        refreshCompletedCallback?.();
        return;
      }

      if (itemsArrayModified) {
        this.resetWrapGroupDimensions();
      }
      const viewport = this.calculateViewport();

      const startChanged =
        itemsArrayModified || viewport.startIndex !== this.previousViewPort.startIndex;
      const endChanged = itemsArrayModified || viewport.endIndex !== this.previousViewPort.endIndex;
      const scrollbarLengthChanged =
        viewport.scrollbarLength !== this.previousViewPort.scrollbarLength;
      const paddingChanged = viewport.padding !== this.previousViewPort.padding;
      const scrollPositionChanged =
        viewport.scrollStartPosition !== this.previousViewPort.scrollStartPosition ||
        viewport.scrollEndPosition !== this.previousViewPort.scrollEndPosition ||
        viewport.maxScrollPosition !== this.previousViewPort.maxScrollPosition;

      this.previousViewPort = viewport;

      // Padding and scroll length are rendered through template bindings, in the same pass as the items they
      // belong to. Writing them to the DOM directly while the items wait for change detection paints rows shifted.
      this.renderedScrollLength.set(viewport.scrollLength);
      this.renderedPadding.set(viewport.padding);

      if (startChanged || endChanged || scrollPositionChanged) {
        const changeEventArg: IPageInfo = {
          startIndex: viewport.startIndex,
          endIndex: viewport.endIndex,
          scrollStartPosition: viewport.scrollStartPosition,
          scrollEndPosition: viewport.scrollEndPosition,
          startIndexWithBuffer: viewport.startIndexWithBuffer,
          endIndexWithBuffer: viewport.endIndexWithBuffer,
          maxScrollPosition: viewport.maxScrollPosition,
        };

        // update the scroll list to trigger re-render of components in viewport
        this._viewPortItems.set(
          viewport.startIndexWithBuffer >= 0 && viewport.endIndexWithBuffer >= 0
            ? this.items.slice(viewport.startIndexWithBuffer, viewport.endIndexWithBuffer + 1)
            : [],
        );
        this._viewport.set(viewport);
        this.vsUpdate.emit(this.viewPortItems);

        if (startChanged) {
          this.vsStart.emit(changeEventArg);
        }

        if (endChanged) {
          this.vsEnd.emit(changeEventArg);
        }

        if (startChanged || endChanged) {
          this.vsChange.emit(changeEventArg);
        }

        if (maxRunTimes > 0) {
          this.refresh_internal(false, refreshCompletedCallback, maxRunTimes - 1);
          return;
        }

        refreshCompletedCallback?.();
      } else {
        if (maxRunTimes > 0 && (scrollbarLengthChanged || paddingChanged)) {
          this.refresh_internal(false, refreshCompletedCallback, maxRunTimes - 1);
          return;
        }

        refreshCompletedCallback?.();
      }
    };

    if (immediate) {
      refresh();
    } else if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(refresh);
    } else {
      setTimeout(refresh);
    }
  }

  protected getScrollElement(): HTMLElement {
    return isWindow(this.parentScroll)
      ? (this.document.scrollingElement as HTMLElement) ||
          this.document.documentElement ||
          this.document.body
      : (this.parentScroll as HTMLElement) || this.element.nativeElement;
  }

  protected addScrollEventHandlers(): void {
    if (this.isAngularUniversalSSR) {
      return;
    }

    const scrollElement = this.getScrollElement();

    this.removeScrollEventHandlers();

    // A stable wrapper, so a later change to scrollThrottlingTime/scrollDebounceTime takes effect
    const onScroll = () => this.onScroll();
    const listenerOptions: AddEventListenerOptions = { passive: true };

    if (isWindow(this.parentScroll)) {
      const win = this.window;
      win.addEventListener('scroll', onScroll, listenerOptions);
      win.addEventListener('resize', onScroll, listenerOptions);
      this.disposeScrollHandler = () => win.removeEventListener('scroll', onScroll);
      this.disposeResizeHandler = () => win.removeEventListener('resize', onScroll);
    } else {
      scrollElement.addEventListener('scroll', onScroll, listenerOptions);
      this.disposeScrollHandler = () => scrollElement.removeEventListener('scroll', onScroll);
      if (typeof ResizeObserver === 'function') {
        const observer = new ResizeObserver(() => this.checkScrollElementResized());
        observer.observe(scrollElement);
        this.disposeResizeHandler = () => observer.disconnect();
      }
    }
  }

  protected removeScrollEventHandlers(): void {
    this.disposeScrollHandler?.();
    this.disposeScrollHandler = undefined;

    this.disposeResizeHandler?.();
    this.disposeResizeHandler = undefined;
  }

  protected getElementsOffset(): number {
    if (this.isAngularUniversalSSR) {
      return 0;
    }

    let offset = 0;

    const container = this.containerElementRef()?.nativeElement;
    if (container) {
      offset += container[this._offsetType];
    }

    if (this.parentScroll) {
      const scrollElement = this.getScrollElement();
      const elementClientRect = this.getElementSize(this.element.nativeElement);
      const scrollClientRect = this.getElementSize(scrollElement);
      if (this.horizontal) {
        offset += elementClientRect.left - scrollClientRect.left;
      } else {
        offset += elementClientRect.top - scrollClientRect.top;
      }

      if (!isWindow(this.parentScroll)) {
        offset += scrollElement[this._scrollType];
      }
    }

    return offset;
  }

  /** The element whose children are the rendered items: the consumer's #container, or the projected content */
  protected getItemsContainer(): HTMLElement {
    return this.containerElementRef()?.nativeElement ?? this.contentElementRef().nativeElement;
  }

  protected countItemsPerWrapGroup(): number {
    if (this.isAngularUniversalSSR) {
      return Math.round(
        this.horizontal
          ? this.ssrViewportHeight / (this.ssrChildHeight ?? NaN)
          : this.ssrViewportWidth / (this.ssrChildWidth ?? NaN),
      );
    }

    const propertyName = this.horizontal ? 'offsetLeft' : 'offsetTop';
    const children = this.getItemsContainer().children as HTMLCollectionOf<HTMLElement>;

    const childrenLength = children ? children.length : 0;
    if (childrenLength === 0) {
      return 1;
    }

    const firstOffset = children[0][propertyName];
    let result = 1;
    while (result < childrenLength && firstOffset === children[result][propertyName]) {
      ++result;
    }

    return result;
  }

  protected getScrollStartPosition(): number {
    let windowScrollValue: number | undefined = undefined;
    if (isWindow(this.parentScroll)) {
      windowScrollValue = this.window[this._pageOffsetType];
    }

    return windowScrollValue || this.getScrollElement()[this._scrollType] || 0;
  }

  protected minMeasuredChildWidth: number | undefined;
  protected minMeasuredChildHeight: number | undefined;

  protected wrapGroupDimensions!: WrapGroupDimensions;

  protected resetWrapGroupDimensions(): void {
    const oldWrapGroupDimensions = this.wrapGroupDimensions;
    this.invalidateAllCachedMeasurements();

    if (
      !this.enableUnequalChildrenSizes ||
      !oldWrapGroupDimensions ||
      oldWrapGroupDimensions.numberOfKnownWrapGroupChildSizes === 0
    ) {
      return;
    }

    const itemsPerWrapGroup: number = this.countItemsPerWrapGroup();
    for (
      let wrapGroupIndex = 0;
      wrapGroupIndex < oldWrapGroupDimensions.maxChildSizePerWrapGroup.length;
      ++wrapGroupIndex
    ) {
      const oldWrapGroupDimension: WrapGroupDimension | undefined =
        oldWrapGroupDimensions.maxChildSizePerWrapGroup[wrapGroupIndex];
      if (
        !oldWrapGroupDimension ||
        !oldWrapGroupDimension.items ||
        !oldWrapGroupDimension.items.length
      ) {
        continue;
      }

      if (oldWrapGroupDimension.items.length !== itemsPerWrapGroup) {
        return;
      }

      let itemsChanged = false;
      const arrayStartIndex = itemsPerWrapGroup * wrapGroupIndex;
      for (let i = 0; i < itemsPerWrapGroup; ++i) {
        if (!this.compareItems(oldWrapGroupDimension.items[i], this.items[arrayStartIndex + i])) {
          itemsChanged = true;
          break;
        }
      }

      if (!itemsChanged) {
        ++this.wrapGroupDimensions.numberOfKnownWrapGroupChildSizes;
        this.wrapGroupDimensions.sumOfKnownWrapGroupChildWidths +=
          oldWrapGroupDimension.childWidth || 0;
        this.wrapGroupDimensions.sumOfKnownWrapGroupChildHeights +=
          oldWrapGroupDimension.childHeight || 0;
        this.wrapGroupDimensions.maxChildSizePerWrapGroup[wrapGroupIndex] = oldWrapGroupDimension;
      }
    }
  }

  protected calculateDimensions(): IDimensions {
    const scrollElement = this.getScrollElement();

    const maxCalculatedScrollBarSize = 25; // Note: Formula to auto-calculate doesn't work for ParentScroll, so we default to this if not set by consuming application
    this.calculatedScrollbarHeight = Math.max(
      Math.min(scrollElement.offsetHeight - scrollElement.clientHeight, maxCalculatedScrollBarSize),
      this.calculatedScrollbarHeight,
    );
    this.calculatedScrollbarWidth = Math.max(
      Math.min(scrollElement.offsetWidth - scrollElement.clientWidth, maxCalculatedScrollBarSize),
      this.calculatedScrollbarWidth,
    );

    let viewportWidth =
      scrollElement.offsetWidth -
      (this.scrollbarWidth ||
        this.calculatedScrollbarWidth ||
        (this.horizontal ? 0 : maxCalculatedScrollBarSize));
    let viewportHeight =
      scrollElement.offsetHeight -
      (this.scrollbarHeight ||
        this.calculatedScrollbarHeight ||
        (this.horizontal ? maxCalculatedScrollBarSize : 0));

    const content = this.getItemsContainer();

    const itemsPerWrapGroup = this.countItemsPerWrapGroup();
    let wrapGroupsPerPage: number;

    let defaultChildWidth: number;
    let defaultChildHeight: number;

    if (this.isAngularUniversalSSR) {
      viewportWidth = this.ssrViewportWidth;
      viewportHeight = this.ssrViewportHeight;
      defaultChildWidth = this.ssrChildWidth ?? NaN;
      defaultChildHeight = this.ssrChildHeight ?? NaN;
      const itemsPerRow = Math.max(Math.ceil(viewportWidth / defaultChildWidth), 1);
      const itemsPerCol = Math.max(Math.ceil(viewportHeight / defaultChildHeight), 1);
      wrapGroupsPerPage = this.horizontal ? itemsPerRow : itemsPerCol;
    } else if (!this.enableUnequalChildrenSizes) {
      if (content.children.length > 0) {
        if (!this.childWidth || !this.childHeight) {
          if (!this.minMeasuredChildWidth && viewportWidth > 0) {
            this.minMeasuredChildWidth = viewportWidth;
          }
          if (!this.minMeasuredChildHeight && viewportHeight > 0) {
            this.minMeasuredChildHeight = viewportHeight;
          }
        }

        const child = content.children[0] as HTMLElement;
        const clientRect = this.getElementSize(child);
        this.minMeasuredChildWidth = Math.min(this.minMeasuredChildWidth ?? NaN, clientRect.width);
        this.minMeasuredChildHeight = Math.min(
          this.minMeasuredChildHeight ?? NaN,
          clientRect.height,
        );
      }

      defaultChildWidth = this.childWidth || this.minMeasuredChildWidth || viewportWidth;
      defaultChildHeight = this.childHeight || this.minMeasuredChildHeight || viewportHeight;
      const itemsPerRow = Math.max(Math.ceil(viewportWidth / defaultChildWidth), 1);
      const itemsPerCol = Math.max(Math.ceil(viewportHeight / defaultChildHeight), 1);
      wrapGroupsPerPage = this.horizontal ? itemsPerRow : itemsPerCol;
    } else {
      let scrollOffset =
        scrollElement[this._scrollType] -
        (this.previousViewPort ? this.previousViewPort.padding : 0);

      let arrayStartIndex = this.previousViewPort.startIndexWithBuffer || 0;
      let wrapGroupIndex = Math.ceil(arrayStartIndex / itemsPerWrapGroup);

      let maxWidthForWrapGroup = 0;
      let maxHeightForWrapGroup = 0;
      let sumOfVisibleMaxWidths = 0;
      let sumOfVisibleMaxHeights = 0;
      wrapGroupsPerPage = 0;

      for (const child of Array.from(content.children) as HTMLElement[]) {
        ++arrayStartIndex;
        const clientRect = this.getElementSize(child);

        maxWidthForWrapGroup = Math.max(maxWidthForWrapGroup, clientRect.width);
        maxHeightForWrapGroup = Math.max(maxHeightForWrapGroup, clientRect.height);

        if (arrayStartIndex % itemsPerWrapGroup === 0) {
          const oldValue = this.wrapGroupDimensions.maxChildSizePerWrapGroup[wrapGroupIndex];
          if (oldValue) {
            --this.wrapGroupDimensions.numberOfKnownWrapGroupChildSizes;
            this.wrapGroupDimensions.sumOfKnownWrapGroupChildWidths -= oldValue.childWidth || 0;
            this.wrapGroupDimensions.sumOfKnownWrapGroupChildHeights -= oldValue.childHeight || 0;
          }

          ++this.wrapGroupDimensions.numberOfKnownWrapGroupChildSizes;
          const items = this.items.slice(arrayStartIndex - itemsPerWrapGroup, arrayStartIndex);
          this.wrapGroupDimensions.maxChildSizePerWrapGroup[wrapGroupIndex] = {
            childWidth: maxWidthForWrapGroup,
            childHeight: maxHeightForWrapGroup,
            items: items,
          };
          this.wrapGroupDimensions.sumOfKnownWrapGroupChildWidths += maxWidthForWrapGroup;
          this.wrapGroupDimensions.sumOfKnownWrapGroupChildHeights += maxHeightForWrapGroup;

          if (this.horizontal) {
            let maxVisibleWidthForWrapGroup = Math.min(
              maxWidthForWrapGroup,
              Math.max(viewportWidth - sumOfVisibleMaxWidths, 0),
            );
            if (scrollOffset > 0) {
              const scrollOffsetToRemove = Math.min(scrollOffset, maxVisibleWidthForWrapGroup);
              maxVisibleWidthForWrapGroup -= scrollOffsetToRemove;
              scrollOffset -= scrollOffsetToRemove;
            }

            sumOfVisibleMaxWidths += maxVisibleWidthForWrapGroup;
            if (maxVisibleWidthForWrapGroup > 0 && viewportWidth >= sumOfVisibleMaxWidths) {
              ++wrapGroupsPerPage;
            }
          } else {
            let maxVisibleHeightForWrapGroup = Math.min(
              maxHeightForWrapGroup,
              Math.max(viewportHeight - sumOfVisibleMaxHeights, 0),
            );
            if (scrollOffset > 0) {
              const scrollOffsetToRemove = Math.min(scrollOffset, maxVisibleHeightForWrapGroup);
              maxVisibleHeightForWrapGroup -= scrollOffsetToRemove;
              scrollOffset -= scrollOffsetToRemove;
            }

            sumOfVisibleMaxHeights += maxVisibleHeightForWrapGroup;
            if (maxVisibleHeightForWrapGroup > 0 && viewportHeight >= sumOfVisibleMaxHeights) {
              ++wrapGroupsPerPage;
            }
          }

          ++wrapGroupIndex;

          maxWidthForWrapGroup = 0;
          maxHeightForWrapGroup = 0;
        }
      }

      const averageChildWidth =
        this.wrapGroupDimensions.sumOfKnownWrapGroupChildWidths /
        this.wrapGroupDimensions.numberOfKnownWrapGroupChildSizes;
      const averageChildHeight =
        this.wrapGroupDimensions.sumOfKnownWrapGroupChildHeights /
        this.wrapGroupDimensions.numberOfKnownWrapGroupChildSizes;
      defaultChildWidth = this.childWidth || averageChildWidth || viewportWidth;
      defaultChildHeight = this.childHeight || averageChildHeight || viewportHeight;

      if (this.horizontal) {
        if (viewportWidth > sumOfVisibleMaxWidths) {
          wrapGroupsPerPage += Math.ceil(
            (viewportWidth - sumOfVisibleMaxWidths) / defaultChildWidth,
          );
        }
      } else {
        if (viewportHeight > sumOfVisibleMaxHeights) {
          wrapGroupsPerPage += Math.ceil(
            (viewportHeight - sumOfVisibleMaxHeights) / defaultChildHeight,
          );
        }
      }
    }

    const itemCount = this.items.length;
    const itemsPerPage = itemsPerWrapGroup * wrapGroupsPerPage;
    const pageCount_fractional = itemCount / itemsPerPage;
    const numberOfWrapGroups = Math.ceil(itemCount / itemsPerWrapGroup);

    let scrollLength = 0;

    const defaultScrollLengthPerWrapGroup = this.horizontal
      ? defaultChildWidth
      : defaultChildHeight;
    if (this.enableUnequalChildrenSizes) {
      let numUnknownChildSizes = 0;
      for (let i = 0; i < numberOfWrapGroups; ++i) {
        const childSize =
          this.wrapGroupDimensions.maxChildSizePerWrapGroup[i]?.[this._childScrollDim];
        if (childSize) {
          scrollLength += childSize;
        } else {
          ++numUnknownChildSizes;
        }
      }

      scrollLength += Math.round(numUnknownChildSizes * defaultScrollLengthPerWrapGroup);
    } else {
      scrollLength = numberOfWrapGroups * defaultScrollLengthPerWrapGroup;
    }

    const viewportLength = this.horizontal ? viewportWidth : viewportHeight;
    const maxScrollPosition = Math.max(scrollLength - viewportLength, 0);

    return {
      childHeight: defaultChildHeight,
      childWidth: defaultChildWidth,
      itemCount: itemCount,
      itemsPerPage: itemsPerPage,
      itemsPerWrapGroup: itemsPerWrapGroup,
      maxScrollPosition: maxScrollPosition,
      pageCount_fractional: pageCount_fractional,
      scrollLength: scrollLength,
      viewportLength: viewportLength,
      wrapGroupsPerPage: wrapGroupsPerPage,
    };
  }

  protected calculatePadding(arrayStartIndexWithBuffer: number, dimensions: IDimensions): number {
    if (dimensions.itemCount === 0) {
      return 0;
    }

    const defaultScrollLengthPerWrapGroup = dimensions[this._childScrollDim];
    const startingWrapGroupIndex =
      Math.floor(arrayStartIndexWithBuffer / dimensions.itemsPerWrapGroup) || 0;

    if (!this.enableUnequalChildrenSizes) {
      return defaultScrollLengthPerWrapGroup * startingWrapGroupIndex;
    }

    let numUnknownChildSizes = 0;
    let result = 0;
    for (let i = 0; i < startingWrapGroupIndex; ++i) {
      const childSize =
        this.wrapGroupDimensions.maxChildSizePerWrapGroup[i]?.[this._childScrollDim];
      if (childSize) {
        result += childSize;
      } else {
        ++numUnknownChildSizes;
      }
    }
    result += Math.round(numUnknownChildSizes * defaultScrollLengthPerWrapGroup);

    return result;
  }

  protected calculatePageInfo(scrollPosition: number, dimensions: IDimensions): IPageInfo {
    let arrayStartIndex: number;
    let arrayEndIndex: number;
    if (this.enableUnequalChildrenSizes) {
      const numberOfWrapGroups = Math.ceil(dimensions.itemCount / dimensions.itemsPerWrapGroup);
      let totalScrolledLength = 0;
      const defaultScrollLengthPerWrapGroup = dimensions[this._childScrollDim];
      let i = 0;
      for (; i < numberOfWrapGroups; ++i) {
        const childSize =
          this.wrapGroupDimensions.maxChildSizePerWrapGroup[i]?.[this._childScrollDim];
        if (childSize) {
          totalScrolledLength += childSize;
        } else {
          totalScrolledLength += defaultScrollLengthPerWrapGroup;
        }

        if (scrollPosition < totalScrolledLength) {
          break;
        }
      }
      let j = i + 1;
      for (; j < numberOfWrapGroups; ++j) {
        const childSize =
          this.wrapGroupDimensions.maxChildSizePerWrapGroup[j]?.[this._childScrollDim];
        if (childSize) {
          totalScrolledLength += childSize;
        } else {
          totalScrolledLength += defaultScrollLengthPerWrapGroup;
        }
        if (scrollPosition + dimensions.viewportLength < totalScrolledLength) {
          break;
        }
      }

      arrayStartIndex = i * dimensions.itemsPerWrapGroup;
      arrayEndIndex = j * dimensions.itemsPerWrapGroup;
    } else {
      const scrollPercentage = scrollPosition / dimensions.scrollLength;

      const startingArrayIndex_fractional =
        Math.min(
          Math.max(scrollPercentage * dimensions.pageCount_fractional, 0),
          dimensions.pageCount_fractional,
        ) * dimensions.itemsPerPage;
      const maxStart = dimensions.itemCount - dimensions.itemsPerPage - 1;
      arrayStartIndex = Math.min(Math.floor(startingArrayIndex_fractional), maxStart);
      arrayEndIndex = Math.ceil(startingArrayIndex_fractional) + dimensions.itemsPerPage - 1;
    }

    arrayStartIndex -= arrayStartIndex % dimensions.itemsPerWrapGroup; // round down to start of wrapGroup

    if (this.stripedTable) {
      const bufferBoundary = 2 * dimensions.itemsPerWrapGroup;
      if (arrayStartIndex % bufferBoundary !== 0) {
        arrayStartIndex = Math.max(arrayStartIndex - (arrayStartIndex % bufferBoundary), 0);
      }
    }

    const endIndexWithinWrapGroup = (arrayEndIndex + 1) % dimensions.itemsPerWrapGroup;
    if (endIndexWithinWrapGroup > 0) {
      arrayEndIndex += dimensions.itemsPerWrapGroup - endIndexWithinWrapGroup; // round up to end of wrapGroup
    }

    if (isNaN(arrayStartIndex)) {
      arrayStartIndex = 0;
    }
    if (isNaN(arrayEndIndex)) {
      arrayEndIndex = 0;
    }

    arrayStartIndex = Math.min(Math.max(arrayStartIndex, 0), dimensions.itemCount - 1);
    arrayEndIndex = Math.min(Math.max(arrayEndIndex, 0), dimensions.itemCount - 1);

    const bufferSize = this.bufferAmount * dimensions.itemsPerWrapGroup;
    const startIndexWithBuffer = Math.min(
      Math.max(arrayStartIndex - bufferSize, 0),
      dimensions.itemCount - 1,
    );
    const endIndexWithBuffer = Math.min(
      Math.max(arrayEndIndex + bufferSize, 0),
      dimensions.itemCount - 1,
    );

    return {
      startIndex: arrayStartIndex,
      endIndex: arrayEndIndex,
      startIndexWithBuffer: startIndexWithBuffer,
      endIndexWithBuffer: endIndexWithBuffer,
      scrollStartPosition: scrollPosition,
      scrollEndPosition: scrollPosition + dimensions.viewportLength,
      maxScrollPosition: dimensions.maxScrollPosition,
    };
  }

  protected calculateViewport(): IViewport {
    const dimensions = this.calculateDimensions();
    const offset = this.getElementsOffset();

    let scrollStartPosition = this.getScrollStartPosition();
    if (scrollStartPosition > dimensions.scrollLength + offset && !isWindow(this.parentScroll)) {
      scrollStartPosition = dimensions.scrollLength;
    } else {
      scrollStartPosition -= offset;
    }
    scrollStartPosition = Math.max(0, scrollStartPosition);

    const pageInfo = this.calculatePageInfo(scrollStartPosition, dimensions);
    const newPadding = this.calculatePadding(pageInfo.startIndexWithBuffer, dimensions);
    const newScrollLength = Math.round(dimensions.scrollLength);

    return {
      startIndex: pageInfo.startIndex,
      endIndex: pageInfo.endIndex,
      startIndexWithBuffer: pageInfo.startIndexWithBuffer,
      endIndexWithBuffer: pageInfo.endIndexWithBuffer,
      padding: Math.round(newPadding),
      scrollLength: newScrollLength,
      scrollbarLength: newScrollLength + offset,
      scrollStartPosition: pageInfo.scrollStartPosition,
      scrollEndPosition: pageInfo.scrollEndPosition,
      maxScrollPosition: pageInfo.maxScrollPosition,
    };
  }
}
