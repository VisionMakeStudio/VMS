-- VMS MASTER PHASE 5 — Onboarding task compatibility
-- Source-control record of the production compatibility fix discovered during
-- the Phase 5 end-to-end test. This migration is intentionally idempotent.
--
-- Production already contained an older client_onboarding_tasks table whose
-- status values were pending/done/skipped and which did not include the newer
-- Phase 5 required/due_at fields. Phase 5 expects pending/complete/waived.

alter table public.client_onboarding_tasks
  add column if not exists required boolean not null default true;

alter table public.client_onboarding_tasks
  add column if not exists due_at timestamptz;

-- Normalize legacy values before replacing the status constraint.
update public.client_onboarding_tasks
set status = 'complete'
where status = 'done';

update public.client_onboarding_tasks
set status = 'waived'
where status = 'skipped';

alter table public.client_onboarding_tasks
  drop constraint if exists client_onboarding_tasks_status_check;

alter table public.client_onboarding_tasks
  add constraint client_onboarding_tasks_status_check
  check (status in ('pending','complete','waived'));

create index if not exists onboarding_tasks_client_idx
  on public.client_onboarding_tasks(client_id, status, created_at);
