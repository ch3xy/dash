-- ============================================================
-- Full schema for the time tracking application
-- ============================================================

create table clients (
    id            uuid          not null default gen_random_uuid() primary key,
    name          text          not null,
    description   text,
    email         text,
    website       text,
    currency_code varchar(3),
    archived      boolean       not null default false,
    created_at    timestamptz   not null,
    updated_at    timestamptz   not null
);

create table projects (
    id                   uuid          not null default gen_random_uuid() primary key,
    client_id            uuid          references clients(id),
    name                 text          not null,
    description          text,
    color                text,
    status               text          not null,
    billable_by_default  boolean       not null default true,
    default_hourly_rate  numeric(12,2),
    currency_code        varchar(3)    not null,
    hour_budget_minutes  integer,
    money_budget_amount  numeric(12,2),
    budget_reset         text          not null default 'NONE',
    created_at           timestamptz   not null,
    updated_at           timestamptz   not null
);

create table project_rates (
    id            uuid          not null default gen_random_uuid() primary key,
    project_id    uuid          not null references projects(id),
    hourly_rate   numeric(12,2) not null,
    currency_code varchar(3)    not null,
    valid_from    timestamptz   not null,
    valid_to      timestamptz,
    note          text
);

create table tasks (
    id                   uuid          not null default gen_random_uuid() primary key,
    project_id           uuid          not null references projects(id),
    name                 text          not null,
    description          text,
    billable_by_default  boolean       not null default true,
    hourly_rate_override numeric(12,2),
    estimated_minutes    integer,
    archived             boolean       not null default false,
    created_at           timestamptz   not null,
    updated_at           timestamptz   not null
);

create table tags (
    id         uuid          not null default gen_random_uuid() primary key,
    name       text          not null,
    color      text,
    archived   boolean       not null default false,
    created_at timestamptz   not null,
    updated_at timestamptz   not null
);

create table time_entries (
    id                     uuid          not null default gen_random_uuid() primary key,
    project_id             uuid          not null references projects(id),
    task_id                uuid          references tasks(id),
    description            text,
    start_time             timestamptz   not null,
    end_time               timestamptz   not null,
    duration_seconds       integer       not null,
    entry_date             date          not null,
    billable               boolean       not null,
    hourly_rate_snapshot   numeric(12,2),
    currency_code_snapshot varchar(3),
    amount_snapshot        numeric(12,2),
    source                 text          not null,
    created_at             timestamptz   not null,
    updated_at             timestamptz   not null
);

create table time_entry_tags (
    time_entry_id uuid not null references time_entries(id) on delete cascade,
    tag_id        uuid not null references tags(id),
    primary key (time_entry_id, tag_id)
);

create table running_timers (
    id          uuid        not null default gen_random_uuid() primary key,
    project_id  uuid        not null references projects(id),
    task_id     uuid        references tasks(id),
    description text,
    start_time  timestamptz not null,
    billable    boolean     not null,
    created_at  timestamptz not null
);

create table running_timer_tags (
    running_timer_id uuid not null references running_timers(id) on delete cascade,
    tag_id           uuid not null references tags(id),
    primary key (running_timer_id, tag_id)
);

create table app_settings (
    key   text not null primary key,
    value text not null
);
