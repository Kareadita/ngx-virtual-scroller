import { Type } from '@angular/core';

export type ScenarioGroup = 'Layouts' | 'Item sizes' | 'Scroll containers' | 'Data';

export interface Scenario {
  path: string;
  label: string;
  group: ScenarioGroup;
  /** One line for the overview page */
  description: string;
  loadComponent: () => Promise<Type<unknown>>;
}

export const SCENARIO_GROUPS: ScenarioGroup[] = [
  'Layouts',
  'Item sizes',
  'Scroll containers',
  'Data',
];

/** One page per scenario. The nav, the routes and the overview are built from this list, and e2e covers every entry. */
export const SCENARIOS: Scenario[] = [
  {
    path: 'list',
    label: 'Vertical list',
    group: 'Layouts',
    description: '10,000 rows. Prepend, append and reverse by replacing the array.',
    loadComponent: () => import('./pages/list').then((m) => m.ListPage),
  },
  {
    path: 'grid',
    label: 'Card grid',
    group: 'Layouts',
    description: 'A responsive multi-column grid. Columns are detected from the layout.',
    loadComponent: () => import('./pages/grid').then((m) => m.GridPage),
  },
  {
    path: 'horizontal',
    label: 'Horizontal',
    group: 'Layouts',
    description: 'Scroll sideways, left to right or right to left.',
    loadComponent: () => import('./pages/horizontal').then((m) => m.HorizontalPage),
  },
  {
    path: 'table',
    label: 'Table',
    group: 'Layouts',
    description: 'Rows in a table body, with a sticky header and footer.',
    loadComponent: () => import('./pages/table').then((m) => m.TablePage),
  },
  {
    path: 'unequal',
    label: 'Unequal sizes',
    group: 'Item sizes',
    description: 'Rows of different heights, each measured as it renders.',
    loadComponent: () => import('./pages/unequal').then((m) => m.UnequalPage),
  },
  {
    path: 'margins',
    label: 'Collapsing margins',
    group: 'Item sizes',
    description: 'Items whose vertical margins collapse between neighbours.',
    loadComponent: () => import('./pages/margins').then((m) => m.MarginsPage),
  },
  {
    path: 'escaping-margin',
    label: 'Escaping margin',
    group: 'Item sizes',
    description: "A margin inside each row that collapses outside the row's box.",
    loadComponent: () => import('./pages/escaping-margin').then((m) => m.EscapingMarginPage),
  },
  {
    path: 'images',
    label: 'Lazy images',
    group: 'Item sizes',
    description: 'Lazy-loaded covers with fixed sizes, so rows keep their height.',
    loadComponent: () => import('./pages/images').then((m) => m.ImagesPage),
  },
  {
    path: 'parent-scroll',
    label: 'Parent scroll',
    group: 'Scroll containers',
    description: 'Scroll with an ancestor that holds other content too.',
    loadComponent: () => import('./pages/parent-scroll').then((m) => m.ParentScrollPage),
  },
  {
    path: 'window-scroll',
    label: 'Window scroll',
    group: 'Scroll containers',
    description: 'Scroll with the page itself.',
    loadComponent: () => import('./pages/window-scroll').then((m) => m.WindowScrollPage),
  },
  {
    path: 'tabs',
    label: 'Tabs',
    group: 'Scroll containers',
    description: 'Several lists in tabs, sharing one scroll container.',
    loadComponent: () => import('./pages/tabs').then((m) => m.TabsPage),
  },
  {
    path: 'hover-scroll',
    label: 'Hover-only scroll',
    group: 'Scroll containers',
    description: 'A panel that only becomes scrollable while hovered.',
    loadComponent: () => import('./pages/hover-scroll').then((m) => m.HoverScrollPage),
  },
  {
    path: 'load-more',
    label: 'Load more',
    group: 'Data',
    description: 'Fetch the next page when the end of the list comes into view.',
    loadComponent: () => import('./pages/load-more').then((m) => m.LoadMorePage),
  },
];
