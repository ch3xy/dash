-- Monatsabschluss: a row locks all time entries whose entry_date falls into that month.
create table month_locks (
    month     date        primary key,
    locked_at timestamptz not null,
    note      text,
    constraint chk_month_is_first_day check (extract(day from month) = 1)
);
