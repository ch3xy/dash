-- Performance indexes
create index idx_time_entries_entry_date         on time_entries(entry_date);
create index idx_time_entries_project_date       on time_entries(project_id, entry_date);
create index idx_time_entries_task_date          on time_entries(task_id, entry_date);
create index idx_time_entries_billable_date      on time_entries(billable, entry_date);
create index idx_projects_client                 on projects(client_id);

-- Unique constraints
create unique index ux_active_client_name        on clients(lower(name)) where archived = false;
create unique index ux_project_name_per_client   on projects(client_id, lower(name));
create unique index ux_task_name_per_project     on tasks(project_id, lower(name));
create unique index ux_tags_name                 on tags(lower(name)) where archived = false;
