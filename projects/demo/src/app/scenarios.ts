import { Type } from '@angular/core';

export interface Scenario {
  path: string;
  label: string;
  loadComponent: () => Promise<Type<unknown>>;
}

/** One page per scenario. The nav and the routes are built from this list, and e2e covers every nav entry. */
export const SCENARIOS: Scenario[] = [
  {
    path: 'list',
    label: 'Vertical list',
    loadComponent: () => import('./pages/list').then((m) => m.ListPage),
  },
  {
    path: 'grid',
    label: 'Card grid',
    loadComponent: () => import('./pages/grid').then((m) => m.GridPage),
  },
  {
    path: 'horizontal',
    label: 'Horizontal',
    loadComponent: () => import('./pages/horizontal').then((m) => m.HorizontalPage),
  },
  {
    path: 'table',
    label: 'Table',
    loadComponent: () => import('./pages/table').then((m) => m.TablePage),
  },
  {
    path: 'unequal',
    label: 'Unequal sizes',
    loadComponent: () => import('./pages/unequal').then((m) => m.UnequalPage),
  },
  {
    path: 'margins',
    label: 'Collapsing margins',
    loadComponent: () => import('./pages/margins').then((m) => m.MarginsPage),
  },
  {
    path: 'escaping-margin',
    label: 'Escaping margin',
    loadComponent: () => import('./pages/escaping-margin').then((m) => m.EscapingMarginPage),
  },
  {
    path: 'images',
    label: 'Lazy images',
    loadComponent: () => import('./pages/images').then((m) => m.ImagesPage),
  },
  {
    path: 'parent-scroll',
    label: 'Parent scroll',
    loadComponent: () => import('./pages/parent-scroll').then((m) => m.ParentScrollPage),
  },
  {
    path: 'window-scroll',
    label: 'Window scroll',
    loadComponent: () => import('./pages/window-scroll').then((m) => m.WindowScrollPage),
  },
  {
    path: 'tabs',
    label: 'Tabs',
    loadComponent: () => import('./pages/tabs').then((m) => m.TabsPage),
  },
  {
    path: 'hover-scroll',
    label: 'Hover-only scroll',
    loadComponent: () => import('./pages/hover-scroll').then((m) => m.HoverScrollPage),
  },
  {
    path: 'load-more',
    label: 'Load more',
    loadComponent: () => import('./pages/load-more').then((m) => m.LoadMorePage),
  },
];
