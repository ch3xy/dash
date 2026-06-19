-- Check constraints
alter table time_entries
    add constraint chk_duration_positive check (duration_seconds > 0),
    add constraint chk_end_after_start   check (end_time > start_time),
    add constraint chk_source_valid      check (source in ('TIMER','MANUAL','IMPORT','ADJUSTMENT'));

alter table projects
    add constraint chk_status_valid      check (status in ('ACTIVE','PAUSED','COMPLETED','ARCHIVED')),
    add constraint chk_budget_reset      check (budget_reset in ('NONE','MONTHLY','YEARLY'));
