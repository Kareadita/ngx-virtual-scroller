import { Routes } from '@angular/router';
import { SCENARIOS } from './scenarios';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'ngx-virtual-scroller: virtual scrolling for zoneless Angular',
    loadComponent: () => import('./pages/home').then((m) => m.HomePage),
  },
  ...SCENARIOS.map((scenario) => ({
    path: scenario.path,
    title: `${scenario.label} | ngx-virtual-scroller`,
    loadComponent: scenario.loadComponent,
  })),
  { path: '**', redirectTo: '' },
];
