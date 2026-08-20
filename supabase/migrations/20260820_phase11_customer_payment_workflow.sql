-- VMS Phase 11: customer -> payment -> activation workflow repair

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  client_service_id uuid references public.client_services(id) on delete set null,
  invoice_id uuid references public.billing_invoices(id) on delete set null,
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  provider text not null default 'manual',
  provider_payment_id text,
  amount numeric not null default 0,
  currency text not null default 'USD',
  status text not null default 'paid' check (status in ('pending','paid','failed','refunded','void')),
  method text,
  description text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_payments_provider_payment_uidx
  on public.billing_payments(provider, provider_payment_id)
  where provider_payment_id is not null;
create index if not exists billing_payments_client_idx on public.billing_payments(client_id, created_at desc);
create index if not exists billing_payments_client_service_idx on public.billing_payments(client_service_id);
create index if not exists billing_payments_invoice_idx on public.billing_payments(invoice_id);
create index if not exists billing_payments_subscription_idx on public.billing_payments(subscription_id);

alter table public.billing_payments enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='billing_payments' and policyname='billing_payments_client_read'
  ) then
    execute $p$create policy billing_payments_client_read on public.billing_payments
      for select to authenticated
      using (exists (select 1 from public.clients c where c.id = billing_payments.client_id and lower(c.owner_email) = lower(coalesce(auth.jwt()->>'email',''))))$p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='billing_payments' and policyname='billing_payments_admin_read'
  ) then
    execute $p$create policy billing_payments_admin_read on public.billing_payments
      for select to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin'))$p$;
  end if;
end $$;

alter table public.billing_invoices
  add column if not exists client_service_id uuid references public.client_services(id) on delete set null,
  add column if not exists service_key text;
create index if not exists billing_invoices_client_service_idx on public.billing_invoices(client_service_id);
create index if not exists billing_invoices_service_key_idx on public.billing_invoices(client_id, service_key);

-- Repair legacy CRM conversions that incorrectly activated paid services before payment.
update public.client_services cs
set service_status='pending',
    billing_status='awaiting_payment',
    metadata = coalesce(cs.metadata,'{}'::jsonb) || jsonb_build_object('payment_required',true,'phase11_repaired',true),
    updated_at=now()
from public.service_catalog sc
where coalesce(cs.catalog_service_id,cs.service_key)=sc.id
  and coalesce(cs.metadata->>'source','')='phase5-lead-conversion'
  and lower(coalesce(sc.pricing_model,'')) <> 'free'
  and not exists (
    select 1 from public.billing_subscriptions bs
    where bs.client_service_id=cs.id and bs.status in ('active','trialing')
  )
  and not exists (
    select 1 from public.billing_invoices bi
    where bi.client_id=cs.client_id and bi.status='paid'
      and coalesce(bi.service_key,bi.metadata->>'service_key')=coalesce(cs.catalog_service_id,cs.service_key)
  );

update public.client_services cs
set service_status='active',
    billing_status='active',
    metadata = coalesce(cs.metadata,'{}'::jsonb) || jsonb_build_object('payment_required',false,'phase11_repaired',true),
    updated_at=now()
from public.service_catalog sc
where coalesce(cs.catalog_service_id,cs.service_key)=sc.id
  and coalesce(cs.metadata->>'source','')='phase5-lead-conversion'
  and lower(coalesce(sc.pricing_model,''))='free';

insert into public.automation_rules
  (rule_key,name,description,category,trigger_type,enabled,audience,in_app_enabled,email_enabled,lead_minutes,config,updated_at)
values
  ('new_lead_admin','New website lead','Email VMS when a new public inquiry is saved.','client','event',true,'admin',false,true,null,'{}'::jsonb,now()),
  ('payment_received','Payment received','Confirm successful payment to the client and VMS Admin.','billing','event',true,'both',true,true,null,'{}'::jsonb,now()),
  ('invoice_ready','Invoice ready','Send the client a VMS invoice/payment link.','billing','event',true,'client',true,true,null,'{}'::jsonb,now()),
  ('payment_request','Payment request','Tell the client a service is approved and ready for payment in the Portal.','billing','event',true,'client',true,true,null,'{}'::jsonb,now())
on conflict (rule_key) do update set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category,
  trigger_type=excluded.trigger_type,
  enabled=excluded.enabled,
  audience=excluded.audience,
  in_app_enabled=excluded.in_app_enabled,
  email_enabled=excluded.email_enabled,
  lead_minutes=excluded.lead_minutes,
  config=excluded.config,
  updated_at=now();
