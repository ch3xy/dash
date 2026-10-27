# Code Review — dash, full application

**Date:** 2026-10-27
**Scope:** whole repository at `f97ec09` (clean tree), with no diff. Backend `src/main/java/com/ch3xy/dash/**` (118 files, ~6.7k lines), Flyway migrations V1–V6, `pom.xml`, frontend `frontend/src/**` (66 non-spec files, ~9.7k lines). Tests were read only to judge coverage.
**Reviewers:** Claude (Opus 5.5), run as two parallel agents (backend, frontend); Codex (gpt-6-astra, reasoning effort high), run separately later the same day on the same commit.
**Status:** fixes are tracked in the Status column (FIXED = implemented with tests).
**Verification:** every HIGH and MEDIUM finding marked CONFIRMED was checked against the code at `f97ec09`. The rest are reviewer reasoning that was spot-checked or not checked (PLAUSIBLE). Line numbers refer to `f97ec09`. The code under review has not changed since then; only `.claude/settings.json` and `.gitignore` have. Missing authentication is out of scope by design (single user, local MVP). Nothing was fixed.

## Summary

| # | Severity | Location | Finding | Found by | Status |
|---|---|---|---|---|---|
| 1 | HIGH | `dataio/BackupRestoreService.java:39` | Restoring `{}` or any foreign JSON object wipes all data and reports success | Codex | FIXED |
| 2 | HIGH | `dataio/BackupRestoreService.java:132,253` | Restore sets `validTo` of open-ended rates to "now", so active rates expire | Codex | FIXED |
| 3 | HIGH | `settings/AppSettingsService.java:50` | Settings are stored without validation; an invalid time zone makes almost every endpoint fail with 500 | Claude, Codex | FIXED |
| 4 | HIGH | `timeentry/TimeEntryService.java:149,317` | Every update re-resolves the rate snapshot, so editing a description re-prices old entries | Claude, Codex | FIXED |
| 5 | MEDIUM | `timeentry/TimeEntryService.java:266` | `split` re-creates both halves with today's rate and loses id/source | Claude, Codex | FIXED |
| 6 | MEDIUM | `timer/TimerService.java:167` | "Only one running timer" is check-then-insert with no DB constraint | Claude, Codex | FIXED |
| 7 | MEDIUM | `report/ReportQueryRepository.java:138` | Budget 0 causes division by zero, so the budget report and the dashboard return 500 | Claude, Codex | FIXED |
| 8 | MEDIUM | `timesheet/TimesheetService.java:88` | Timesheet top-up is appended after the day's last entry and can roll over midnight into the next day | Claude, Codex | FIXED |
| 9 | MEDIUM | `timer/TimerService.java:124` | Changing the timer's project keeps the old task, so the timer can no longer be stopped | Claude, Codex | FIXED |
| 10 | MEDIUM | `project/ProjectService.java:118`, `ProjectRateRepository.java:26` | A backdated rate inverts or overlaps the rate history | Claude, Codex | FIXED |
| 11 | MEDIUM | `project/ProjectRequest.java`, `ProjectRateRequest.java`, `task/TaskRequest.java` | No range/format validation on rates, budgets and currency | Claude, Codex | FIXED |
| 12 | MEDIUM | `common/error/GlobalExceptionHandler.java:59` | Framework exceptions (bad JSON, bad UUID, 404, 405) become 500 and echo internal messages | Claude, Codex | FIXED |
| 13 | MEDIUM | `dataio/ClockifyRowImporter.java:43` | Ambiguous Clockify dates are parsed as US `MM/dd` before `dd/MM` | Claude, Codex | FIXED |
| 14 | MEDIUM | `report/ReportQueryRepository.java:73`, `ReportService.java:76` | Revenue totals add up different currencies and are labelled with the current app currency | Codex (Claude: frontend only) | FIXED |
| 15 | MEDIUM | `dataio/BackupRestoreService.java:101,107,199,244` | Restore NPEs on missing enums and applies unvalidated settings | Claude | FIXED |
| 16 | MEDIUM | `project/ProjectService.java:81` | Project budget status reports €0 revenue when the project has no hour budget | Codex | FIXED |
| 17 | MEDIUM | `report/ReportController.java:79,162,175` | Detailed report and CSV/XLSX export ignore the "rounded" option | Codex | FIXED |
| 18 | MEDIUM | `frontend/…/projects/project-detail.component.ts:217`, `clients/client-detail.component.ts:124` | Detail pages load only once; navigating A → B keeps A's data while actions target B | Codex | FIXED |
| 19 | MEDIUM | `frontend/…/timer/timer.component.ts:570`, `calendar/calendar.component.ts:814` | Entry dialogs build start and end on the same date, so entries that cross midnight cannot be created or edited | Claude, Codex | FIXED |
| 20 | MEDIUM | `frontend/…/shared/utils/date-utils.ts:36`, timer and calendar dialogs | Saving an unchanged entry drops the seconds and changes its raw duration | Codex | FIXED |
| 21 | MEDIUM | `frontend/…/calendar/calendar.component.ts:647` | Moving a short entry stretches it to at least 15 min | Claude, Codex | FIXED |
| 22 | MEDIUM | `frontend/…/reports/reports.component.ts:975` (plus timer, timesheet and calendar `load()`) | Overlapping HTTP loads with no cancellation; a stale response can overwrite newer data | Claude, Codex | FIXED |
| 23 | MEDIUM | `frontend/…/core/timer-state.service.ts:37` | The 15 s poll can overwrite a just-completed start or stop | Claude, Codex | FIXED |
| 24 | MEDIUM | `frontend/…/core/layout/timer-bar.component.ts:201` | The description PATCH on blur races with Stop; clearing the description has no effect | Claude, Codex | FIXED |
| 25 | MEDIUM | `frontend/…/core/layout/global-search.component.ts:152` | One failed search request kills the search stream for good | Claude, Codex | FIXED |
| 26 | MEDIUM | `frontend/…/timer/timer.component.ts` | Timer page list does not refresh when the timer is stopped from the top bar or with `s` | Claude, Codex | FIXED |
| 27 | MEDIUM | `frontend/…/core/layout/timer-bar.component.ts:145,173`, `timer.component.ts:417` | Timer bar and manual entry ignore the project's/task's `billableByDefault` | Codex | FIXED |
| 28 | MEDIUM | `frontend/…/core/layout/timer-bar.component.ts:148` | Timer bar loads projects and tags once and stays stale until reload | Claude (low), Codex | FIXED |
| 29 | MEDIUM | `frontend/…/core/layout/global-search.component.ts:207` | A search hit navigates to `/timer?date=…`, but the timer page ignores `date` | Claude, Codex (low) | FIXED |
| 30 | MEDIUM | `frontend/…/timesheet/timesheet.component.ts:338` | All cell inputs are disabled while a save runs, which breaks Tab-driven entry | Claude | FIXED |
| 31 | LOW | see list | 35 further low-severity findings (validation, races, a11y, edge cases) | Claude, Codex | mostly PLAUSIBLE |

