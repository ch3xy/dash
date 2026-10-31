import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ClosingApiService } from './api/closing-api.service';
import { MonthLockStateService } from './month-lock-state.service';

function serviceWithLocks(months: string[]): MonthLockStateService {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ClosingApiService,
        useValue: { locks: () => of(months.map((month) => ({ month, lockedAt: '', note: null }))) },
      },
    ],
  });
  return TestBed.inject(MonthLockStateService);
}

describe('MonthLockStateService.anyLocked', () => {
  it('detects a locked month between first and last month', () => {
    const svc = serviceWithLocks(['2026-02']);
    expect(svc.anyLocked('2026-01-15', '2026-03-10')).toBe(true);
  });

  it('is false when no month in range is locked', () => {
    const svc = serviceWithLocks(['2025-12', '2026-04']);
    expect(svc.anyLocked('2026-01-15', '2026-03-31')).toBe(false);
  });

  it('handles ranges across a year boundary', () => {
    const svc = serviceWithLocks(['2026-01']);
    expect(svc.anyLocked('2025-11-30', '2026-02-01')).toBe(true);
  });
});
