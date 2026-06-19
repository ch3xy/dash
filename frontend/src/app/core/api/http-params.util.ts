import { HttpParams } from '@angular/common/http';

/** Builds HttpParams from a plain object, skipping null/undefined/'' values. */
export function toParams(obj: object | undefined): HttpParams {
  let params = new HttpParams();
  if (!obj) {
    return params;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const v of value) {
        params = params.append(key, String(v));
      }
    } else {
      params = params.set(key, String(value));
    }
  }
  return params;
}
