-- Master Phase 10: production hardening without changing business behavior.

-- QR tables are server-written through service credentials. Give authenticated
-- Admins and clients read-only visibility through RLS; anonymous access stays blocked.
drop policy if exists "authenticated qr codes read" on public.qr_codes;
create policy "authenticated qr codes read"
on public.qr_codes for select to authenticated
using (
  private.is_vms_admin()
  or exists (
    select 1 from public.clients c
    where c.id = qr_codes.client_id
      and lower(c.owner_email) = lower(coalesce(((select auth.jwt())->>'email'),''))
  )
);

drop policy if exists "authenticated qr scans read" on public.qr_scan_events;
create policy "authenticated qr scans read"
on public.qr_scan_events for select to authenticated
using (
  private.is_vms_admin()
  or exists (
    select 1 from public.clients c
    where c.id = qr_scan_events.client_id
      and lower(c.owner_email) = lower(coalesce(((select auth.jwt())->>'email'),''))
  )
);

-- Cover foreign keys reported by the Supabase performance advisor.
create index if not exists activity_events_client_id_idx on public.activity_events(client_id);
create index if not exists audit_records_client_id_idx on public.audit_records(client_id);
create index if not exists automation_deliveries_rule_key_idx on public.automation_deliveries(rule_key);
create index if not exists automation_event_queue_rule_key_idx on public.automation_event_queue(rule_key);
create index if not exists availability_rules_catalog_service_id_idx on public.availability_rules(catalog_service_id);
create index if not exists booking_requests_catalog_service_id_idx on public.booking_requests(catalog_service_id);
create index if not exists booking_requests_job_id_idx on public.booking_requests(job_id);
create index if not exists client_services_catalog_service_id_idx on public.client_services(catalog_service_id);
create index if not exists service_jobs_catalog_service_id_idx on public.service_jobs(catalog_service_id);

-- RLS init-plan hardening: preserve the exact access rules while evaluating the
-- current JWT/user once per statement rather than once per row.
drop policy if exists "clients see self" on public.clients;
create policy "clients see self" on public.clients for select to authenticated
using (lower(owner_email)=lower(coalesce(((select auth.jwt())->>'email'),'')));

drop policy if exists "clients see services" on public.client_services;
create policy "clients see services" on public.client_services for select to authenticated
using (exists (
  select 1 from public.clients c
  where c.id=client_services.client_id
    and lower(c.owner_email)=lower(coalesce(((select auth.jwt())->>'email'),''))
));

drop policy if exists "clients audits" on public.audit_records;
create policy "clients audits" on public.audit_records for select to authenticated
using (exists (
  select 1 from public.clients c
  where c.id=audit_records.client_id
    and lower(c.owner_email)=lower(coalesce(((select auth.jwt())->>'email'),''))
));

drop policy if exists "clients activity" on public.activity_events;
create policy "clients activity" on public.activity_events for select to authenticated
using (exists (
  select 1 from public.clients c
  where c.id=activity_events.client_id
    and lower(c.owner_email)=lower(coalesce(((select auth.jwt())->>'email'),''))
));

drop policy if exists "clients insert own activity" on public.activity_events;
create policy "clients insert own activity" on public.activity_events for insert to authenticated
with check (
  client_id is not null and exists (
    select 1 from public.clients c
    where c.id=activity_events.client_id
      and lower(c.owner_email)=lower(coalesce(((select auth.jwt())->>'email'),''))
  )
);

drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles for select to authenticated
using (id=(select auth.uid()) or private.is_vms_admin());

drop policy if exists "linkhub owners select own" on public.linkhub_pages;
create policy "linkhub owners select own" on public.linkhub_pages for select to authenticated
using (exists (
  select 1 from public.clients c
  where c.id=linkhub_pages.client_id
    and lower(c.owner_email)=lower(coalesce(((select auth.jwt())->>'email'),''))
));

drop policy if exists "linkhub owners insert own" on public.linkhub_pages;
create policy "linkhub owners insert own" on public.linkhub_pages for insert to authenticated
with check (exists (
  select 1 from public.clients c
  where c.id=linkhub_pages.client_id
    and lower(c.owner_email)=lower(coalesce(((select auth.jwt())->>'email'),''))
));

drop policy if exists "linkhub owners update own" on public.linkhub_pages;
create policy "linkhub owners update own" on public.linkhub_pages for update to authenticated
using (exists (
  select 1 from public.clients c
  where c.id=linkhub_pages.client_id
    and lower(c.owner_email)=lower(coalesce(((select auth.jwt())->>'email'),''))
))
with check (exists (
  select 1 from public.clients c
  where c.id=linkhub_pages.client_id
    and lower(c.owner_email)=lower(coalesce(((select auth.jwt())->>'email'),''))
));

drop policy if exists "clients see billing subscriptions" on public.billing_subscriptions;
create policy "clients see billing subscriptions" on public.billing_subscriptions for select to authenticated
using (exists (
  select 1 from public.clients c
  where c.id=billing_subscriptions.client_id
    and lower(c.owner_email)=lower(coalesce(((select auth.jwt())->>'email'),''))
));

drop policy if exists "clients see billing invoices" on public.billing_invoices;
create policy "clients see billing invoices" on public.billing_invoices for select to authenticated
using (exists (
  select 1 from public.clients c
  where c.id=billing_invoices.client_id
    and lower(c.owner_email)=lower(coalesce(((select auth.jwt())->>'email'),''))
));

drop policy if exists "clients see billing customer" on public.billing_customers;
create policy "clients see billing customer" on public.billing_customers for select to authenticated
using (exists (
  select 1 from public.clients c
  where c.id=billing_customers.client_id
    and lower(c.owner_email)=lower(coalesce(((select auth.jwt())->>'email'),''))
));

drop policy if exists "clients see billing checkout" on public.billing_checkout_sessions;
create policy "clients see billing checkout" on public.billing_checkout_sessions for select to authenticated
using (exists (
  select 1 from public.clients c
  where c.id=billing_checkout_sessions.client_id
    and lower(c.owner_email)=lower(coalesce(((select auth.jwt())->>'email'),''))
));

drop policy if exists "clients own workspace state" on public.workspace_state;
create policy "clients own workspace state" on public.workspace_state for all to authenticated
using (
  scope=('client:'||lower(coalesce(((select auth.jwt())->>'email'),'')))
  and lower(coalesce(owner_email,''))=lower(coalesce(((select auth.jwt())->>'email'),''))
)
with check (
  scope=('client:'||lower(coalesce(((select auth.jwt())->>'email'),'')))
  and lower(coalesce(owner_email,''))=lower(coalesce(((select auth.jwt())->>'email'),''))
);
