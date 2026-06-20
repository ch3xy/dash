import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  label?: string;
  value?: string;
  confirmLabel?: string;
  placeholder?: string;
}

export interface DialogRequest {
  kind: 'confirm' | 'prompt';
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  initialValue: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (value: boolean | string | null) => void;
}

/**
 * Promise-based dialogs rendered by DialogHostComponent (design-system styling)
 * in place of the browser's native confirm()/prompt().
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly request = signal<DialogRequest | null>(null);

  confirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.request.set({
        kind: 'confirm',
        title: opts.title ?? 'Bestätigen',
        message: opts.message,
        initialValue: '',
        confirmLabel: opts.confirmLabel ?? 'OK',
        cancelLabel: opts.cancelLabel ?? 'Abbrechen',
        danger: opts.danger ?? false,
        resolve: (v) => resolve(v === true),
      });
    });
  }

  prompt(opts: PromptOptions): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      this.request.set({
        kind: 'prompt',
        title: opts.title,
        label: opts.label,
        placeholder: opts.placeholder,
        initialValue: opts.value ?? '',
        confirmLabel: opts.confirmLabel ?? 'Speichern',
        cancelLabel: 'Abbrechen',
        danger: false,
        resolve: (v) => resolve(typeof v === 'string' ? v : null),
      });
    });
  }
}
