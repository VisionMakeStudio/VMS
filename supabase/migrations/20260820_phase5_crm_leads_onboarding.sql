-- VMS MASTER PHASE 5 — CRM / Leads / Client Onboarding
-- Additive production migration. Safe for existing clients and intake requests.

alter table public.intake_requests add column if not exists contact_time text;
alter table public.intake_requests add column if not exists follow_up_at timestamptz;
alter table public.intake_requests add column if not exists lead_score integer not null default 50;
alter table public.intake_requests add column if not exists lost_reason text;
alter table public.intake_requests add column if not exists service_ids text[] not null default '{}'::text[];
alter table public.intake_requests add column if not exists internal_summary text;
alter table public.intake_requests add column if not exists converted_client_id uuid references public.clients(id) on delete set null;
alter table public.intake_requests add column if not exists converted_at timestamptz;
alter table public.intake_requests add column if not exists updated_at timestamptz not null default now();

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.intake_requests(id) on delete cascade,
  note text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists lead_notes_lead_created_idx on public.lead_notes(lead_id, created_at desc);
create index if not exists lead_notes_created_by_idx on public.lead_notes(created_by);

create table if not exists public.client_onboarding (
  client_id uuid primary key references public.clients(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','complete')),
  preferred_contact_method text,
  preferred_contact_time text,
  welcome_sent_at timestamptz,
  portal_invited_at timestamptz,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  task_key text not null,
  title text not null,
  status text not null default 'pending' check (status in ('pending','complete','waived')),
  required boolean not null default true,
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, task_key)
);
create index if not exists onboarding_tasks_client_idx on public.client_onboarding_tasks(client_id, status, created_at);

alter table public.activity_events add column if not exists lead_id uuid references public.intake_requests(id) on delete set null;
alter table public.activity_events add column if not exists metadata jsonb not null default '{}'::jsonb;
create index if not exists activity_events_lead_idx on public.activity_events(lead_id, created_at desc);

alter table public.lead_notes enable row level security;
alter table public.client_onboarding enable row level security;
alter table public.client_onboarding_tasks enable row level security;

drop policy if exists "admins lead notes" on public.lead_notes;
create policy "admins lead notes" on public.lead_notes for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());

drop policy if exists "admins onboarding" on public.client_onboarding;
create policy "admins onboarding" on public.client_onboarding for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());
drop policy if exists "clients see onboarding" on public.client_onboarding;
create policy "clients see onboarding" on public.client_onboarding for select to authenticated
  using (exists(select 1 from public.clients c where c.id=client_id and lower(c.owner_email)=lower(coalesce((select auth.jwt())->>'email',''))));

drop policy if exists "admins onboarding tasks" on public.client_onboarding_tasks;
create policy "admins onboarding tasks" on public.client_onboarding_tasks for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());
drop policy if exists "clients see onboarding tasks" on public.client_onboarding_tasks;
create policy "clients see onboarding tasks" on public.client_onboarding_tasks for select to authenticated
  using (exists(select 1 from public.clients c where c.id=client_id and lower(c.owner_email)=lower(coalesce((select auth.jwt())->>'email',''))));

grant select,insert,update,delete on public.lead_notes to authenticated;
grant select,insert,update,delete on public.client_onboarding to authenticated;
grant select,insert,update,delete on public.client_onboarding_tasks to authenticated;

-- Existing CRM support tables are admin-only in Phase 5.
alter table public.crm_interactions enable row level security;
alter table public.crm_tasks enable row level security;
drop policy if exists "admins crm interactions" on public.crm_interactions;
create policy "admins crm interactions" on public.crm_interactions for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());
drop policy if exists "admins crm tasks" on public.crm_tasks;
create policy "admins crm tasks" on public.crm_tasks for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());
grant select,insert,update,delete on public.crm_interactions to authenticated;
grant select,insert,update,delete on public.crm_tasks to authenticated;

-- Normalize legacy intake statuses into the Phase 5 pipeline where possible.
update public.intake_requests set status='new' where status is null or trim(status)='';
