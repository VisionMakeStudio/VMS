-- VMS Phase 3: Stripe billing persistence layer.
-- This migration was already applied to the production Supabase project on 2026-08-19.
-- Kept here for source control / environment parity. Do not rerun manually against production.

create table if not exists public.billing_customers (
  client_id uuid primary key references public.clients(id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text not null unique,
  email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_checkout_sessions (
  provider_session_id text primary key,
  client_id uuid not null references public.clients(id) on delete cascade,
  service_key text not null,
  mode text not null check (mode in ('payment','subscription')),
  status text not null default 'open',
  currency text not null default 'USD',
  service_amount numeric not null default 0,
  activation_fee numeric not null default 0,
  provider_customer_id text,
  provider_subscription_id text,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_events (
  provider_event_id text primary key,
  provider text not null default 'stripe',
  event_type text not null,
  object_id text,
  livemode boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists billing_checkout_sessions_client_idx on public.billing_checkout_sessions(client_id, created_at desc);
create index if not exists billing_checkout_sessions_service_idx on public.billing_checkout_sessions(service_key, created_at desc);
create index if not exists billing_events_type_idx on public.billing_events(event_type, processed_at desc);

alter table public.billing_customers enable row level security;
alter table public.billing_checkout_sessions enable row level security;
alter table public.billing_events enable row level security;

drop policy if exists "admins billing customers all" on public.billing_customers;
create policy "admins billing customers all" on public.billing_customers
for all to authenticated using (private.is_vms_admin()) with check (private.is_vms_admin());

drop policy if exists "clients see billing customer" on public.billing_customers;
create policy "clients see billing customer" on public.billing_customers
for select to authenticated using (
  exists (
    select 1 from public.clients c
    where c.id = billing_customers.client_id
      and lower(c.owner_email) = lower(coalesce(auth.jwt()->>'email',''))
  )
);

drop policy if exists "admins billing checkout all" on public.billing_checkout_sessions;
create policy "admins billing checkout all" on public.billing_checkout_sessions
for all to authenticated using (private.is_vms_admin()) with check (private.is_vms_admin());

drop policy if exists "clients see billing checkout" on public.billing_checkout_sessions;
create policy "clients see billing checkout" on public.billing_checkout_sessions
for select to authenticated using (
  exists (
    select 1 from public.clients c
    where c.id = billing_checkout_sessions.client_id
      and lower(c.owner_email) = lower(coalesce(auth.jwt()->>'email',''))
  )
);

drop policy if exists "admins billing events read" on public.billing_events;
create policy "admins billing events read" on public.billing_events
for select to authenticated using (private.is_vms_admin());

grant select, insert, update, delete on public.billing_customers to authenticated;
grant select, insert, update, delete on public.billing_checkout_sessions to authenticated;
grant select on public.billing_events to authenticated;
