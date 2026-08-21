-- VMS Final Polish Phase 5: revocable client-facing Audit report links.
create table if not exists public.audit_report_links (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid null references public.audit_records(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,
  token_hash text not null unique,
  business_name text not null default 'Business Checkup',
  report_data jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','revoked')),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  last_viewed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audit_report_links_status_expiry_idx on public.audit_report_links(status,expires_at);
alter table public.audit_report_links enable row level security;

drop policy if exists "admins audit report links" on public.audit_report_links;
create policy "admins audit report links"
on public.audit_report_links
for all
to authenticated
using (private.is_vms_admin())
with check (private.is_vms_admin());

revoke all on table public.audit_report_links from anon;
grant select,insert,update,delete on table public.audit_report_links to authenticated;
