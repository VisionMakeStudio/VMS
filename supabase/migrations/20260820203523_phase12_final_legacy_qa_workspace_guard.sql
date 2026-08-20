-- Phase 12 final: permanently reject the known legacy QA client workspace snapshot.
-- Production already has this migration applied. Keeping it in source control prevents drift.

delete from public.workspace_state
where coalesce(scope,'') like 'client:%'
  and state_key in ('vms_client_portal_v4','vms_client_bridge_v1')
  and coalesce(payload::text,'') ilike '%VMS Phase 12 QA%';

create or replace function public.vms_reject_legacy_qa_workspace_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.scope,'') like 'client:%'
     and new.state_key in ('vms_client_portal_v4','vms_client_bridge_v1')
     and coalesce(new.payload::text,'') ilike '%VMS Phase 12 QA%' then
    if tg_op = 'UPDATE' then
      return old;
    end if;
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists vms_reject_legacy_qa_workspace_state on public.workspace_state;
create trigger vms_reject_legacy_qa_workspace_state
before insert or update on public.workspace_state
for each row
execute function public.vms_reject_legacy_qa_workspace_state();
