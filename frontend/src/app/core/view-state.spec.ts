import { RANGE_PRESETS, WEEK_PRESETS } from '../shared/utils/date-range';
import { decodeViewParams, encodeViewParams, loadViewSetting, saveViewSetting } from './view-state';

describe('view-state', () => {
  beforeEach(() => localStorage.clear());

  it('stores a preset range relatively and resolves it to current dates', () => {
    const lastMonth = RANGE_PRESETS.find((p) => p.id === 'last-month')!.range(new Date());
    const stored = encodeViewParams({ ...lastMonth, groupBy: 'CLIENT' });
    expect(stored).toEqual({ __rangePreset: 'last-month', groupBy: 'CLIENT' });
    expect(decodeViewParams(stored)).toEqual({ ...lastMonth, groupBy: 'CLIENT' });
  });

  it('keeps a custom range as absolute dates', () => {
    const params = { from: '2020-01-03', to: '2020-01-09' };
    expect(encodeViewParams(params)).toEqual(params);
    expect(decodeViewParams(params)).toEqual(params);
  });

  it('stores the current week as preset, other weeks absolute', () => {
    const thisWeek = WEEK_PRESETS[0].range(new Date()).from;
    expect(encodeViewParams({ week: thisWeek })).toEqual({ __weekPreset: 'this-week' });
    expect(decodeViewParams({ __weekPreset: 'this-week' })).toEqual({ week: thisWeek });
    expect(encodeViewParams({ week: '2020-01-06' })).toEqual({ week: '2020-01-06' });
  });

  it('round-trips simple settings with a fallback', () => {
    expect(loadViewSetting('x', 1)).toBe(1);
    saveViewSetting('x', false);
    expect(loadViewSetting('x', true)).toBe(false);
  });
});
