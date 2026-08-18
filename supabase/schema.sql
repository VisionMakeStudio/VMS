-- Vision Make Studio production Supabase schema
-- Run once in Supabase SQL Editor. Re-running is safe.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'client' check (role in ('admin','client')),
  created_at timestamptz not null default now()
);

-- Create a public profile automatically for every Supabase Auth user.
create or replace function public.handle_new_vms_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,role) values(new.id,lower(coalesce(new.email,'')),'client')
  on conflict(id) do update set email=excluded.email;
  return new;
end; $$;
drop trigger if exists on_vms_auth_user_created on auth.users;
create trigger on_vms_auth_user_created after insert or update of email on auth.users
for each row execute procedure public.handle_new_vms_user();

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  owner_email text not null,
  contact_name text, phone text, status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.service_catalog (
  id text primary key, name text not null, kind text not null default 'service', category text not null default 'General',
  icon text default 'VMS', status text not null default 'Draft', featured boolean not null default false, display_order integer not null default 999,
  description text not null default '', pricing_model text not null default 'Quote Only', one_time_price numeric(10,2), recurring_price numeric(10,2), cadence text, starting_at boolean not null default false,
  sales_mode text not null default 'Request First', website_visible boolean not null default false, portal_visible boolean not null default false, promo_eligible boolean not null default false,
  features jsonb not null default '[]'::jsonb, included jsonb not null default '[]'::jsonb, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.client_services (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete cascade,
  service_key text not null, service_name text not null, service_status text not null default 'active', billing_status text not null default 'active',
  catalog_service_id text references public.service_catalog(id) on delete set null, agreed_price numeric(10,2), billing_cadence text, price_locked boolean not null default true,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
alter table public.client_services add column if not exists catalog_service_id text references public.service_catalog(id) on delete set null;
alter table public.client_services add column if not exists agreed_price numeric(10,2);
alter table public.client_services add column if not exists billing_cadence text;
alter table public.client_services add column if not exists price_locked boolean not null default true;

create table if not exists public.intake_requests (
  id uuid primary key default gen_random_uuid(), business_name text not null, contact_name text, email text not null, phone text, website text, goal text, contact_method text, message text,
  status text not null default 'new', source text, created_at timestamptz not null default now()
);
create table if not exists public.audit_records (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id) on delete cascade, business_name text, status text default 'draft', scores jsonb default '{}'::jsonb, findings jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id) on delete cascade, event_type text not null, title text not null, detail text, needs_action boolean default false, resolved boolean default false, created_at timestamptz default now()
);

create or replace function public.is_vms_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin');
$$;



-- Cross-device persistence bridge for the legacy VMS Admin / Client Portal tools.
create table if not exists public.workspace_state (
  scope text not null,
  state_key text not null,
  payload jsonb not null default '{}'::jsonb,
  owner_email text,
  updated_at timestamptz not null default now(),
  primary key (scope,state_key)
);

alter table public.workspace_state enable row level security;
drop policy if exists "admins workspace state" on public.workspace_state;
create policy "admins workspace state" on public.workspace_state for all to authenticated
  using (public.is_vms_admin()) with check (public.is_vms_admin());
drop policy if exists "clients own workspace state" on public.workspace_state;
create policy "clients own workspace state" on public.workspace_state for all to authenticated
  using (scope='client:'||lower(coalesce(auth.jwt()->>'email','')) and lower(coalesce(owner_email,''))=lower(coalesce(auth.jwt()->>'email','')))
  with check (scope='client:'||lower(coalesce(auth.jwt()->>'email','')) and lower(coalesce(owner_email,''))=lower(coalesce(auth.jwt()->>'email','')));
grant select,insert,update,delete on public.workspace_state to authenticated;

-- Private VMS client file storage. The bucket is private; access follows the path prefix.
insert into storage.buckets (id,name,public,file_size_limit) values ('vms-client-files','vms-client-files',false,52428800)
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit;

drop policy if exists "admins manage vms files" on storage.objects;
create policy "admins manage vms files" on storage.objects for all to authenticated
  using (bucket_id='vms-client-files' and public.is_vms_admin())
  with check (bucket_id='vms-client-files' and public.is_vms_admin());
