-- VMS MASTER PHASE 6 — Scheduling & Service Operations
-- Additive production migration for real jobs, booking requests, availability, and blackouts.

create table if not exists public.service_jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  catalog_service_id text references public.service_catalog(id) on delete set null,
  service_name text not null,
  title text not null,
  status text not null default 'scheduled'
    check (status in ('draft','scheduled','confirmed','in_progress','post_production','ready','completed','canceled')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  timezone text not null default 'America/New_York',
  location_type text not null default 'onsite'
    check (location_type in ('onsite','remote','studio','other')),
  address text,
  assigned_to text,
  client_notes text,
  internal_notes text,
  reminder_at timestamptz,
  client_visible boolean not null default true,
  source text not null default 'admin',
  completed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  job_id uuid references public.service_jobs(id) on delete set null,
  request_type text not null default 'new'
    check (request_type in ('new','reschedule','cancel')),
  catalog_service_id text references public.service_catalog(id) on delete set null,
  service_name text,
  requested_start timestamptz,
  requested_end timestamptz,
  alternate_start timestamptz,
  timezone text not null default 'America/New_York',
  location_type text not null default 'onsite'
    check (location_type in ('onsite','remote','studio','other')),
  address text,
  client_note text,
  admin_note text,
  status text not null default 'new'
    check (status in ('new','reviewing','approved','declined','canceled')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/New_York',
  catalog_service_id text references public.service_catalog(id) on delete cascade,
  slot_minutes integer not null default 60 check (slot_minutes between 15 and 720),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 240),
  lead_time_hours integer not null default 24 check (lead_time_hours between 0 and 2160),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.schedule_blackouts (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists service_jobs_client_start_idx
  on public.service_jobs(client_id, scheduled_start);
create index if not exists service_jobs_status_start_idx
  on public.service_jobs(status, scheduled_start);
create index if not exists service_jobs_assigned_start_idx
  on public.service_jobs(assigned_to, scheduled_start);
create index if not exists booking_requests_client_status_idx
  on public.booking_requests(client_id, status, created_at desc);
create index if not exists booking_requests_status_created_idx
  on public.booking_requests(status, created_at desc);
create index if not exists availability_rules_weekday_idx
  on public.availability_rules(weekday, active);
create index if not exists schedule_blackouts_start_idx
  on public.schedule_blackouts(starts_at, ends_at);

alter table public.service_jobs enable row level security;
alter table public.booking_requests enable row level security;
alter table public.availability_rules enable row level security;
alter table public.schedule_blackouts enable row level security;

drop policy if exists "admins service jobs" on public.service_jobs;
create policy "admins service jobs" on public.service_jobs for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());
drop policy if exists "clients see service jobs" on public.service_jobs;
create policy "clients see service jobs" on public.service_jobs for select to authenticated
  using (
    client_visible=true and exists(
      select 1 from public.clients c
      where c.id=client_id
        and lower(c.owner_email)=lower(coalesce((select auth.jwt())->>'email',''))
    )
  );

drop policy if exists "admins booking requests" on public.booking_requests;
create policy "admins booking requests" on public.booking_requests for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());
drop policy if exists "clients see booking requests" on public.booking_requests;
create policy "clients see booking requests" on public.booking_requests for select to authenticated
  using (
    exists(
      select 1 from public.clients c
      where c.id=client_id
        and lower(c.owner_email)=lower(coalesce((select auth.jwt())->>'email',''))
    )
  );

drop policy if exists "admins availability rules" on public.availability_rules;
create policy "admins availability rules" on public.availability_rules for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());

drop policy if exists "admins schedule blackouts" on public.schedule_blackouts;
create policy "admins schedule blackouts" on public.schedule_blackouts for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());

grant select,insert,update,delete on public.service_jobs to authenticated;
grant select,insert,update,delete on public.booking_requests to authenticated;
grant select,insert,update,delete on public.availability_rules to authenticated;
grant select,insert,update,delete on public.schedule_blackouts to authenticated;
