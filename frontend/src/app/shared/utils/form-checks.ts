/**
 * Inline checks mirroring the backend's Bean Validation on rates, budgets and currencies,
 * so invalid input is shown at the field instead of as a 422 toast. Null = valid.
 */

/** ISO currency code (3 letters, any case; saved upper-case). Empty is valid only if optional. */
export function currencyError(value: string | null | undefined, optional = false): string | null {
  const v = (value ?? '').trim();
  if (!v) return optional ? null : 'Währung angeben';
  return /^[A-Za-z]{3}$/.test(v) ? null : '3 Buchstaben, z. B. EUR';
}

/** Money fields are decimal strings in the API models; number inputs may still bind numbers. */
type NumberLike = number | string | null | undefined;

function toNumber(value: NumberLike): number | null {
  return value == null || value === '' ? null : Number(value);
}

export function nonNegativeError(value: NumberLike): string | null {
  const n = toNumber(value);
  return n != null && n < 0 ? 'Darf nicht negativ sein' : null;
}

export function positiveError(value: NumberLike): string | null {
  const n = toNumber(value);
  return n != null && n <= 0 ? 'Muss größer als 0 sein' : null;
}