drop policy if exists "clients manage own vms files" on storage.objects;
create policy "clients manage own vms files" on storage.objects for all to authenticated
  using (bucket_id='vms-client-files' and (storage.foldername(name))[1]=lower(coalesce(auth.jwt()->>'email','')))
  with check (bucket_id='vms-client-files' and (storage.foldername(name))[1]=lower(coalesce(auth.jwt()->>'email','')));

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.service_catalog enable row level security;
alter table public.client_services enable row level security;
alter table public.intake_requests enable row level security;
alter table public.audit_records enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists "profiles self" on public.profiles; create policy "profiles self" on public.profiles for select using (id=auth.uid() or public.is_vms_admin());
drop policy if exists "admins clients all" on public.clients; create policy "admins clients all" on public.clients for all using (public.is_vms_admin()) with check (public.is_vms_admin());
drop policy if exists "clients see self" on public.clients; create policy "clients see self" on public.clients for select using (lower(owner_email)=lower(coalesce(auth.jwt()->>'email','')));

drop policy if exists "public published catalog" on public.service_catalog; create policy "public published catalog" on public.service_catalog for select using (status='Published' and website_visible=true);
drop policy if exists "clients portal catalog" on public.service_catalog; create policy "clients portal catalog" on public.service_catalog for select to authenticated using (status='Published' and (website_visible=true or portal_visible=true));
drop policy if exists "admins catalog all" on public.service_catalog; create policy "admins catalog all" on public.service_catalog for all to authenticated using (public.is_vms_admin()) with check (public.is_vms_admin());

drop policy if exists "admins services all" on public.client_services; create policy "admins services all" on public.client_services for all using (public.is_vms_admin()) with check (public.is_vms_admin());
drop policy if exists "clients see services" on public.client_services; create policy "clients see services" on public.client_services for select using (exists(select 1 from public.clients c where c.id=client_id and lower(c.owner_email)=lower(coalesce(auth.jwt()->>'email',''))));
drop policy if exists "admins intake" on public.intake_requests; create policy "admins intake" on public.intake_requests for all using (public.is_vms_admin()) with check (public.is_vms_admin());
drop policy if exists "admins audits" on public.audit_records; create policy "admins audits" on public.audit_records for all using (public.is_vms_admin()) with check (public.is_vms_admin());
drop policy if exists "clients audits" on public.audit_records; create policy "clients audits" on public.audit_records for select using (exists(select 1 from public.clients c where c.id=client_id and lower(c.owner_email)=lower(coalesce(auth.jwt()->>'email',''))));
drop policy if exists "admins activity" on public.activity_events; create policy "admins activity" on public.activity_events for all using (public.is_vms_admin()) with check (public.is_vms_admin());
drop policy if exists "clients activity" on public.activity_events; create policy "clients activity" on public.activity_events for select using (exists(select 1 from public.clients c where c.id=client_id and lower(c.owner_email)=lower(coalesce(auth.jwt()->>'email',''))));

grant select on public.service_catalog to anon, authenticated;
grant insert,update,delete on public.service_catalog to authenticated;
grant select on public.clients, public.client_services, public.audit_records, public.activity_events to authenticated;

