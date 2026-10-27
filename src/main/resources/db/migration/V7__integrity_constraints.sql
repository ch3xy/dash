-- At most one running timer. Duplicates could only arise from concurrent starts; the
-- app always showed the oldest one, so later "ghost" rows are removed.
delete from running_timers rt
where exists (select 1 from running_timers older
              where older.start_time < rt.start_time
                 or (older.start_time = rt.start_time and older.id < rt.id));
create unique index ux_single_running_timer on running_timers ((true));

-- At most one open-ended rate per project. Older duplicates are closed at the start
-- of the newest open rate, as adding a rate would have done.
update project_rates r
set valid_to = newest.valid_from
from (select distinct on (project_id) id, project_id, valid_from
      from project_rates where valid_to is null
      order by project_id, valid_from desc, id desc) newest
where r.project_id = newest.project_id
  and r.valid_to is null
  and r.id <> newest.id;
create unique index ux_open_rate_per_project on project_rates (project_id) where valid_to is null;

-- NOT VALID: enforced for new and changed rows; existing rows are not re-checked,
-- so a database with legacy values still migrates.
alter table project_rates
    add constraint chk_rate_range       check (valid_to is null or valid_to > valid_from) not valid,
    add constraint chk_rate_nonnegative check (hourly_rate >= 0) not valid;

alter table projects
    add constraint chk_project_rate_nonnegative check (default_hourly_rate is null or default_hourly_rate >= 0) not valid,
    add constraint chk_hour_budget_positive     check (hour_budget_minutes is null or hour_budget_minutes > 0) not valid,
    add constraint chk_money_budget_nonnegative check (money_budget_amount is null or money_budget_amount >= 0) not valid;

alter table tasks
    add constraint chk_task_rate_nonnegative     check (hourly_rate_override is null or hourly_rate_override >= 0) not valid,
    add constraint chk_task_estimate_nonnegative check (estimated_minutes is null or estimated_minutes >= 0) not valid;
