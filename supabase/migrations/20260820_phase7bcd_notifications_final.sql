-- VMS MASTER PHASE 7B/7C/7D — Real-time event queue, notification preferences,
-- retry tracking, and database event triggers. Additive migration.

create table if not exists public.notification_preferences (
  client_id uuid primary key references public.clients(id) on delete cascade,
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  billing boolean not null default true,
  scheduling boolean not null default true,
  onboarding boolean not null default true,
  project boolean not null default true,
  files boolean not null default true,
  client boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_event_queue (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null references public.automation_rules(rule_key) on delete cascade,
  event_key text not null unique,
  client_id uuid references public.clients(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  subject text not null,
  message text not null,
  needs_action boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','retry','done','failed')),
  attempts integer not null default 0 check (attempts between 0 and 20),
  next_attempt_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists automation_event_queue_due_idx on public.automation_event_queue(status,next_attempt_at,created_at);
create index if not exists automation_event_queue_client_idx on public.automation_event_queue(client_id,created_at desc);

alter table public.automation_deliveries add column if not exists attempt_count integer not null default 0;
alter table public.automation_deliveries add column if not exists last_attempt_at timestamptz;

alter table public.notification_preferences enable row level security;
alter table public.automation_event_queue enable row level security;

drop policy if exists "admins notification preferences" on public.notification_preferences;
create policy "admins notification preferences" on public.notification_preferences for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());

drop policy if exists "clients read notification preferences" on public.notification_preferences;
create policy "clients read notification preferences" on public.notification_preferences for select to authenticated
  using (exists(select 1 from public.clients c where c.id=notification_preferences.client_id and lower(c.owner_email)=lower(coalesce((select auth.jwt())->>'email',''))));

drop policy if exists "clients update notification preferences" on public.notification_preferences;
create policy "clients update notification preferences" on public.notification_preferences for update to authenticated
  using (exists(select 1 from public.clients c where c.id=notification_preferences.client_id and lower(c.owner_email)=lower(coalesce((select auth.jwt())->>'email',''))))
  with check (exists(select 1 from public.clients c where c.id=notification_preferences.client_id and lower(c.owner_email)=lower(coalesce((select auth.jwt())->>'email',''))));

drop policy if exists "clients insert notification preferences" on public.notification_preferences;
create policy "clients insert notification preferences" on public.notification_preferences for insert to authenticated
  with check (exists(select 1 from public.clients c where c.id=notification_preferences.client_id and lower(c.owner_email)=lower(coalesce((select auth.jwt())->>'email',''))));

drop policy if exists "admins automation event queue" on public.automation_event_queue;
create policy "admins automation event queue" on public.automation_event_queue for all to authenticated
  using (private.is_vms_admin()) with check (private.is_vms_admin());

grant select,insert,update on public.notification_preferences to authenticated;
grant select,insert,update,delete on public.automation_event_queue to authenticated;

-- Convert rules that now have true event sources from hourly polling to event-driven delivery.
update public.automation_rules set trigger_type='event',updated_at=now()
where rule_key in ('payment_failed','project_ready','booking_request_admin','reschedule_request_admin','cancellation_request_admin','subscription_cancel_request_admin','subscription_pause_request_admin');

insert into public.automation_rules
(rule_key,name,description,category,trigger_type,enabled,audience,in_app_enabled,email_enabled,lead_minutes,config)
values
('booking_decision_client','Booking decision','Notify a client as soon as VMS approves or declines a booking request.','scheduling','event',true,'client',true,true,null,'{}'::jsonb),
('reschedule_decision_client','Reschedule decision','Notify a client as soon as VMS approves or declines a reschedule request.','scheduling','event',true,'client',true,true,null,'{}'::jsonb),
('cancellation_decision_client','Cancellation decision','Notify a client as soon as VMS approves or declines a cancellation request.','scheduling','event',true,'client',true,true,null,'{}'::jsonb),
('job_canceled_client','Service canceled','Notify a client when a visible VMS service job is canceled.','scheduling','event',true,'client',true,true,null,'{}'::jsonb),
('onboarding_complete','Onboarding complete','Notify a client when required VMS onboarding is complete.','onboarding','event',true,'client',true,true,null,'{}'::jsonb),
('client_files_uploaded_admin','Client files uploaded','Alert VMS when a client uploads files or requested assets.','files','event',true,'admin',true,true,null,'{}'::jsonb)
on conflict (rule_key) do nothing;

create or replace function public.vms_enqueue_automation_event(
  p_rule_key text,p_event_key text,p_client_id uuid,p_source_type text,p_source_id text,
  p_subject text,p_message text,p_needs_action boolean default false,p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.automation_event_queue(rule_key,event_key,client_id,source_type,source_id,subject,message,needs_action,metadata)
  values(p_rule_key,p_event_key,p_client_id,p_source_type,p_source_id,p_subject,p_message,coalesce(p_needs_action,false),coalesce(p_metadata,'{}'::jsonb))
  on conflict(event_key) do nothing;
end;
$$;
revoke all on function public.vms_enqueue_automation_event(text,text,uuid,text,text,text,text,boolean,jsonb) from public;

create or replace function public.vms_phase7_booking_event_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare rk text; subj text; msg text;
begin
  if tg_op='INSERT' then
    rk:=case new.request_type when 'reschedule' then 'reschedule_request_admin' when 'cancel' then 'cancellation_request_admin' else 'booking_request_admin' end;
    subj:=case new.request_type when 'reschedule' then 'Client requested a reschedule' when 'cancel' then 'Client requested a cancellation' else 'New client booking request' end;
    msg:=coalesce(new.service_name,'VMS service')||' · Admin review required.'||case when new.requested_start is not null then ' Requested start: '||to_char(new.requested_start at time zone 'America/New_York','Mon DD, YYYY HH12:MI AM') else '' end;
    perform public.vms_enqueue_automation_event(rk,'booking:'||new.id||':submitted:'||new.request_type,new.client_id,'booking_request',new.id::text,subj,msg,true,jsonb_build_object('request_type',new.request_type,'job_id',new.job_id,'requested_start',new.requested_start));
    return new;
  end if;
  if new.status is distinct from old.status and new.status in ('approved','declined') then
    rk:=case new.request_type when 'reschedule' then 'reschedule_decision_client' when 'cancel' then 'cancellation_decision_client' else 'booking_decision_client' end;
    subj:=case when new.status='approved' then case new.request_type when 'reschedule' then 'Your VMS reschedule is approved' when 'cancel' then 'Your VMS cancellation is approved' else 'Your VMS booking is confirmed' end else case new.request_type when 'reschedule' then 'VMS could not approve that reschedule' when 'cancel' then 'VMS could not approve that cancellation' else 'VMS could not approve that booking request' end end;
    msg:=coalesce(new.service_name,'VMS service')||case when new.admin_note is not null and btrim(new.admin_note)<>'' then ' · '||new.admin_note else '' end;
    perform public.vms_enqueue_automation_event(rk,'booking:'||new.id||':decision:'||new.status,new.client_id,'booking_request',new.id::text,subj,msg,false,jsonb_build_object('request_type',new.request_type,'status',new.status,'job_id',new.job_id));
  end if;
  return new;
end;
$$;
drop trigger if exists vms_phase7_booking_event on public.booking_requests;
create trigger vms_phase7_booking_event after insert or update of status on public.booking_requests for each row execute function public.vms_phase7_booking_event_trigger();

create or replace function public.vms_phase7_job_event_trigger() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status is distinct from old.status then
    if new.status='ready' and coalesce(new.client_visible,true) then
      perform public.vms_enqueue_automation_event('project_ready','job:'||new.id||':ready:'||extract(epoch from new.updated_at)::bigint,new.client_id,'service_job',new.id::text,'Your VMS project is ready',coalesce(new.title,new.service_name,'VMS project')||' is ready for you.',false,jsonb_build_object('job_id',new.id,'status',new.status));
    elsif new.status='canceled' and coalesce(new.client_visible,true) then
      perform public.vms_enqueue_automation_event('job_canceled_client','job:'||new.id||':canceled:'||extract(epoch from new.updated_at)::bigint,new.client_id,'service_job',new.id::text,'Your VMS service was canceled',coalesce(new.title,new.service_name,'VMS service')||' has been canceled.',false,jsonb_build_object('job_id',new.id,'status',new.status));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists vms_phase7_job_event on public.service_jobs;
create trigger vms_phase7_job_event after update of status on public.service_jobs for each row execute function public.vms_phase7_job_event_trigger();

create or replace function public.vms_phase7_billing_event_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare inv record;
begin
  if new.event_type='invoice.payment_failed' then
    select id,client_id,provider_invoice_id,invoice_number,amount_due,currency,hosted_invoice_url,status into inv
    from public.billing_invoices where provider_invoice_id=new.object_id order by updated_at desc limit 1;
    if inv.client_id is not null then
      perform public.vms_enqueue_automation_event('payment_failed','billing:'||new.provider_event_id,inv.client_id,'billing_event',new.provider_event_id,'VMS payment failed','A payment attempt'||case when inv.invoice_number is not null then ' for invoice '||inv.invoice_number else '' end||' did not go through. Please review your billing information.',true,jsonb_build_object('provider_invoice_id',inv.provider_invoice_id,'invoice_id',inv.id,'invoice_url',inv.hosted_invoice_url));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists vms_phase7_billing_event on public.billing_events;
create trigger vms_phase7_billing_event after insert on public.billing_events for each row execute function public.vms_phase7_billing_event_trigger();

create or replace function public.vms_phase7_onboarding_event_trigger() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if (tg_op='INSERT' and new.portal_invited_at is not null) or (tg_op='UPDATE' and new.portal_invited_at is not null and old.portal_invited_at is null) then
    perform public.vms_enqueue_automation_event('onboarding_welcome','onboarding:'||new.client_id||':welcome:'||extract(epoch from new.portal_invited_at)::bigint,new.client_id,'client_onboarding',new.client_id::text,'Welcome to your VMS Client Portal','Your VMS account is ready. Open your Portal to review onboarding items, services, scheduling, files, and billing.',false,jsonb_build_object('portal_invited_at',new.portal_invited_at));
  end if;
  if (tg_op='UPDATE' and new.status='complete' and old.status is distinct from new.status) or (tg_op='INSERT' and new.status='complete') then
    perform public.vms_enqueue_automation_event('onboarding_complete','onboarding:'||new.client_id||':complete:'||extract(epoch from coalesce(new.completed_at,now()))::bigint,new.client_id,'client_onboarding',new.client_id::text,'Your VMS onboarding is complete','Your required VMS onboarding steps are complete. You can continue managing services, scheduling, files, and billing from your Portal.',false,jsonb_build_object('status',new.status,'completed_at',new.completed_at));
  end if;
  return new;
end;
$$;
drop trigger if exists vms_phase7_onboarding_event on public.client_onboarding;
create trigger vms_phase7_onboarding_event after insert or update of status,portal_invited_at on public.client_onboarding for each row execute function public.vms_phase7_onboarding_event_trigger();

create or replace function public.vms_phase7_activity_event_trigger() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.event_type='subscription_cancel_requested' then
    perform public.vms_enqueue_automation_event('subscription_cancel_request_admin','activity:'||new.id,new.client_id,'activity_event',new.id::text,'Subscription cancellation requested',coalesce(new.detail,'A client requested subscription cancellation.'),true,jsonb_build_object('activity_event_id',new.id));
  elsif new.event_type='subscription_pause_requested' then
    perform public.vms_enqueue_automation_event('subscription_pause_request_admin','activity:'||new.id,new.client_id,'activity_event',new.id::text,'Subscription pause requested',coalesce(new.detail,'A client requested a subscription pause.'),true,jsonb_build_object('activity_event_id',new.id));
  elsif new.event_type in ('client_files_uploaded','client_requested_files_uploaded') then
    perform public.vms_enqueue_automation_event('client_files_uploaded_admin','activity:'||new.id,new.client_id,'activity_event',new.id::text,'Client files uploaded',coalesce(new.detail,'A client uploaded files in the VMS Portal.'),true,jsonb_build_object('activity_event_id',new.id,'event_type',new.event_type));
  end if;
  return new;
end;
$$;
drop trigger if exists vms_phase7_activity_event on public.activity_events;
create trigger vms_phase7_activity_event after insert on public.activity_events for each row execute function public.vms_phase7_activity_event_trigger();
