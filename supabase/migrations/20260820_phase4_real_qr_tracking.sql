-- VMS Phase 4 real QR tracking schema.
-- Already applied to the production Supabase project. Keep in GitHub for source-control history.
create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  code text not null unique,
  name text not null,
  business_name text,
  qr_type text not null default 'website',
  destination text not null,
  mode text not null default 'static',
  status text not null default 'active',
  cta text,
  qr_color text not null default '#003049',
  bg_color text not null default '#FFFFFF',
  frame_style text not null default 'rounded',
  logo_data text,
  scan_count bigint not null default 0,
  last_scanned_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_codes_code_check check (code = lower(code) and code ~ '^[a-z0-9]{8,24}$'),
  constraint qr_codes_mode_check check (mode in ('static','dynamic')),
  constraint qr_codes_status_check check (status in ('active','suspended','archived')),
  constraint qr_codes_type_check check (qr_type in ('website','review','booking','menu','linkhub','social','custom','wifi'))
);
create table if not exists public.qr_scan_events (
  id uuid primary key default gen_random_uuid(),
  qr_id uuid not null references public.qr_codes(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  scanned_at timestamptz not null default now(),
  device_type text,
  user_agent text,
  referrer text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists qr_codes_client_idx on public.qr_codes(client_id,created_at desc);
create index if not exists qr_scan_events_qr_idx on public.qr_scan_events(qr_id,scanned_at desc);
create index if not exists qr_scan_events_client_idx on public.qr_scan_events(client_id,scanned_at desc);
create or replace function public.vms_qr_scan_counter()
returns trigger language plpgsql set search_path='' as $$
begin
  update public.qr_codes set scan_count=scan_count+1,last_scanned_at=new.scanned_at where id=new.qr_id;
  return new;
end;$$;
drop trigger if exists trg_vms_qr_scan_counter on public.qr_scan_events;
create trigger trg_vms_qr_scan_counter after insert on public.qr_scan_events for each row execute function public.vms_qr_scan_counter();
alter table public.qr_codes enable row level security;
alter table public.qr_scan_events enable row level security;
