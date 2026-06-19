# Datenmodell PostgreSQL

Flyway-Migrationen unter `src/main/resources/db/migration/`.  
Namensschema: `V{n}__{beschreibung}.sql`

---

## DDL

```sql
-- V1__create_clients.sql
create table clients (
  id           uuid          not null default gen_random_uuid() primary key,
  name         text          not null,
  description  text,
  email        text,
  website      text,
  currency_code varchar(3),
  archived     boolean       not null default false,
  created_at   timestamptz   not null,
  updated_at   timestamptz   not null
);

-- V2__create_projects.sql
create table projects (
  id                   uuid          not null default gen_random_uuid() primary key,
  client_id            uuid          references clients(id),
  name                 text          not null,
  description          text,
  color                text,
  status               text          not null,          -- ACTIVE|PAUSED|COMPLETED|ARCHIVED
  billable_by_default  boolean       not null default true,
  default_hourly_rate  numeric(12,2),
  currency_code        varchar(3)    not null,
  hour_budget_minutes  integer,
  money_budget_amount  numeric(12,2),
  budget_reset         text          not null default 'NONE',  -- NONE|MONTHLY|YEARLY
  created_at           timestamptz   not null,
  updated_at           timestamptz   not null
);

-- V3__create_project_rates.sql
create table project_rates (
  id            uuid          not null default gen_random_uuid() primary key,
  project_id    uuid          not null references projects(id),
  hourly_rate   numeric(12,2) not null,
  currency_code varchar(3)    not null,
  valid_from    timestamptz   not null,
  valid_to      timestamptz,
  note          text
);

-- V4__create_tasks.sql
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

-- V5__create_tags.sql
create table tags (
  id         uuid          not null default gen_random_uuid() primary key,
  name       text          not null,
  color      text,
  archived   boolean       not null default false,
  created_at timestamptz   not null,
  updated_at timestamptz   not null
);

-- V6__create_time_entries.sql
create table time_entries (
  id                    uuid          not null default gen_random_uuid() primary key,
  project_id            uuid          not null references projects(id),
  task_id               uuid          references tasks(id),
  description           text,
  start_time            timestamptz   not null,
  end_time              timestamptz   not null,
  duration_seconds      integer       not null,
  entry_date            date          not null,
  billable              boolean       not null,
  hourly_rate_snapshot  numeric(12,2),
  currency_code_snapshot varchar(3),
  amount_snapshot       numeric(12,2),
  source                text          not null,         -- TIMER|MANUAL|IMPORT|ADJUSTMENT
  created_at            timestamptz   not null,
  updated_at            timestamptz   not null
);

-- V7__create_time_entry_tags.sql
create table time_entry_tags (
  time_entry_id uuid not null references time_entries(id) on delete cascade,
  tag_id        uuid not null references tags(id),
  primary key (time_entry_id, tag_id)
);

-- V8__create_running_timers.sql
create table running_timers (
  id          uuid        not null default gen_random_uuid() primary key,
  project_id  uuid        not null references projects(id),
  task_id     uuid        references tasks(id),
  description text,
  start_time  timestamptz not null,
  billable    boolean     not null,
  created_at  timestamptz not null
);

-- V9__create_app_settings.sql
create table app_settings (
  key   text not null primary key,
  value text not null
);

insert into app_settings (key, value) values
  ('timezone',          'Europe/Vienna'),
  ('currency',          'EUR'),
  ('default_rate',      '0.00'),
  ('rounding_rule',     'NONE'),
  ('rounding_minutes',  '15');
```

---

## Indexe und Constraints

```sql
-- V10__create_indexes.sql
create index idx_time_entries_entry_date         on time_entries(entry_date);
create index idx_time_entries_project_date       on time_entries(project_id, entry_date);
create index idx_time_entries_task_date          on time_entries(task_id, entry_date);
create index idx_time_entries_billable_date      on time_entries(billable, entry_date);
create index idx_projects_client                 on projects(client_id);

-- Unique Constraints
create unique index ux_active_client_name        on clients(lower(name)) where archived = false;
create unique index ux_project_name_per_client   on projects(client_id, lower(name));
create unique index ux_task_name_per_project     on tasks(project_id, lower(name));
create unique index ux_tags_name                 on tags(lower(name)) where archived = false;
```

---

## Constraints und Validierungen (DB-Ebene)

```sql
-- V11__add_check_constraints.sql
alter table time_entries
  add constraint chk_duration_positive      check (duration_seconds > 0),
  add constraint chk_end_after_start        check (end_time > start_time),
  add constraint chk_source_valid           check (source in ('TIMER','MANUAL','IMPORT','ADJUSTMENT'));

alter table projects
  add constraint chk_status_valid           check (status in ('ACTIVE','PAUSED','COMPLETED','ARCHIVED')),
  add constraint chk_budget_reset_valid     check (budget_reset in ('NONE','MONTHLY','YEARLY'));
```

---

## JPA-Entitäten — Mapping-Notizen

- `@Id` als `UUID`, generiert via `@UuidGenerator` (Hibernate 6+).
- `@CreationTimestamp` / `@UpdateTimestamp` für `createdAt`/`updatedAt`.
- `startTime` / `endTime` / `createdAt` → `Instant` in Java, `timestamptz` in DB.
- `entryDate` → `LocalDate`, `date` in DB.
- `durationSeconds` → `int`.
- Geldbeträge → `BigDecimal` mit `@Column(precision=12, scale=2)`.
- `status`, `source`, `budgetReset` → Java-Enum, gespeichert als `@Enumerated(EnumType.STRING)`.
- `tags` in `TimeEntry` → `@ManyToMany` via `time_entry_tags`.
- `RunningTimer` ist eigene Entität, kein Subtyp von `TimeEntry`.

---

## AppSettings — Definierte Schlüssel

| Key | Typ | Default | Beschreibung |
|---|---|---|---|
| `timezone` | String (ZoneId) | `Europe/Vienna` | App-Zeitzone für `entryDate`-Berechnung |
| `currency` | String (ISO 4217) | `EUR` | Standard-Währung |
| `default_rate` | BigDecimal | `0.00` | Fallback-Stundensatz |
| `rounding_rule` | Enum-String | `NONE` | `NONE`, `UP`, `NEAREST`, `DOWN` |
| `rounding_minutes` | Integer | `15` | Rundungsintervall in Minuten |
