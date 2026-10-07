import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AttendanceReport,
  BudgetReportRow,
  DailyBreakdown,
  HeatmapReport,
  IsoDate,
  PageResponse,
  ReportFilter,
  SummaryReport,
  TimeEntry,
  TrendReport,
  WeeklyReport,
} from '../models';
import { toParams } from './http-params.util';

@Injectable({ providedIn: 'root' })
export class ReportApiService {
  private readonly http = inject(HttpClient);

  summary(filter: ReportFilter): Observable<SummaryReport> {
    return this.http.get<SummaryReport>('/reports/summary', {
      params: toParams(filter as Record<string, unknown>),
    });
  }

  detailed(
    filter: ReportFilter & { page?: number; size?: number },
  ): Observable<PageResponse<TimeEntry>> {
    return this.http.get<PageResponse<TimeEntry>>('/reports/detailed', {
      params: toParams(filter as Record<string, unknown>),
    });
  }

  budget(filter: ReportFilter): Observable<BudgetReportRow[]> {
    return this.http.get<BudgetReportRow[]>('/reports/budget', {
      params: toParams(filter as Record<string, unknown>),
    });
  }

  revenue(filter: ReportFilter): Observable<SummaryReport> {
    return this.http.get<SummaryReport>('/reports/revenue', {
      params: toParams(filter as Record<string, unknown>),
    });
  }

  trends(filter: ReportFilter & { granularity?: string }): Observable<TrendReport> {
    return this.http.get<TrendReport>('/reports/trends', {
      params: toParams(filter as Record<string, unknown>),
    });
  }

  dailyBreakdown(filter: ReportFilter): Observable<DailyBreakdown> {
    return this.http.get<DailyBreakdown>('/reports/daily-breakdown', {
      params: toParams(filter as Record<string, unknown>),
    });
  }

  heatmap(year?: number): Observable<HeatmapReport> {
    return this.http.get<HeatmapReport>('/reports/heatmap', { params: toParams({ year }) });
  }

  attendance(from?: IsoDate, to?: IsoDate): Observable<AttendanceReport> {
    return this.http.get<AttendanceReport>('/reports/attendance', { params: toParams({ from, to }) });
  }

  weekly(weekStart?: IsoDate): Observable<WeeklyReport> {
    return this.http.get<WeeklyReport>('/reports/weekly', { params: toParams({ weekStart }) });
  }

  exportUrl(format: 'csv' | 'xlsx', filter: ReportFilter): string {
    const params = toParams(filter as Record<string, unknown>).toString();
    return `api/v1/reports/export.${format}${params ? `?${params}` : ''}`;
  }
}
