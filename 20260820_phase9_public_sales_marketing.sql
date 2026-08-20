-- VMS MASTER PHASE 9 — Public Website / Sales Optimization
-- Real public promotions + portfolio/testimonial content. Additive migration.

create table if not exists public.public_promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  description text,
  discount_type text not null default 'percent' check (discount_type in ('percent','amount','custom')),
  discount_value numeric(12,2),
  service_ids text[] not null default '{}'::text[],
  public_visible boolean not null default false,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  terms text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists public_promotions_code_lower_idx on public.public_promotions (lower(code)) where code is not null and btrim(code)<>'';
create index if not exists public_promotions_public_idx on public.public_promotions(status,public_visible,starts_at,ends_at);

create table if not exists public.marketing_content (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('portfolio','testimonial')),
  title text not null,
  body text,
  attribution_name text,
  attribution_company text,
  image_url text,
  link_url text,
  service_ids text[] not null default '{}'::text[],
  featured boolean not null default false,
  display_order integer not null default 100,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_content_public_idx on public.marketing_content(content_type,status,featured,display_order,published_at);

alter table public.public_promotions enable row level security;
alter table public.marketing_content enable row level security;

drop policy if exists "admins manage public promotions" on public.public_promotions;
create policy "admins manage public promotions" on public.public_promotions for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());

drop policy if exists "admins manage marketing content" on public.marketing_content;
create policy "admins manage marketing content" on public.marketing_content for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());

grant select,insert,update,delete on public.public_promotions to authenticated;
grant select,insert,update,delete on public.marketing_content to authenticated;
