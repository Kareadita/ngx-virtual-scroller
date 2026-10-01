import { InjectionToken, Provider } from '@angular/core';

export interface VirtualScrollerDefaultOptions {
  modifyOverflowStyleOfParentScroll: boolean;
  resizeBypassRefreshThreshold: number;
  scrollAnimationTime: number;
  scrollDebounceTime: number;
  scrollThrottlingTime: number;
  scrollbarHeight?: number;
  scrollbarWidth?: number;
  stripedTable: boolean;
}

export function VIRTUAL_SCROLLER_DEFAULT_OPTIONS_FACTORY(): VirtualScrollerDefaultOptions {
  return {
    modifyOverflowStyleOfParentScroll: true,
    resizeBypassRefreshThreshold: 5,
    scrollAnimationTime: 750,
    scrollDebounceTime: 0,
    scrollThrottlingTime: 0,
    stripedTable: false,
  };
}

/** Default input values for every virtual scroller in the injector tree. Set with {@link provideVirtualScrollerOptions} */
export const VIRTUAL_SCROLLER_DEFAULT_OPTIONS = new InjectionToken<VirtualScrollerDefaultOptions>(
  'VIRTUAL_SCROLLER_DEFAULT_OPTIONS',
  { providedIn: 'root', factory: VIRTUAL_SCROLLER_DEFAULT_OPTIONS_FACTORY },
);

/** Overrides the default input values of virtual scrollers, at the application level or for a component subtree */
export function provideVirtualScrollerOptions(
  options: Partial<VirtualScrollerDefaultOptions>,
): Provider {
  return {
    provide: VIRTUAL_SCROLLER_DEFAULT_OPTIONS,
    useValue: { ...VIRTUAL_SCROLLER_DEFAULT_OPTIONS_FACTORY(), ...options },
  };
}
