import { segmentAt } from './report-donut.component';

describe('segmentAt', () => {
  // Ring centre is (100, 100), radius 82, stroke 36 → ring spans 64..118 from the centre.
  const fractions = [0.25, 0.5, 0.25];

  it('finds segments clockwise from 12 o\'clock', () => {
    expect(segmentAt(fractions, 120, 20)).toBe(0); // top right
    expect(segmentAt(fractions, 182, 100)).toBe(1); // 3 o'clock
    expect(segmentAt(fractions, 100, 182)).toBe(1); // 6 o'clock
    expect(segmentAt(fractions, 18, 100)).toBe(2); // 9 o'clock
  });

  it('ignores the hole and the outside of the ring', () => {
    expect(segmentAt(fractions, 100, 100)).toBeNull();
    expect(segmentAt(fractions, 100, 50)).toBeNull();
    expect(segmentAt(fractions, 199, 199)).toBeNull();
  });

  it('returns null on the empty track after the last segment', () => {
    expect(segmentAt([0.5], 18, 100)).toBeNull();
  });
});
