// Shared DTO models mirroring the backend REST contract (/api/v1).
// Money values are strings (BigDecimal) to avoid float precision loss.

export type Uuid = string;
export type IsoDate = string; // YYYY-MM-DD
export type IsoInstant = string; // RFC 3339

export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
export type BudgetReset = 'NONE' | 'MONTHLY' | 'YEARLY';
export type TimeEntrySource = 'TIMER' | 'MANUAL' | 'IMPORT' | 'ADJUSTMENT';
export type BudgetStatusKind = 'ON_TRACK' | 'WARNING' | 'EXCEEDED';
export type Granularity = 'DAY' | 'WEEK' | 'MONTH';
export type GroupBy = 'DAY' | 'WEEK' | 'MONTH' | 'CLIENT' | 'PROJECT' | 'TASK';
export type RoundingRule = 'NONE' | 'UP' | 'DOWN' | 'NEAREST';

export interface Client {
  id: Uuid;
  name: string;
  description: string | null;
  email: string | null;
  website: string | null;
  currencyCode: string;
  archived: boolean;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface ClientInput {
  name: string;
  description?: string | null;
  email?: string | null;
  website?: string | null;
  currencyCode?: string | null;
}

export interface Project {
  id: Uuid;
  clientId: Uuid | null;
  clientName: string | null;
  name: string;
  description: string | null;
  color: string | null;
  status: ProjectStatus;
  billableByDefault: boolean;
  defaultHourlyRate: string | null;
  currencyCode: string;
  hourBudgetMinutes: number | null;
  moneyBudgetAmount: string | null;
  budgetReset: BudgetReset;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface ProjectInput {
  clientId?: Uuid | null;
  name: string;
  description?: string | null;
  color?: string | null;
  billableByDefault?: boolean;
  defaultHourlyRate?: string | null;
  currencyCode?: string | null;
  hourBudgetMinutes?: number | null;
  moneyBudgetAmount?: string | null;
  budgetReset?: BudgetReset;
}

export interface BudgetStatus {
  projectId: Uuid;
  hourBudgetMinutes: number | null;
  usedMinutes: number;
  remainingMinutes: number | null;
  usedPercent: number | null;
  moneyBudgetAmount: string | null;
  revenueAmount: string;
  budgetPeriod: 'ALL_TIME' | 'CURRENT_MONTH' | 'CURRENT_YEAR';
}

export interface ProjectRate {
  id: Uuid;
  projectId: Uuid;
  hourlyRate: string;
  currencyCode: string;
  validFrom: IsoInstant;
  validTo: IsoInstant | null;
  note: string | null;
}

export interface ProjectRateInput {
  hourlyRate: string;
  currencyCode?: string | null;
  validFrom: IsoInstant;
  note?: string | null;
}

export interface Task {
  id: Uuid;
  projectId: Uuid;
  name: string;
  description: string | null;
  billableByDefault: boolean;
  hourlyRateOverride: string | null;
  estimatedMinutes: number | null;
  archived: boolean;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface TaskInput {
  name: string;
  description?: string | null;
  billableByDefault?: boolean;
  hourlyRateOverride?: string | null;
  estimatedMinutes?: number | null;
}

export interface Tag {
  id: Uuid;
  name: string;
  color: string | null;
  archived: boolean;
  createdAt?: IsoInstant;
  updatedAt?: IsoInstant;
}

export interface TagInput {
  name: string;
  color?: string | null;
}

export interface TimeEntry {
  id: Uuid;
  projectId: Uuid;
  projectName: string;
  clientId: Uuid | null;
  clientName: string | null;
  taskId: Uuid | null;
  taskName: string | null;
  description: string | null;
  startTime: IsoInstant;
  endTime: IsoInstant;
  durationSeconds: number;
  entryDate: IsoDate;
  billable: boolean;
  hourlyRateSnapshot: string | null;
  currencyCodeSnapshot: string | null;
  amountSnapshot: string | null;
  source: TimeEntrySource;
  tags: Tag[];
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface TimeEntryInput {
  projectId: Uuid;
  taskId?: Uuid | null;
  description?: string | null;
  startTime: IsoInstant;
  endTime: IsoInstant;
  billable: boolean;
  tagIds?: Uuid[];
}

export interface RunningTimer {
  id: Uuid;
  projectId: Uuid;
  projectName: string;
  taskId: Uuid | null;
  taskName: string | null;
  description: string | null;
  startTime: IsoInstant;
  elapsedSeconds: number;
  billable: boolean;
}

export interface TimerStartInput {
  projectId: Uuid;
  taskId?: Uuid | null;
  description?: string | null;
  billable: boolean;
  tagIds?: Uuid[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface RecentCombination {
  projectId: Uuid;
  projectName: string;
  taskId: Uuid | null;
  taskName: string | null;
  billable?: boolean; // not currently returned by the API
}

// ---- Reports ----

export interface ReportFilter {
  from?: IsoDate;
  to?: IsoDate;
  clientId?: Uuid;
  projectId?: Uuid;
  taskId?: Uuid;
  tagId?: Uuid;
  billable?: boolean;
  q?: string;
  groupBy?: GroupBy;
  rounded?: boolean;
}

export interface SummaryGroup {
  key: string;
  label: string;
  durationSeconds: number;
  billableDurationSeconds: number;
  revenueAmount: string;
}

export interface SummaryReport {
  totalDurationSeconds: number;
  billableDurationSeconds: number;
  nonBillableDurationSeconds: number;
  billableRatio: number;
  revenueAmount: string;
  currencyCode: string;
  groupedBy: GroupBy;
  groups: SummaryGroup[];
  period: { from: IsoDate; to: IsoDate };
}

export interface WeeklyDay {
  date: IsoDate;
  totalSeconds: number;
  entries: TimeEntry[];
}

export interface WeeklyReport {
  weekStart: IsoDate;
  weekEnd: IsoDate;
  days: WeeklyDay[];
  weekTotalSeconds: number;
}

export interface BudgetReportRow {
  projectId: Uuid;
  projectName: string;
  clientName: string | null;
  hourBudgetMinutes: number | null;
  usedMinutes: number;
  usedPercent: number | null;
  status: BudgetStatusKind;
}

export interface TrendPoint {
  period: string;
  durationSeconds: number;
  revenueAmount: string;
}

export interface TrendReport {
  granularity: Granularity;
  data: TrendPoint[];
}

export interface HeatmapPoint {
  date: IsoDate;
  durationSeconds: number;
  intensity: number;
}

export interface HeatmapReport {
  year: number;
  data: HeatmapPoint[];
}

// ---- Dashboard ----

export interface PeriodStat {
  durationSeconds: number;
  revenueAmount: string;
}

export interface BudgetAlert {
  projectId: Uuid;
  projectName: string;
  usedPercent: number;
  status: BudgetStatusKind;
}

export interface TopProject {
  projectId: Uuid;
  projectName: string;
  durationSeconds: number;
}

export interface TopClient {
  clientId: Uuid;
  clientName: string;
  revenueAmount: string;
}

export interface Dashboard {
  today: PeriodStat;
  thisWeek: PeriodStat;
  thisMonth: PeriodStat;
  runningTimer: RunningTimer | null;
  budgetAlerts: BudgetAlert[];
  topProjects: TopProject[];
  topClients: TopClient[];
}

// ---- Settings ----

export interface AppSettings {
  timezone: string;
  currency: string;
  defaultRate: string;
  roundingRule: RoundingRule;
  roundingMinutes: number;
}
