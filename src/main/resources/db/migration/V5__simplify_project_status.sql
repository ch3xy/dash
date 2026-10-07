-- Projects only distinguish ACTIVE and ARCHIVED; PAUSED/COMPLETED behaved like ACTIVE.
update projects set status = 'ACTIVE' where status in ('PAUSED', 'COMPLETED');

alter table projects drop constraint chk_status_valid;
alter table projects add constraint chk_status_valid check (status in ('ACTIVE', 'ARCHIVED'));
