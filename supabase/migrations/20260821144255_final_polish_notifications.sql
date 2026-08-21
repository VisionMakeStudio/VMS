insert into public.automation_rules
  (rule_key,name,description,category,trigger_type,enabled,audience,in_app_enabled,email_enabled,config,updated_at)
values
  ('job_scheduled_client','Appointment scheduled','Send the client an in-app and email confirmation when client-visible VMS work is scheduled.','scheduling','event',true,'client',true,true,'{}'::jsonb,now()),
  ('job_rescheduled_client','Appointment rescheduled','Send the client an updated confirmation when the scheduled time changes.','scheduling','event',true,'client',true,true,'{}'::jsonb,now()),
  ('job_canceled_client','Appointment canceled','Send the client a cancellation confirmation when scheduled work is canceled.','scheduling','event',true,'client',true,true,'{}'::jsonb,now())
on conflict (rule_key) do update set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category,
  trigger_type=excluded.trigger_type,
  enabled=excluded.enabled,
  audience=excluded.audience,
  in_app_enabled=excluded.in_app_enabled,
  email_enabled=excluded.email_enabled,
  config=excluded.config,
  updated_at=now();

create or replace function public.vms_queue_service_job_client_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rule text;
  v_subject text;
  v_message text;
  v_event_key text;
  v_when text;
  v_tz text;
begin
  if new.client_id is null or coalesce(new.client_visible,true) is false then
    return new;
  end if;

  v_tz := coalesce(nullif(new.timezone,''),'America/New_York');
  if new.scheduled_start is not null then
    v_when := to_char(new.scheduled_start at time zone v_tz, 'FMMonth FMDD, YYYY at FMHH12:MI AM');
  else
    v_when := 'the scheduled time';
  end if;

  if tg_op = 'INSERT' and new.scheduled_start is not null then
    v_rule := 'job_scheduled_client';
    v_subject := 'Your VMS appointment is scheduled';
    v_message := coalesce(nullif(new.title,''),nullif(new.service_name,''),'VMS appointment') || ' is scheduled for ' || v_when || '.';
    v_event_key := v_rule || ':' || new.id::text || ':' || coalesce(extract(epoch from new.scheduled_start)::bigint::text,'none');
  elsif tg_op = 'UPDATE' and lower(coalesce(new.status,'')) in ('canceled','cancelled')
        and lower(coalesce(old.status,'')) not in ('canceled','cancelled') then
    v_rule := 'job_canceled_client';
    v_subject := 'Your VMS appointment was canceled';
    v_message := coalesce(nullif(new.title,''),nullif(new.service_name,''),'VMS appointment') || ' scheduled for ' || v_when || ' has been canceled.';
    v_event_key := v_rule || ':' || new.id::text || ':' || extract(epoch from coalesce(new.updated_at,now()))::bigint::text;
  elsif tg_op = 'UPDATE' and new.scheduled_start is distinct from old.scheduled_start and new.scheduled_start is not null then
    v_rule := 'job_rescheduled_client';
    v_subject := 'Your VMS appointment was rescheduled';
    v_message := coalesce(nullif(new.title,''),nullif(new.service_name,''),'VMS appointment') || ' is now scheduled for ' || v_when || '.';
    v_event_key := v_rule || ':' || new.id::text || ':' || extract(epoch from new.scheduled_start)::bigint::text;
  else
    return new;
  end if;

  insert into public.automation_event_queue
    (rule_key,event_key,client_id,source_type,source_id,subject,message,needs_action,metadata,status,next_attempt_at,created_at,updated_at)
  values
    (v_rule,v_event_key,new.client_id,'service_job',new.id::text,v_subject,v_message,false,
     jsonb_build_object(
       'required',true,
       'job_id',new.id,
       'scheduled_start',new.scheduled_start,
       'scheduled_end',new.scheduled_end,
       'timezone',v_tz,
       'button_label','Open Scheduling',
       'url','https://visionmakestudio.com/portal/schedule.html'
     ),
     'pending',now(),now(),now())
  on conflict (event_key) do nothing;

  return new;
end;
$function$;

drop trigger if exists vms_service_jobs_client_notification on public.service_jobs;
create trigger vms_service_jobs_client_notification
after insert or update of scheduled_start, scheduled_end, status, client_visible on public.service_jobs
for each row execute function public.vms_queue_service_job_client_notification();
