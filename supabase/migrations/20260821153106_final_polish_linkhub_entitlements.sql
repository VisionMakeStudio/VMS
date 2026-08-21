-- Final Polish Phase 4: LinkHub publishing and paid-feature entitlement enforcement.
create or replace function public.vms_enforce_linkhub_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base boolean := false;
  v_wifi boolean := false;
  v_menu boolean := false;
  v_wifi_data jsonb;
  v_menu_data jsonb;
begin
  select exists(
    select 1 from public.client_services cs
    where cs.client_id = new.client_id
      and lower(cs.service_key) in ('linkhub-core','linkhub-pro')
      and lower(cs.service_status) in ('active','published','enabled')
      and lower(cs.billing_status) in ('active','paid','trialing','gifted','comped')
  ) into v_base;

  select exists(
    select 1 from public.client_services cs
    where cs.client_id = new.client_id
      and lower(cs.service_key) = 'linkhub-wifi'
      and lower(cs.service_status) in ('active','published','enabled')
      and lower(cs.billing_status) in ('active','paid','trialing','gifted','comped')
  ) into v_wifi;

  select exists(
    select 1 from public.client_services cs
    where cs.client_id = new.client_id
      and lower(cs.service_key) = 'linkhub-menu'
      and lower(cs.service_status) in ('active','published','enabled')
      and lower(cs.billing_status) in ('active','paid','trialing','gifted','comped')
  ) into v_menu;

  if new.status = 'published' and not v_base then
    raise exception using
      errcode = '23514',
      message = 'An active VMS LinkHub service is required before publishing.';
  end if;

  if new.status = 'published' then
    new.published_data := coalesce(new.published_data, '{}'::jsonb);

    if not v_wifi then
      v_wifi_data := coalesce(new.published_data->'wifi', '{}'::jsonb) || jsonb_build_object('enabled', false);
      new.published_data := jsonb_set(new.published_data, '{wifi}', v_wifi_data, true);
    end if;

    if not v_menu then
      v_menu_data := coalesce(new.published_data->'restaurant', '{}'::jsonb) || jsonb_build_object('enabled', false);
      new.published_data := jsonb_set(new.published_data, '{restaurant}', v_menu_data, true);
    end if;

    new.published_data := new.published_data || jsonb_build_object(
      '_entitlements', jsonb_build_object(
        'linkhub', v_base,
        'wifi', v_wifi,
        'menu', v_menu,
        'checked_at', now()
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.vms_enforce_linkhub_entitlements() from public;
grant execute on function public.vms_enforce_linkhub_entitlements() to authenticated;

drop trigger if exists vms_linkhub_entitlement_guard on public.linkhub_pages;
create trigger vms_linkhub_entitlement_guard
before insert or update of client_id,status,published_data
on public.linkhub_pages
for each row execute function public.vms_enforce_linkhub_entitlements();
