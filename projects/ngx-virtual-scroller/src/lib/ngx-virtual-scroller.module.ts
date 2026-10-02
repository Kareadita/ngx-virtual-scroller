import { NgModule } from '@angular/core';
import { VirtualScrollerComponent } from './ngx-virtual-scroller.component';

/**
 * @deprecated `VirtualScrollerComponent` is standalone; import it directly. Default options are provided in root, and
 * can be overridden with `provideVirtualScrollerOptions()`.
 */
@NgModule({
  imports: [VirtualScrollerComponent],
  exports: [VirtualScrollerComponent],
})
export class VirtualScrollerModule {}