-- Central VMS catalog. Admin edits overwrite these rows; public/portal read the same values.
insert into public.service_catalog (id,name,kind,category,icon,status,featured,display_order,description,pricing_model,one_time_price,recurring_price,cadence,starting_at,sales_mode,website_visible,portal_visible,promo_eligible,features,included,metadata) values
('free-business-checkup','Free Business Checkup','service','Business Review','CHK','Published',true,1,'A no-pressure starting point to identify the biggest website, visibility, review, and customer-experience opportunities.','Free',0,null,null,false,'Request First',true,true,false,'["Website and customer-path review","Local visibility opportunities","Review and trust-signal check","Clear next-step recommendations"]'::jsonb,'[]'::jsonb,'{"family":"audit"}'::jsonb),
('vms-audit','VMS Business & Website Audit','service','Business Review','AUD','Published',false,2,'A deeper VMS audit with category scores, findings, evidence, and prioritized recommendations.','One-Time',99,null,null,false,'Request First',true,true,true,'["Website, local presence, reviews, and systems","AI-assisted preliminary findings for VMS review","Prioritized recommendations","Client-ready audit report"]'::jsonb,'[]'::jsonb,'{"family":"audit"}'::jsonb),
('website-revamp','Website Refresh / Revamp','service','Websites','WEB','Published',true,10,'Modernize an existing website with clearer messaging, stronger calls-to-action, and a cleaner mobile experience.','One-Time',599,null,null,true,'Request First',true,true,true,'["Responsive desktop + mobile redesign","Customer journey and CTA cleanup","Content and visual refinement","Launch support and revisions"]'::jsonb,'[]'::jsonb,'{"family":"website"}'::jsonb),
('new-business-website','New Business Website','service','Websites','SITE','Published',false,11,'A polished new website for a business that needs a professional home online from the ground up.','One-Time',899,null,null,true,'Request First',true,true,true,'["Responsive website build","Core business pages and calls-to-action","Contact / lead pathway","Launch support"]'::jsonb,'[]'::jsonb,'{"family":"website"}'::jsonb),
('website-care','Monthly Website Care','subscription','Websites','CARE','Published',true,12,'Ongoing content changes, small updates, and support for a VMS-managed website.','Recurring',null,49,'Monthly',false,'Request First',true,true,true,'["Content and image changes","Small page/section updates","Routine maintenance","VMS support requests"]'::jsonb,'[]'::jsonb,'{"family":"website"}'::jsonb),
('local-presence-setup','Local Presence Setup','service','Local Growth','LOCAL','Published',true,20,'Clean up and strengthen how your business information appears across important local platforms.','One-Time',149,null,null,false,'Request First',true,true,true,'["Business information consistency","Google-focused visibility review","Hours, links, and category cleanup","Local presence recommendations"]'::jsonb,'[]'::jsonb,'{"family":"local"}'::jsonb),
('local-presence-care','Local Presence Care','subscription','Local Growth','LOCAL+','Published',false,21,'Ongoing monitoring and updates for core business information and local visibility signals.','Recurring',null,29,'Monthly',false,'Request First',true,true,true,'["Listing monitoring","Business info corrections","Hours/link updates","Visibility recommendations"]'::jsonb,'[]'::jsonb,'{"family":"local"}'::jsonb),
('review-growth','Review Growth','subscription','Reputation','REV','Published',true,30,'A practical system for consistently making it easier for happy customers to leave reviews.','Recurring',null,39,'Monthly',false,'Request First',true,true,true,'["Review pathways and calls-to-action","QR / LinkHub review routes","Review-growth workflow","Ongoing recommendations"]'::jsonb,'[]'::jsonb,'{"family":"reviews"}'::jsonb),
('smart-qr','VMS Smart QR','service','QR & Growth','QR','Published',true,40,'A branded QR for the destination your business needs. The standard one-time version is ideal when ongoing scan analytics are not required.','One-Time',14.99,null,null,true,'Buy Now',true,true,true,'["Branded QR artwork","Website, reviews, booking, social, and custom destinations","Print-ready export","No monthly fee for the standard version"]'::jsonb,'[]'::jsonb,'{"family":"qr","analyticsIncluded":false}'::jsonb),
('linkhub-core','VMS LinkHub Core','service','LinkHub','LH','Published',true,50,'A polished digital business card with your profile, contact actions, links, social icons, colors, and Visit Us page.','One-Time',19.99,null,null,false,'Buy Now',true,true,true,'["Business profile and contact actions","Custom links and social icons","Theme and brand colors","Visit Us / Directions page","QR code to your LinkHub"]'::jsonb,'[]'::jsonb,'{"family":"linkhub","plan":"core"}'::jsonb),
('linkhub-wifi','LinkHub Wi‑Fi Feature','addon','LinkHub','WIFI','Published',false,51,'Add the LinkHub Wi‑Fi screen with network name, security, password controls, copy action, and connection instructions.','One-Time',6.99,null,null,false,'Buy Now',true,true,true,'["SSID and security type","Masked password with show/hide","Copy Password","Connection instructions"]'::jsonb,'[]'::jsonb,'{"family":"linkhub","requires":"linkhub-core"}'::jsonb),
('linkhub-menu','LinkHub Restaurant Menu','addon','LinkHub','MENU','Published',false,52,'Add a branded restaurant profile and digital menu directly inside the LinkHub experience.','One-Time',49.99,null,null,false,'Buy Now',true,true,true,'["Restaurant information header","Menu categories and items","Hours, phone, website, maps","Order / reservation / contact actions"]'::jsonb,'[]'::jsonb,'{"family":"linkhub","requires":"linkhub-core"}'::jsonb),
('linkhub-pro','VMS LinkHub Pro','subscription','LinkHub','LH+','Published',true,53,'The complete managed LinkHub membership with premium features, analytics, and ongoing control from the Client Portal.','Recurring',null,14.99,'Monthly',false,'Buy Now',true,true,true,'["Everything in LinkHub Core","Restaurant Menu included","Wi‑Fi feature included","Smart Scan Activity","LinkHub views and click analytics","Dynamic management and ongoing updates","Client Portal management"]'::jsonb,'["VMS LinkHub Core","LinkHub Wi‑Fi Feature","LinkHub Restaurant Menu","Smart Scan Activity"]'::jsonb,'{"family":"linkhub","plan":"pro","analyticsIncluded":true}'::jsonb),
('linkhub-done-for-you','LinkHub Done-for-You Build','addon','LinkHub','DFY','Published',false,54,'Optional hands-on VMS buildout for a client who wants VMS to configure and polish the LinkHub for them.','One-Time',49,null,null,false,'Request First',false,true,true,'["Profile setup","Link organization","Theme/brand styling","VMS-managed initial build"]'::jsonb,'[]'::jsonb,'{"family":"linkhub","optionalLabor":true}'::jsonb),
('vision-starter','Vision Starter','package','Packages','START','Published',true,70,'An affordable digital-foundation package for an existing local business that wants a cleaner, more professional presence.','One-Time',249,null,null,false,'Request First',true,true,true,'["VMS Business & Website Audit","Local Presence Setup","VMS Smart QR","VMS LinkHub Core","First 3 months of LinkHub Pro"]'::jsonb,'["VMS Business & Website Audit","Local Presence Setup","VMS Smart QR","VMS LinkHub Core","3 months VMS LinkHub Pro"]'::jsonb,'{"family":"package","activationFeeWaived":true}'::jsonb),
('website-refresh-package','Website Refresh Package','package','Packages','REFRESH','Published',true,71,'Refresh the website and the surrounding digital presence together instead of treating them as separate projects.','One-Time',749,null,null,false,'Request First',true,true,true,'["Website Refresh / Revamp","VMS Business & Website Audit","Local Presence Setup","VMS LinkHub Core"]'::jsonb,'["Website Refresh / Revamp","VMS Business & Website Audit","Local Presence Setup","VMS LinkHub Core"]'::jsonb,'{"family":"package","activationFeeWaived":true}'::jsonb),
('business-launch','VMS Business Launch','package','Packages','LAUNCH','Published',true,72,'A polished launch package for a business that needs a website plus the essential digital tools around it.','One-Time',999,null,null,false,'Request First',true,true,true,'["New Business Website","Local Presence Setup","VMS Smart QR","VMS LinkHub Core","First 3 months of LinkHub Pro"]'::jsonb,'["New Business Website","Local Presence Setup","VMS Smart QR","VMS LinkHub Core","3 months VMS LinkHub Pro"]'::jsonb,'{"family":"package","activationFeeWaived":true}'::jsonb),
('digital-presence','VMS Digital Presence','subscription','Bundles','DP','Published',true,80,'A simple monthly bundle for businesses that want local visibility, review growth, and a fully managed LinkHub.','Recurring',null,59,'Monthly',false,'Request First',true,true,true,'["Local Presence Care","Review Growth","VMS LinkHub Pro"]'::jsonb,'["Local Presence Care","Review Growth","VMS LinkHub Pro"]'::jsonb,'{"family":"bundle","activationFeeWaived":true}'::jsonb),
('growth-care','VMS Growth Care','subscription','Bundles','GROW','Published',true,81,'The ongoing VMS bundle for a business that wants website care plus local, review, and LinkHub management.','Recurring',null,99,'Monthly',false,'Request First',true,true,true,'["Everything in Digital Presence","Monthly Website Care","Priority content updates","Periodic VMS digital checkups"]'::jsonb,'["Monthly Website Care","Local Presence Care","Review Growth","VMS LinkHub Pro"]'::jsonb,'{"family":"bundle","activationFeeWaived":true,"recommended":true}'::jsonb),
('vms-activation-fee','VMS Activation Fee','internal','Billing','FEE','Published',false,999,'One-time activation line item applied only to a client’s first paid standalone order. Waived for VMS packages and bundles.','One-Time',4.99,null,null,false,'Internal',false,false,false,'[]'::jsonb,'[]'::jsonb,'{"firstPaidOrderOnly":true,"waivedForBundles":true}'::jsonb)
on conflict (id) do update set
  name=excluded.name,kind=excluded.kind,category=excluded.category,icon=excluded.icon,status=excluded.status,featured=excluded.featured,display_order=excluded.display_order,description=excluded.description,pricing_model=excluded.pricing_model,one_time_price=excluded.one_time_price,recurring_price=excluded.recurring_price,cadence=excluded.cadence,starting_at=excluded.starting_at,sales_mode=excluded.sales_mode,website_visible=excluded.website_visible,portal_visible=excluded.portal_visible,promo_eligible=excluded.promo_eligible,features=excluded.features,included=excluded.included,metadata=excluded.metadata,updated_at=now();

