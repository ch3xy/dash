import { DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { RANGE_PRESETS, WEEK_PRESETS, matchPreset, weekRange } from '../shared/utils/date-range';

const PREFIX = 'dash-view:';
/** Stored instead of from/to (or week) when the range matches a preset, so "Dieser Monat" stays relative. */
const RANGE_PRESET = '__rangePreset';
const WEEK_PRESET = '__weekPreset';

function read<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable — state is only kept in the URL */
  }
}

export function encodeViewParams(params: Params): Params {
  const out: Params = { ...params };
  if (out['from'] && out['to']) {
    const preset = matchPreset({ from: out['from'], to: out['to'] }, RANGE_PRESETS);
    if (preset) {
      delete out['from'];
      delete out['to'];
      out[RANGE_PRESET] = preset.id;
    }
  }
  if (out['week']) {
    const preset = matchPreset(weekRange(out['week']), WEEK_PRESETS);
    if (preset) {
      delete out['week'];
      out[WEEK_PRESET] = preset.id;
    }
  }
  return out;
}

export function decodeViewParams(stored: Params): Params {
  const out: Params = { ...stored };
  const today = new Date();
  const rangePreset = RANGE_PRESETS.find((p) => p.id === out[RANGE_PRESET]);
  delete out[RANGE_PRESET];
  if (rangePreset) Object.assign(out, rangePreset.range(today));
  const weekPreset = WEEK_PRESETS.find((p) => p.id === out[WEEK_PRESET]);
  delete out[WEEK_PRESET];
  if (weekPreset) out['week'] = weekPreset.range(today).from;
  return out;
}

/**
 * Keeps a routed view's query params (period, filters, grouping…) across reloads and navigation:
 * every change is saved to localStorage, and opening the view without query params restores them.
 * Ranges matching a preset are stored as the preset, so "Letzter Monat" is still last month next month.
 * Call from the component's constructor (injection context).
 */
export function persistQueryParams(key: string): void {
  const route = inject(ActivatedRoute);
  const router = inject(Router);

  if (Object.keys(route.snapshot.queryParams).length === 0) {
    const stored = read<Params>(key);
    if (stored && Object.keys(stored).length) {
      router.navigate([], { relativeTo: route, queryParams: decodeViewParams(stored), replaceUrl: true });
    }
  }

  // Empty params mean "defaults" (or a restore still in flight) — never overwrite saved state with them.
  const sub = route.queryParams.subscribe((p) => {
    if (Object.keys(p).length) write(key, encodeViewParams(p));
  });
  inject(DestroyRef).onDestroy(() => sub.unsubscribe());
}

/** Reads a small per-view UI setting (toggle, select) persisted with {@link saveViewSetting}. */
export function loadViewSetting<T>(key: string, fallback: T): T {
  const stored = read<{ v: T }>(key);
  return stored ? stored.v : fallback;
}

export function saveViewSetting<T>(key: string, value: T): void {
  write(key, { v: value });
}
