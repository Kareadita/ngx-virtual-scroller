import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SCENARIO_GROUPS, SCENARIOS } from './scenarios';

@Component({
  selector: 'demo-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly groups = SCENARIO_GROUPS.map((group) => ({
    name: group,
    scenarios: SCENARIOS.filter((scenario) => scenario.group === group),
  }));
}
