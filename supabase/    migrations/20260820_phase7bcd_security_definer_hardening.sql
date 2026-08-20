-- VMS Master Phase 7 hardening: trigger/helper functions are internal only.
revoke execute on function public.vms_enqueue_automation_event(text,text,uuid,text,text,text,text,boolean,jsonb) from public, anon, authenticated;
revoke execute on function public.vms_phase7_booking_event_trigger() from public, anon, authenticated;
revoke execute on function public.vms_phase7_job_event_trigger() from public, anon, authenticated;
revoke execute on function public.vms_phase7_billing_event_trigger() from public, anon, authenticated;
revoke execute on function public.vms_phase7_onboarding_event_trigger() from public, anon, authenticated;
revoke execute on function public.vms_phase7_activity_event_trigger() from public, anon, authenticated;
