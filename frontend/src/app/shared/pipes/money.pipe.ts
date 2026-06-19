import { Pipe, PipeTransform } from '@angular/core';

/** Formats a BigDecimal-as-string money amount with its currency code. */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amount: string | number | null | undefined, currency = 'EUR'): string {
    if (amount == null || amount === '') {
      return '—';
    }
    const value = typeof amount === 'string' ? Number(amount) : amount;
    if (Number.isNaN(value)) {
      return '—';
    }
    try {
      return new Intl.NumberFormat('de-AT', {
        style: 'currency',
        currency: currency || 'EUR',
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  }
}
