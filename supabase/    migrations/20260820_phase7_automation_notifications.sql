-- VMS MASTER PHASE 7 — Automation & Notifications
-- Additive production migration for scheduled/event automation rules,
-- delivery deduplication/history, and automation run history.

create table if not exists public.automation_rules (
  rule_key text primary key,
  name text not null,
  description text,
  category text not null default 'system'
    check (category in ('billing','scheduling','onboarding','project','files','client','system')),
  trigger_type text not null default 'scheduled'
    check (trigger_type in ('scheduled','event')),
  enabled boolean not null default true,
  audience text not null default 'client'
    check (audience in ('client','admin','both')),
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  lead_minutes integer check (lead_minutes is null or lead_minutes between 0 and 525600),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_deliveries (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null references public.automation_rules(rule_key) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  source_type text not null,
  source_id text not null,
  audience text not null check (audience in ('client','admin')),
  channel text not null check (channel in ('in_app','email')),
  recipient text,
  subject text not null,
  message text not null,
  status text not null default 'processing'
    check (status in ('processing','sent','skipped','failed')),
  dedupe_key text not null,
  scheduled_for timestamptz,
  sent_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists automation_deliveries_active_dedupe_uidx
  on public.automation_deliveries(dedupe_key)
  where status in ('processing','sent');
create index if not exists automation_deliveries_created_idx
  on public.automation_deliveries(created_at desc);
create index if not exists automation_deliveries_client_idx
  on public.automation_deliveries(client_id, created_at desc);
create index if not exists automation_deliveries_status_idx
  on public.automation_deliveries(status, created_at desc);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'scheduled'
    check (source in ('scheduled','manual')),
  status text not null default 'running'
    check (status in ('running','completed','partial','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  scanned_count integer not null default 0,
  created_count integer not null default 0,
  sent_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists automation_runs_started_idx
  on public.automation_runs(started_at desc);

alter table public.automation_rules enable row level security;
alter table public.automation_deliveries enable row level security;
alter table public.automation_runs enable row level security;

drop policy if exists "admins automation rules" on public.automation_rules;
create policy "admins automation rules" on public.automation_rules for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());

drop policy if exists "admins automation deliveries" on public.automation_deliveries;
create policy "admins automation deliveries" on public.automation_deliveries for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());

drop policy if exists "admins automation runs" on public.automation_runs;
create policy "admins automation runs" on public.automation_runs for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());

grant select,insert,update,delete on public.automation_rules to authenticated;
grant select,insert,update,delete on public.automation_deliveries to authenticated;
grant select,insert,update,delete on public.automation_runs to authenticated;

-- Default rules. ON CONFLICT DO NOTHING intentionally preserves future Admin choices.
insert into public.automation_rules
(rule_key,name,description,category,trigger_type,enabled,audience,in_app_enabled,email_enabled,lead_minutes,config)
values
('appointment_24h','Appointment reminder · 24 hours','Remind the client one day before a scheduled/confirmed VMS service.','scheduling','scheduled',true,'client',true,true,1440,'{"window_minutes":90}'::jsonb),
('invoice_due_3d','Invoice due soon · 3 days','Remind the client three days before an open invoice is due.','billing','scheduled',true,'client',true,true,4320,'{"window_minutes":90}'::jsonb),
('invoice_overdue','Invoice overdue','Alert the client and VMS when an invoice becomes overdue.','billing','scheduled',true,'both',true,true,null,'{}'::jsonb),
('payment_failed','Payment failed','Alert the client and VMS after Stripe reports an invoice payment failure.','billing','scheduled',true,'both',true,true,null,'{"lookback_days":7}'::jsonb),
('renewal_3d','Subscription renewal · 3 days','Notify the client three days before an active subscription renews.','billing','scheduled',true,'client',true,true,4320,'{"window_minutes":90}'::jsonb),
('abandoned_checkout_2h','Abandoned checkout · 2 hours','Follow up when a VMS checkout remains open for at least two hours.','billing','scheduled',true,'client',true,true,120,'{"lookback_days":7}'::jsonb),
('onboarding_due_24h','Onboarding item due','Remind the client and VMS when a required onboarding item is due within 24 hours or overdue.','onboarding','scheduled',true,'both',true,true,1440,'{}'::jsonb),
('project_ready','Project/service ready','Notify the client when a VMS job reaches Ready status.','project','scheduled',true,'client',true,true,null,'{}'::jsonb),
('booking_request_admin','New booking request','Alert VMS when a client submits a new booking request.','scheduling','scheduled',true,'admin',true,true,null,'{}'::jsonb),
('reschedule_request_admin','Reschedule request','Alert VMS when a client asks to reschedule.','scheduling','scheduled',true,'admin',true,true,null,'{}'::jsonb),
('cancellation_request_admin','Cancellation request','Alert VMS when a client asks to cancel a scheduled service.','scheduling','scheduled',true,'admin',true,true,null,'{}'::jsonb),
('subscription_cancel_request_admin','Subscription cancellation request','Email VMS when a client requests subscription cancellation from the Portal.','billing','scheduled',true,'admin',false,true,null,'{"lookback_days":30}'::jsonb),
('subscription_pause_request_admin','Subscription pause request','Email VMS when a client requests a subscription pause from the Portal.','billing','scheduled',true,'admin',false,true,null,'{"lookback_days":30}'::jsonb),
('files_ready','Files ready','Send a client-facing delivery alert when finished files/assets are ready.','files','event',true,'client',true,true,null,'{}'::jsonb),
('project_update','Project update','Send a client-facing project update from VMS Admin.','project','event',true,'client',true,true,null,'{}'::jsonb),
('onboarding_welcome','Welcome / onboarding message','Send a welcome or onboarding update to a client.','onboarding','event',true,'client',true,true,null,'{}'::jsonb)
on conflict (rule_key) do nothing;