---

## Findings

### 1. [HIGH] Restoring an empty or foreign JSON object deletes all data

**File:** `src/main/java/com/ch3xy/dash/dataio/BackupRestoreService.java:39-58`, `dataio/DataIoController.java:48`
**Found by:** Codex

`restore()` only rejects a `null` document. It then calls `wipe()` and inserts each collection, and a missing collection is treated as empty (`isEmpty` → return). The controller has no `@Valid`, and unknown JSON properties are ignored, so any JSON object deserializes into an all-null `BackupDocument`.

**Scenario:** The user picks the wrong file, for example `{}`, a settings export or any other JSON object, and confirms the restore. All clients, projects, entries and rates are deleted, and the response is a success with zero records. Only a later restore of a real backup can recover the data.

**Fix:** Before calling `wipe()`, validate the document. Require `exportedAt` and non-null collections (or at least a format/version marker), and reject a document that contains no data unless the user explicitly asks for an empty restore. Return 400 with a clear message. Combine this with #15.

---

### 2. [HIGH] Restore expires open-ended project rates

**File:** `src/main/java/com/ch3xy/dash/dataio/BackupRestoreService.java:132` (`validTo`), `:253-256` (`ts()`)
**Found by:** Codex (Claude noticed the `ts()` helper under #15 but not this consequence)

`ts()` turns `null` into `Instant.now()`. The helper is meant for the NOT NULL `created_at`/`updated_at` columns, but it is also used for the nullable `valid_to`.

**Scenario:** A valid backup contains the active rate €100 with `validTo = null`. After the restore, that rate ends at the restore time. Every entry created afterwards falls through to the project default or app default rate. This silently changes revenue after every restore, including the regular backup/restore round trip.

**Fix:** Map nullable timestamps with a separate helper that keeps `null` (`validTo`, and any other nullable timestamp). Add a round-trip test with an open-ended rate.

---

### 3. [HIGH] Unvalidated settings can make the app unusable

**File:** `src/main/java/com/ch3xy/dash/settings/AppSettingsService.java:50`, `settings/AppSettingsRequest.java`
**Found by:** Claude, Codex

`update()` saves `timezone`, `roundingRule`, `roundingMinutes` and `defaultRate` as given. The request only checks `@NotBlank` (and a pattern for currency). `getTimezone()` later calls `ZoneId.of(...)`, and the rounding code calls `RoundingRule.valueOf(...)`.

**Scenario:** PUT `timezone="Europe/Viena"` succeeds. After that, entry create and update, timer stop, the dashboard, reports, month locks and import all throw `DateTimeException`, which becomes 500. The settings page still loads because it reads raw strings, but every calculation fails until the DB row is fixed by hand. A bad `roundingRule` breaks rounded reports in the same way, and `roundingMinutes = 0` silently disables rounding (Codex). Restoring a backup goes through the same path (#15).

**Fix:** In `update`, validate with `ZoneId.of`, an enum parse, `roundingMinutes` in {1..60} and `defaultRate >= 0`. Throw `IllegalArgumentException` so the request gets a 4xx. Optionally let `getTimezone()` fall back to `Europe/Vienna` with a warning.

---

### 4. [HIGH] Editing an entry re-snapshots its rate

**File:** `src/main/java/com/ch3xy/dash/timeentry/TimeEntryService.java:149` (`update`) → `apply()` at `:317-320`
**Found by:** Claude, Codex

`apply()` always calls `rateResolver.resolve(project, task, startTime)` and overwrites `hourlyRateSnapshot`, `currencyCodeSnapshot` and `amountSnapshot`. `update()` uses `apply()` too.

**Scenario:** An entry is created while the task override is 80 €/h. The override later becomes 120. The user fixes a typo in the description, and the entry's rate and amount jump to 120 €/h. Already reported or invoiced periods change, which violates the rule "historic snapshots stay stable" (CLAUDE.md §4.7, business-rules). The same happens after a change to the project default rate or the app default rate. Timesheet trim (`TimesheetService.java:100-119`) goes through `update` and has the same effect. The existing test `changingProjectRateLeavesExistingEntrySnapshotStable` only covers entries that were never edited.

**Fix:** Re-resolve the rate only if project, task or start time changed. Otherwise keep the stored rate and only recompute the amount, as `bulkUpdate` already does. Add a test that edits only the description.

---

### 5. [MEDIUM] `split` re-prices and recreates entries

**File:** `src/main/java/com/ch3xy/dash/timeentry/TimeEntryService.java:266-283`
**Found by:** Claude, Codex

The original entry is deleted and both halves go through `create()`, which resolves the rate again. The id, `createdAt` and `source` are lost (the halves get `ADJUSTMENT`).

**Scenario:** An entry was created at 80 €/h and the rate is 120 now. After a split, both halves are priced at 120, so the total amount changes.

**Fix:** Copy the original snapshot rate and currency to both halves and prorate only the amount. Consider keeping the original row as the first half.

---

### 6. [MEDIUM] No DB guarantee for a single running timer

**File:** `src/main/java/com/ch3xy/dash/timer/TimerService.java:72,167-171`, `db/migration/V1__create_schema.sql:90` (running_timers)
**Found by:** Claude, Codex

`requireNoRunningTimer()` is `count() > 0` followed by an insert, and the table has no unique constraint.

**Scenario:** A double click, two tabs, or the button plus a shortcut send two concurrent starts. Both pass the check, two rows exist, `findFirstByOrderByStartTimeAsc` hides the second one, and after stopping the first, a "ghost" timer appears.

**Fix:** Add a migration with `create unique index ux_single_running_timer on running_timers ((true));`. The existing `DataIntegrityViolation` handler then returns 409.

---

### 7. [MEDIUM] Division by zero in the budget report

**File:** `src/main/java/com/ch3xy/dash/report/ReportQueryRepository.java:138`
**Found by:** Claude, Codex

`ORDER BY … / p.hour_budget_minutes` is guarded only by `IS NOT NULL`. Neither the API nor the schema forbids 0.

**Scenario:** A project with a budget of 0 makes PostgreSQL fail with "division by zero". The budget report returns 500, and so does the dashboard, because `DashboardService.budgetAlerts` calls `getBudgetReport`.

**Fix:** Use `NULLIF(p.hour_budget_minutes, 0)` or `WHERE … > 0`, and validate `> 0` (#11).

---

### 8. [MEDIUM] Timesheet top-up can land on the next day

**File:** `src/main/java/com/ch3xy/dash/timesheet/TimesheetService.java:88-93`
**Found by:** Claude, Codex

When a cell's target exceeds the current time, the new entry starts at the latest `endTime` of all entries of that day and runs for the difference. Nothing clamps it to the day. According to Codex, trimming can also cross midnight backwards.

**Scenario:** An entry already ends at 23:00 and the user raises a cell by 2 h. The new entry runs from 23:00 to 01:00, and `entryDate` (taken from the end time) is the next day. The requested cell is unchanged, the next day's cell grows, and repeating the edit adds even more time to the next day. On the last day of a month whose next month is locked, the save fails with a lock error.

**Fix:** Place the new entry so it ends on the requested date, for example before the first entry or from the day start, and reject the request if it cannot fit. Assert that the resulting `entryDate` equals `req.date()`.

---

### 9. [MEDIUM] Timer project change keeps a task from another project

**File:** `src/main/java/com/ch3xy/dash/timer/TimerService.java:124-145`
**Found by:** Claude, Codex

`update()` sets the new project but changes the task only when `taskId != null`. The task cannot be cleared either.

**Scenario:** A timer runs on project A, task A1, and the user switches it to project B. On stop, `TimeEntryService.apply` throws "Task does not belong to the given project". The timer can only be discarded, and the tracked time is lost.

**Fix:** When the project changes, clear the task or check it against the new project. Add an explicit way to clear the task.

---

### 10. [MEDIUM] Backdated rates corrupt the rate history

**File:** `src/main/java/com/ch3xy/dash/project/ProjectService.java:118-128`, `project/ProjectRateRepository.java:26-28`
**Found by:** Claude, Codex

`closeOpenRates` sets `validTo = newValidFrom` on every open rate, without checking order.

**Scenario:** The open rate R1 is valid from 2026-03-01, and a new rate R2 is added from 2026-01-01. R1 becomes `2026-03-01 → 2026-01-01`, an inverted range that never matches. R2 is open-ended and covers March onward. A rate inserted in the middle of closed history overlaps existing rates, and `findActiveRateAt` picks one of them arbitrarily. Codex also points out that two concurrent additions can leave two open rates.

**Fix:** Reject a `validFrom` that is not after the latest rate's `validFrom`, or insert properly by splitting the surrounding ranges. Add `check (valid_to is null or valid_to > valid_from)`, and a partial unique index on `project_id where valid_to is null`.

---

### 11. [MEDIUM] Missing validation on money, budget and currency fields

**File:** `src/main/java/com/ch3xy/dash/project/ProjectRequest.java:15-18`, `project/ProjectRateRequest.java:10`, `task/TaskRequest.java:11-12`
**Found by:** Claude (backend and frontend agents), Codex

`defaultHourlyRate`, `hourBudgetMinutes`, `moneyBudgetAmount`, the rate, `hourlyRateOverride` and `estimatedMinutes` have no `@PositiveOrZero`/`@Positive`. `currencyCode` is only `@NotBlank`. The frontend forms (`project-form-dialog`, `project-detail`, `client-form-dialog`) have no `min` and no currency pattern either.

**Scenario:** A rate of −5 produces negative revenue. A currency of "EURO" overflows `varchar(3)` and comes back as a generic 409 "Data integrity violation". A budget of 0 triggers #7.

**Fix:** Add `@PositiveOrZero`/`@Positive` and `@Pattern("[A-Z]{3}")`, matching DB `CHECK`s, and `min`/`pattern` with inline errors in the forms.

---

### 12. [MEDIUM] Error handler maps framework exceptions to 500

**File:** `src/main/java/com/ch3xy/dash/common/error/GlobalExceptionHandler.java:59-64` (and `:38-50`)
**Found by:** Claude, Codex

The catch-all `Exception` handler returns 500 with `ex.getMessage()`. Spring MVC's own exceptions are not handled separately: `HttpMessageNotReadableException`, `MethodArgumentTypeMismatchException`, `MissingServletRequestParameterException`, `HttpRequestMethodNotSupportedException` and `NoResourceFoundException` all end up there. In addition, every `IllegalStateException`, including ones thrown by libraries, becomes 409, and `IllegalArgumentException` becomes 422, while the API docs say 400.

**Scenario:** Malformed JSON, `/time-entries/not-a-uuid`, a wrong HTTP method or an unknown API path all return 500 with internal exception text instead of 400, 405 or 404.

**Fix:** Extend `ResponseEntityExceptionHandler`, or add explicit handlers for these exceptions, and use a generic message for real 500s. Align the IAE status with `.ai/api.md`.

---

### 13. [MEDIUM] Clockify import reads ambiguous dates as US format

**File:** `src/main/java/com/ch3xy/dash/dataio/ClockifyRowImporter.java:43-47`
**Found by:** Claude, Codex

`DATE_FORMATS` tries `MM/dd/yyyy` before `dd/MM/yyyy`.

**Scenario:** A European export with `03/04/2026` (3 April) is imported as 4 March. Only days 13 and above fall through to `dd/MM`, so a single file ends up with mixed interpretations and no warning.

**Fix:** Detect the format once per file (any row whose first part is above 12 means `dd/MM`), or make it a parameter, and warn when the file is ambiguous.

---

### 14. [MEDIUM] Revenue totals mix currencies

**File:** `src/main/java/com/ch3xy/dash/report/ReportQueryRepository.java:73` (and the grouped query), `report/ReportService.java:76`; also the dashboard, closing totals and `frontend/…/timer/timer.component.ts:367-371`
**Found by:** Codex (backend); Claude reported only the frontend day total, as LOW

The aggregations sum `amount_snapshot` without looking at `currency_code_snapshot`, and the response is labelled with `settingsService.getCurrency()`.

**Scenario:** A project in USD and one in EUR produce €100 + $100, and the report shows "€200". If the app currency is changed to USD, all historical EUR revenue is relabelled as USD without conversion.

**Fix:** Group revenue by `currency_code_snapshot` and return one amount per currency, or at least flag a mixed-currency result. Codex rated this HIGH. It was lowered to MEDIUM because the app is normally used with one currency.

---

### 15. [MEDIUM] Restore is fragile on incomplete or old backups

**File:** `src/main/java/com/ch3xy/dash/dataio/BackupRestoreService.java:101,107,199` (`.name()` on nullable enums), `:244-251` (`restoreSettings`)
**Found by:** Claude

Restore calls `status().name()`, `budgetReset().name()` and `source().name()` without null checks. Settings go through the unvalidated `update` (#3). The transaction rolls back on failure, so no data is lost. For the `ts()` helper, see #2.

**Scenario:** A hand-edited backup with no `source` field returns 500 "Internal error" instead of a 400 naming the field. A backup with a bad time zone restores successfully, after which the app is broken as in #3. Since restore is the recovery path, the user cannot get out of it from the UI.

**Fix:** Validate the whole payload before the wipe (together with #1): required enums and timestamps, and settings through the validation from #3. Return 400 with the field name.

---

### 16. [MEDIUM] Budget status hides revenue when there is no hour budget

**File:** `src/main/java/com/ch3xy/dash/project/ProjectService.java:79-84`
**Found by:** Codex

`getBudgetStatus` returns early with `BigDecimal.ZERO` revenue and 0 used minutes when `hourBudgetMinutes` is null, before running the usage and revenue queries.

**Scenario:** A project has a money budget of €5,000 and no hour budget, and €1,000 has been tracked. The project detail page shows €0 revenue against the money budget.

**Fix:** Always query usage and revenue, and only skip the hour-percentage calculation when no hour budget exists.

---

### 17. [MEDIUM] Detailed report and exports ignore "rounded"

**File:** `src/main/java/com/ch3xy/dash/report/ReportController.java:79-84` (`detailed`), `:162` (`export.csv`), `:175` (`export.xlsx`)
**Found by:** Codex

Summary, forecast, trends and daily breakdown accept `rounded`, but detailed, CSV and XLSX do not, and `FilterParams` has no such field.

**Scenario:** With "Gerundet" on and rounding UP/15, a one-minute entry counts as 15 min in the overview, but the detailed table and the CSV/XLSX download show 1 min, so the exported numbers do not add up to the report.

**Fix:** Accept `rounded` there too and either add a rounded-duration column or round the duration column. Document whether revenue follows rounding (see the related LOW item about rounded revenue).

---

### 18. [MEDIUM] Project and client detail pages do not reload on route change

**File:** `frontend/src/app/features/projects/project-detail.component.ts:217-227`, `frontend/src/app/features/clients/client-detail.component.ts:124-135`
**Found by:** Codex

`id` is a router-bound `input()` (`withComponentInputBinding`), but `loadAll()` runs only once from the constructor. Angular reuses the component when only `:id` changes.

**Scenario:** The user is on project A and opens project B through global search. The page still shows A's data, tasks and rates, while actions (`changeStatus`, `addTask`, adding a rate) use `this.id()`, which is now B. A task meant for A is created in B. The client detail page has the same stale-loading behavior.

**Fix:** Drive loading from an `effect()` on `id()` (with `untracked` for the loaders, see the signals convention), and reset the signals on change. Codex rated this HIGH. It was lowered to MEDIUM because it needs a same-route navigation, which today only global search triggers.

---

### 19. [MEDIUM] Entries that cross midnight cannot be saved from the dialogs

**File:** `frontend/src/app/features/timer/timer.component.ts:546,570-583`, `frontend/src/app/features/calendar/calendar.component.ts:814-828`
**Found by:** Claude, Codex

```ts
startTime: toInstant(this.date, this.startTime),
endTime:   toInstant(this.date, this.endTime),
```

Both instants use the same date (the entry's `entryDate`, which comes from the end time).

**Scenario:** A manual entry from 22:00 to 01:00 is rejected with "endTime must be after startTime". Opening and saving an existing Monday 23:00 – Tuesday 01:00 entry rebuilds it as Tuesday 23:00 – Tuesday 01:00 and fails, even without changes. Also, an empty time field makes `toInstant` throw and nothing happens: no request is sent and no message is shown. `executeSplit` (`timer.component.ts:653`) has the same date assumption.

**Fix:** If `end <= start`, add a day to the end (or add an end-date field). Validate that both times are filled before saving.

---

### 20. [MEDIUM] Saving an unchanged entry changes its duration

**File:** `frontend/src/app/shared/utils/date-utils.ts:36` (`toInstant`), `features/timer/timer.component.ts:547`, calendar editor
**Found by:** Codex

The dialogs keep only `HH:MM` and rebuild the instants with `:00` seconds.

**Scenario:** A timer entry 09:00:45 – 09:01:15 (30 s) is opened and saved without changes. It becomes 09:00:00 – 09:01:00 (60 s). For every timer entry, the raw duration and the amount shift by up to a minute whenever only the description or tags are edited, which violates "raw duration stays unchanged".

**Fix:** Send `startTime`/`endTime` only when the user changed them, or keep the original instant when the `HH:MM` value is unchanged.

---

### 21. [MEDIUM] Calendar move stretches short entries

**File:** `frontend/src/app/features/calendar/calendar.component.ts:647`
**Found by:** Claude, Codex

`durationMin = max(SNAP_MIN, round(dur/60))` with `SNAP_MIN = 15`.

**Scenario:** Dragging a 5-minute entry makes it 15 minutes long and drops its seconds, without any notice.

**Fix:** Keep the original `durationSeconds` when moving, and snap only the start time.

---

### 22. [MEDIUM] Overlapping loads without cancellation

**File:** `frontend/src/app/features/reports/reports.component.ts:975-995` (`loadAll`), and the `load()` methods in `timer.component.ts:420`, `timesheet.component.ts:255` and `calendar.component.ts:474`
**Found by:** Claude, Codex

Every filter or navigation change fires plain `subscribe()` calls with no `switchMap` and no request token. Reports fires 5–6 parallel requests per change.

**Scenario:** The user steps quickly through weeks or days, or a filter is restored from saved view state (which triggers a second navigation). A slow response for the older range arrives last and overwrites the newer data, so the label shows week N while the numbers belong to week N−1. On the timer page, a stale day response can put the wrong day's entries in front of bulk delete (Codex). Smaller instances of the same problem: report task lists, heatmap and pagination, and the timesheet task-list effect.

**Fix:** Drive loads from `toObservable(filter)` with `switchMap`, or use `onCleanup` in the effect (as `dashboard.component.ts` already does), or drop responses whose token is not the latest.

---

### 23. [MEDIUM] Timer poll can overwrite start/stop

**File:** `frontend/src/app/core/timer-state.service.ts:37-58`
**Found by:** Claude, Codex

`refresh()` runs every 15 s with no coordination with `start`/`stop`. On error it also sets the timer to `null` (`catchError(() => of(null))`).

**Scenario:** A poll is in flight and the user stops the timer. The stop response sets `null`, then the late poll response sets it back to "running". The bar shows a running timer for up to 15 s, and clicking Stop again shows an error toast. The reverse happens with Start. A temporary 500 hides a running timer, the user starts a new one, and gets a 409.

**Fix:** Keep a mutation counter and ignore poll results that started before the last mutation. On error, keep the previous value.

---

### 24. [MEDIUM] Description save on blur races with Stop

**File:** `frontend/src/app/core/layout/timer-bar.component.ts:30-31, 201-212`
**Found by:** Claude, Codex

**Scenario:** The user types a description and immediately clicks Stop. Blur sends a PATCH and the click sends the stop request, in parallel. Either the description is lost, or the PATCH hits a timer that no longer exists (404 toast). Also, clearing the field sends `description: null`, which the backend treats as "unchanged", so a description cannot be removed from a running timer (Codex).

**Fix:** Pass the current description to `stop()` (the API already accepts it), or chain the PATCH before the stop. Send an empty string (or an explicit clear flag) for an emptied field.

---

### 25. [MEDIUM] Global search dies after one error

**File:** `frontend/src/app/core/layout/global-search.component.ts:152-181`
**Found by:** Claude, Codex

The inner `entryApi.list(...)` in `switchMap` has no `catchError`. The outer subscription ends on the first HTTP error. `distinctUntilChanged` also keeps the last query after `close()`, so typing the same query again shows nothing.

**Scenario:** One search hits a 500 or a network blip. From then on search never returns results and `loading` stays `true` until the page is reloaded.

**Fix:** Add `catchError(() => of(null))` inside the `switchMap` and reset `loading`. Reset the subject on close.

---

### 26. [MEDIUM] Timer page list misses entries created by the top bar

**File:** `frontend/src/app/features/timer/timer.component.ts:402`, `core/layout/timer-bar.component.ts:201`
**Found by:** Claude, Codex

The page does not react to `timerState.timer()` changes. When the timer is stopped from the top bar or with `s`, the new entry is missing from the day list and totals until reload.

**Fix:** Add an effect that watches the timer and calls `untracked(() => this.load())` when it goes from running to `null`.

---

### 27. [MEDIUM] Billable defaults are ignored when tracking

**File:** `frontend/src/app/core/layout/timer-bar.component.ts:145` (`billable = true`), `:173` (`onProjectChange`), `features/timer/timer.component.ts:417` (new manual entry)
**Found by:** Codex

The timer bar starts with `billable = true` and does not update it from the selected project's or task's `billableByDefault`. New manual entries also hard-code `billable: true`. The backend takes the request flag as given (`TimerStartRequest.billable` is a primitive `boolean`).

**Scenario:** The user selects the non-billable project "Intern" and starts the timer. The entry is billable and generates revenue unless the user remembers to switch the toggle.

**Fix:** Set `billable` from the task default, else the project default, in `onProjectChange` and on task change. Do the same in the manual dialog. Optionally let the backend apply the default when the flag is omitted (`Boolean`).

---

### 28. [MEDIUM] Timer bar catalogs are never refreshed

**File:** `frontend/src/app/core/layout/timer-bar.component.ts:147-148`
**Found by:** Claude (as LOW), Codex

Projects and tags load once when the app shell creates the timer bar.

**Scenario:** On a fresh installation, the user creates the first project and goes back to tracking. The top bar still offers no project until a full reload. Archived projects and tags also stay selectable.

**Fix:** Reload on focus or open of the select, or share a catalog service that is invalidated after create, update or archive. Raised from LOW to MEDIUM because it blocks the very first use of the app.

---

### 29. [MEDIUM] Search hit opens today instead of the entry's day

**File:** `frontend/src/app/core/layout/global-search.component.ts:207-209`, `frontend/src/app/features/timer/timer.component.ts:334`
**Found by:** Claude, Codex (rated LOW)

`goEntry` navigates to `/timer?date=…`, but `TimerComponent` initialises `viewDate = signal(today())` and never reads the query param.

**Fix:** Read `date` from the route in `TimerComponent`.

---

### 30. [MEDIUM] Timesheet disables every input while saving

**File:** `frontend/src/app/features/timesheet/timesheet.component.ts:338` (template `[disabled]="saving()"`)
**Found by:** Claude

**Scenario:** The user types a value and presses Tab. The save starts, all inputs are disabled, and the newly focused cell loses focus. Fast keyboard entry, the main purpose of the timesheet, breaks.

**Fix:** Disable only the cell being saved, or queue saves.

---

### 31. [LOW] Further findings

Backend (`src/main/java/com/ch3xy/dash/…`):

| Location | Finding | Found by |
|---|---|---|
| `report/ReportQueryRepository.java:44,73,101,267` | With `rounded=true`, durations are rounded but revenue still sums the raw `amount_snapshot`, so hours × rate ≠ revenue. This may be intended; decide and document it in business-rules. | Claude |
| `timeentry/TimeEntryService.java:323-330` (`computeAmount`) | Hours are rounded to 10 decimals before the multiplication, so exact half-cent results round down: 120 s at €10.65/h gives €0.35 instead of €0.36. Compute `seconds × rate / 3600` and round once. CONFIRMED. | Codex |
| `closing/MonthLockService.java:64,80` | `requireOpen()` and locking a month are not synchronised. An update that passed the check can commit after the month was closed in another tab. | Codex |
| `timeentry/TimeEntryService.java:208` (`deleteByCriteria`) | The lock check and count check are separate from the DELETE, which re-evaluates the criteria, so an entry committed in between (e.g. by an import) is deleted although `expectedCount` did not include it. | Claude, Codex |
| `timesheet/TimesheetService.java:79` | Setting a cell reads the current total and appends the difference with no lock; two tabs setting the same empty cell to 1 h produce 2 h. | Codex |
| `dataio/BackupService.java:54` | The export runs several queries without a read-only repeatable-read transaction, so a concurrent change can produce a backup with an entry whose project is missing, which then fails to restore. | Codex |
| `dataio/ClockifyRowImporter.java:107-119,149-171` | Client and tag lookups exclude archived records, so the import creates active duplicates of archived names, and re-importing the same CSV after archiving its client imports every entry again (duplicate detection depends on the resolved project). | Claude, Codex |
| `dataio/ClockifyRowImporter.java:91-97` | Counters are incremented inside the row transaction and not rolled back, so the summary over-reports created objects. | Claude |
| `dataio/ClockifyRowImporter.java:173-183` | `atZone` silently shifts times in the DST gap or overlap. | Claude |
| `project/ProjectRepository.java:22`, `ProjectService.java` (`checkNameUnique`), V2 `ux_project_name_per_client` | Project names are not unique when `client_id` is NULL: the query compares `client_id = NULL`, and the index treats NULLs as distinct. | Claude, Codex |
| `project/ProjectService.java:79-109` | `getBudgetStatus` uses `LocalDate.now(zone)` instead of `Clock`, and future-dated entries count against the current period. | Claude |
| `timeentry/TimeEntryService.java` (`apply`) | No maximum duration; `(int) durationSeconds` can overflow on typo years. | Claude |
| `report/ReportService.java:132`, `ForecastService.java:200`, heatmap | Unbounded per-day loops for huge ranges; a huge `year` throws and returns 500. | Claude |
| `timeentry/TimeEntryService.java` (`recentCombinations`, `q`) | A negative `limit` returns 500, and `%`/`_` in the search are not escaped. | Claude |
| `report/CsvExportService.java:35` | Commas instead of the documented semicolons, times without dates, and no protection against formula injection (`=…`). | Claude |
| `timer/TimerController.java:50` / `TimerStopRequest` | The docs mention an optional custom end time on stop, but it is not implemented. | Claude |
| `settings/AppSettingsService.java` | Changing the time zone does not recompute `entry_date` of existing entries (document it). | Claude |

Frontend (`frontend/src/app/…`):

| Location | Finding | Found by |
|---|---|---|
| `shared/utils/date-utils.ts` | All date math uses the browser's time zone, not the app setting. With a browser outside the app zone, entered times map to different instants and "today" can differ from the backend. Acceptable for a single local user; Codex rated it MEDIUM. | Claude, Codex |
| `features/projects/project-detail.component.ts:260`, `features/reports/reports.component.ts:1193` | Budget colour uses `>= 100` for "danger", while the backend and business rules use `> 100` for EXCEEDED, so exactly 100 % shows red here and "warning" elsewhere. | Codex |
| `features/reports/reports.component.ts:207` | Overview has no loading or error branch; old numbers stay visible during reload, or the card stays blank on error. | Claude |
| `features/reports/reports.component.ts:949`, `features/dashboard/dashboard.component.ts:211` | URL params (`from`, `to`, `groupBy`) are not validated. | Claude |
| `core/keyboard-shortcut.service.ts:50-56` | `s` only stops the timer (the spec says start/stop) and has no `e.repeat` guard. Shortcuts also fire while a dialog is open (`n` resets a half-filled form). | Claude |
| `core/layout/dialog-host.component.ts:11-30` | Confirm dialog has no `role="dialog"` or `aria-modal`, no initial focus, no Escape handling and no focus trap. | Claude |
| `core/dialog.service.ts:41-70` | A second confirm overwrites the pending one, so the first promise never resolves. | Claude |
| `core/month-lock-state.service.ts:45-47` | `anyLocked` checks only the first and last month (latent; only called for weeks today). | Claude |
| `features/timer/timer.component.ts:333,503`, `features/calendar/calendar.component.ts:347` | `todayIso` is fixed at construction, so it is stale after midnight. | Claude |
| `features/timer/timer.component.ts:344` | `new Date(todayIso)` is parsed as UTC (wrong day in UTC− zones). | Claude |
| `features/timer/timer.component.ts` (project select) | Only ACTIVE projects are listed, so editing an entry of an archived project shows an empty select. | Claude |
| `features/timer/timer.component.ts`, `core/layout/timer-bar.component.ts:58` | Emoji-only buttons have no `aria-label`. | Claude |
| `features/calendar/calendar.component.ts:651` | Resizing clamps the end of entries that cross midnight. | Claude |
| `features/calendar/calendar.component.ts:599-619` | Touch listeners are not removed in `ngOnDestroy`. | Claude |
| `features/calendar/calendar.component.ts` (layout) | Block height comes from `durationSeconds` while position comes from wall-clock time, so they drift on DST days. | Claude |
| `features/timesheet/timesheet.component.ts:372` | `format()` rounds while `DurationPipe` floors (1-minute mismatch). | Claude |
| `features/projects/project-detail.component.ts:214` | The default `rateFrom` is the UTC date (yesterday between 00:00 and 02:00 in Vienna). | Claude |
| `features/projects/project-detail.component.ts:137`, `features/clients/client-detail.component.ts:95` | No error or not-found state; the spinner never stops. | Claude |

---

## Dropped findings
| Reviewer | Location | Finding | Reason |
|---|---|---|---|
| Claude (frontend) | `features/projects/project-form-dialog.component.ts` | `defaultHourlyRate` is typed as a string but bound to `type=number` | No observable failure; Jackson accepts both |

No Codex finding was dropped. Several were downgraded (see "Reviewer agreement").

## Checked and clean
Both reviewers agree on the following unless noted:
- **SQL injection:** all native SQL is parameterised. Dynamic fragments (group-by, rounding expressions) come from enums or ints. Client `Sort` is stripped before the native query (tested).
- **No tag fan-out in aggregations:** tag filters use `EXISTS`, and summary totals are computed separately so that multi-tag entries are not counted twice.
- **Rate resolution order** on creation (task → project rate at start → project default → app default) is correct and tested. Amounts are `BigDecimal` HALF_UP at scale 2 (but see the LOW item on intermediate rounding). Non-billable entries get 0. `bulkUpdate` recomputes the amount from the stored rate.
- **`entryDate`** is always derived from the end time in the app zone, including a timer that stops after midnight (tested). Overnight entries are accepted without automatic splitting.
- **Timer stop** creates the entry and deletes the timer in one transaction; timer tags are persisted (Codex).
- **Rounding in reports** (UP/DOWN/NEAREST) is applied per entry and never changes stored raw durations (Codex).
- **Budget resets:** the MONTHLY and YEARLY boundaries are computed in the app zone.
- **Month locks** are enforced on create, update (old and new date), delete, every bulk operation, split, timer stop, every timesheet operation and the import. Only past months can be locked. Restore intentionally bypasses the locks (race: see LOW list).
- **DB integrity:** foreign keys prevent deleting clients with projects; active client and tag names and task names are unique in the DB (Codex).
- **Restore and export:** restore runs in one transaction. XLSX and CSV resources are closed properly.
- **Clockify import:** each row runs in its own `REQUIRES_NEW` transaction (through a separate bean), and duplicates are detected.
- **Base href and API paths:** `/dash/` is set correctly, and the API and export URLs are relative. The SPA fallback excludes `/api`.
- **XSS:** there is no `[innerHTML]` and no `bypassSecurityTrust`. `websiteHref` forces http(s), and links use `rel=noopener`.
- **Timer tick** is computed from `Date.now()`, so it stays correct after tab sleep. Calendar cleans up its interval, `ResizeObserver` and drag listeners. The dashboard effect uses `onCleanup`, so its superseded requests are cancelled.
- **Date helpers:** `date-range.ts` and `isoWeek` are correct, including month/year boundaries and DST-aware day stepping, and the date-range picker is keyboard accessible.
- **Pipes:** the duration and money pipes are correct and have specs. Timesheet `parseDuration` is correct.
- **Closing and data pages:** the loading, error and confirm flows are correct.

## Test coverage gaps
There are no tests for:
- restoring an empty or foreign document, and a backup/restore round trip with an open-ended rate (#1, #2)
- re-snapshotting on update or split (#4, #5)
- backdated rates (#10)
- a budget of 0 (#7) and a project with only a money budget (#16)
- invalid settings (#3)
- the timesheet midnight overflow (#8)
- a timer project change with a stale task (#9)
- mixed currencies in reports (#14)
- half-cent amounts in `computeAmount`
- MONTHLY or YEARLY budget resets with data
- rounded vs raw revenue, and `rounded` on detailed/export (#17)
- the frontend race conditions, the dialogs crossing midnight and the seconds lost on save (#19–#24)

## Reviewer agreement
- **Found by both:** 24 findings (20 of the HIGH/MEDIUM ones, plus 4 LOW). Both HIGH findings of the Claude run were also found by Codex.
- **Only Codex:** 13. HIGH: #1 empty restore wipe, #2 restore expiring rates. MEDIUM: #14 mixed currencies (Claude had only the frontend part), #16, #17, #18, #20, #27. LOW: half-cent rounding, month-lock race, timesheet concurrency, backup snapshot consistency, budget colour at 100 %.
- **Only Claude:** #15, #30 and most of the LOW list (a11y, keyboard shortcuts, dialog service, calendar details, import counters, CSV format).

Severity changes relative to the reviewers:
- Codex rated #6 (single timer), #7 (budget 0), #14 (currencies), #18 (stale detail pages), the month-lock race and the bulk-delete race as HIGH. They were set to MEDIUM or LOW because the app has a single user, a race needs two tabs, and #7 needs an unusual input.
- Codex rated the browser time zone (`date-utils.ts`) MEDIUM. It stays LOW because the app runs locally in the same zone.
- Timer bar catalogs (#28) were raised from Claude's LOW to MEDIUM, because on a fresh installation the first project cannot be selected without a reload.
- Search `?date` (#29) stays MEDIUM; Codex rated it LOW.
- Frontend report race (#22): Claude's frontend agent rated it high, and it was lowered to medium. It affects only what is displayed, it is transient, and the app has a single user.
- Validation gap (#11): reported by both Claude agents and by Codex, merged into one finding.