-- Intentional VMS test client for evaluating the Client Portal.
insert into public.clients (business_name,owner_email,contact_name,status)
select 'VMS Test Client','info@visionmakestudio.com','VMS Test Client','active'
where not exists(select 1 from public.clients where lower(owner_email)='info@visionmakestudio.com');

insert into public.client_services(client_id,service_key,service_name,service_status,billing_status,catalog_service_id,agreed_price,billing_cadence,price_locked,metadata)
select c.id,v.k,v.n,'active','test',v.k,v.p,v.c,true,v.m::jsonb
from public.clients c cross join (values
 ('website-revamp','Website Refresh / Revamp',599::numeric,null::text,'{"testAccess":true}'),
 ('website-care','Monthly Website Care',49::numeric,'Monthly','{"testAccess":true}'),
 ('smart-qr','VMS Smart QR',14.99::numeric,null,'{"testAccess":true,"analyticsIncluded":false}'),
 ('linkhub-pro','VMS LinkHub Pro',14.99::numeric,'Monthly','{"testAccess":true,"plan":"Pro","wifiIncluded":true,"menuIncluded":true,"smartScanActivity":true}'),
 ('vms-audit','VMS Business & Website Audit',99::numeric,null,'{"testAccess":true}'),
 ('local-presence-setup','Local Presence Setup',149::numeric,null,'{"testAccess":true}'),
 ('local-presence-care','Local Presence Care',29::numeric,'Monthly','{"testAccess":true}'),
 ('review-growth','Review Growth',39::numeric,'Monthly','{"testAccess":true}'),
 ('digital-presence','VMS Digital Presence',59::numeric,'Monthly','{"testAccess":true}'),
 ('growth-care','VMS Growth Care',99::numeric,'Monthly','{"testAccess":true}')
) v(k,n,p,c,m)
where lower(c.owner_email)='info@visionmakestudio.com'
  and not exists(select 1 from public.client_services s where s.client_id=c.id and s.service_key=v.k);

-- Promote your owner account after you sign in once. Replace the email only if your Admin login is different.
-- insert into public.profiles(id,email,role) select id,email,'admin' from auth.users where lower(email)=lower('info@visionmakestudio.com') on conflict(id) do update set email=excluded.email, role='admin';
