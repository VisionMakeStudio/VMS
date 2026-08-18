-- VMS Supabase production foundation
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'client' check (role in ('admin','client')),
  created_at timestamptz not null default now()
);
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(), business_name text not null, owner_email text not null,
  contact_name text, phone text, status text not null default 'active', created_at timestamptz not null default now()
);
create table if not exists public.client_services (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete cascade,
  service_key text not null, service_name text not null, service_status text not null default 'active', billing_status text not null default 'test', metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.intake_requests (
  id uuid primary key default gen_random_uuid(), business_name text not null, contact_name text, email text not null, phone text, website text, goal text, contact_method text, message text, status text not null default 'new', source text, created_at timestamptz not null default now()
);
create table if not exists public.audit_records (id uuid primary key default gen_random_uuid(),client_id uuid references public.clients(id) on delete cascade,business_name text,status text default 'draft',scores jsonb default '{}'::jsonb,findings jsonb default '{}'::jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
create table if not exists public.activity_events (id uuid primary key default gen_random_uuid(),client_id uuid references public.clients(id) on delete cascade,event_type text not null,title text not null,detail text,needs_action boolean default false,resolved boolean default false,created_at timestamptz default now());

alter table public.profiles enable row level security; alter table public.clients enable row level security; alter table public.client_services enable row level security; alter table public.intake_requests enable row level security; alter table public.audit_records enable row level security; alter table public.activity_events enable row level security;

create or replace function public.is_vms_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'); $$;

drop policy if exists "profiles self" on public.profiles; create policy "profiles self" on public.profiles for select using (id=auth.uid() or public.is_vms_admin());
drop policy if exists "admins clients all" on public.clients; create policy "admins clients all" on public.clients for all using (public.is_vms_admin()) with check (public.is_vms_admin());
drop policy if exists "clients see self" on public.clients; create policy "clients see self" on public.clients for select using (lower(owner_email)=lower(coalesce(auth.jwt()->>'email','')));
drop policy if exists "admins services all" on public.client_services; create policy "admins services all" on public.client_services for all using (public.is_vms_admin()) with check (public.is_vms_admin());
drop policy if exists "clients see services" on public.client_services; create policy "clients see services" on public.client_services for select using (exists(select 1 from public.clients c where c.id=client_id and lower(c.owner_email)=lower(coalesce(auth.jwt()->>'email',''))));
drop policy if exists "admins intake" on public.intake_requests; create policy "admins intake" on public.intake_requests for all using (public.is_vms_admin()) with check (public.is_vms_admin());
drop policy if exists "admins audits" on public.audit_records; create policy "admins audits" on public.audit_records for all using (public.is_vms_admin()) with check (public.is_vms_admin());
drop policy if exists "clients audits" on public.audit_records; create policy "clients audits" on public.audit_records for select using (exists(select 1 from public.clients c where c.id=client_id and lower(c.owner_email)=lower(coalesce(auth.jwt()->>'email',''))));
drop policy if exists "admins activity" on public.activity_events; create policy "admins activity" on public.activity_events for all using (public.is_vms_admin()) with check (public.is_vms_admin());
drop policy if exists "clients activity" on public.activity_events; create policy "clients activity" on public.activity_events for select using (exists(select 1 from public.clients c where c.id=client_id and lower(c.owner_email)=lower(coalesce(auth.jwt()->>'email',''))));

-- TEST CLIENT requested for evaluation: info@visionmakestudio.com
insert into public.clients (business_name,owner_email,contact_name,status)
select 'VMS Test Client','info@visionmakestudio.com','VMS Test Client','active'
where not exists(select 1 from public.clients where lower(owner_email)='info@visionmakestudio.com');
insert into public.client_services(client_id,service_key,service_name,service_status,billing_status)
select c.id,v.k,v.n,'active','test' from public.clients c cross join (values
 ('website-revamp','Website Revamp'),('website-care','Monthly Website Care'),('smart-qr','VMS Smart QR'),('linkhub','VMS LinkHub'),('vms-audit','VMS Business & Website Audit'),('local-presence','Local Presence'),('review-growth','Review Growth'),('qr-print','QR Print & Display Package')) v(k,n)
where lower(c.owner_email)='info@visionmakestudio.com' and not exists(select 1 from public.client_services s where s.client_id=c.id and s.service_key=v.k);

-- After you sign in once with your owner email, promote that auth user to admin:
-- insert into public.profiles(id,email,role) select id,email,'admin' from auth.users where lower(email)=lower('YOUR_OWNER_EMAIL') on conflict(id) do update set role='admin';
