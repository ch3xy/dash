import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

/** Focuses (and selects, for inputs) the host element once it is rendered. */
@Directive({ selector: '[appAutofocus]' })
export class AutofocusDirective implements AfterViewInit {
  private readonly el = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    const node = this.el.nativeElement;
    queueMicrotask(() => {
      node.focus();
      if (node instanceof HTMLInputElement) {
        node.select();
      }
    });
  }
}
