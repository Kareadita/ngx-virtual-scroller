import { Routes } from '@angular/router';
import { SCENARIOS } from './scenarios';

export const routes: Routes = [
  ...SCENARIOS.map((scenario) => ({
    path: scenario.path,
    title: `${scenario.label} | ngx-virtual-scroller`,
    loadComponent: scenario.loadComponent,
  })),
  { path: '**', redirectTo: SCENARIOS[0].path },
];
