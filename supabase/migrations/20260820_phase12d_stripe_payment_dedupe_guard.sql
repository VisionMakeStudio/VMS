create or replace function public.vms_stripe_payment_dedupe_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  existing_row public.billing_payments%rowtype;
  incoming_id text := coalesce(new.provider_payment_id, '');
  existing_id text;
begin
  if new.provider <> 'stripe' or new.status <> 'paid' or new.client_service_id is null then
    return new;
  end if;

  if new.invoice_id is not null then
    select p.* into existing_row
    from public.billing_payments p
    where p.provider = 'stripe'
      and p.status = 'paid'
      and p.client_id = new.client_id
      and p.client_service_id = new.client_service_id
      and p.amount = new.amount
      and upper(p.currency) = upper(new.currency)
      and p.invoice_id = new.invoice_id
    order by p.created_at desc
    limit 1;

    if found then
      existing_id := coalesce(existing_row.provider_payment_id, '');
      update public.billing_payments
      set provider_payment_id = case
            when incoming_id like 'pi\_%' escape '\' and (existing_id = '' or existing_id like 'invoice:%') then new.provider_payment_id
            else existing_row.provider_payment_id
          end,
          subscription_id = coalesce(existing_row.subscription_id, new.subscription_id),
          description = coalesce(new.description, existing_row.description),
          paid_at = coalesce(existing_row.paid_at, new.paid_at),
          metadata = coalesce(existing_row.metadata, '{}'::jsonb) || coalesce(new.metadata, '{}'::jsonb),
          updated_at = now()
      where id = existing_row.id;
      return null;
    end if;
  end if;

  select p.* into existing_row
  from public.billing_payments p
  where p.provider = 'stripe'
    and p.status = 'paid'
    and p.client_id = new.client_id
    and p.client_service_id = new.client_service_id
    and p.amount = new.amount
    and upper(p.currency) = upper(new.currency)
    and p.created_at >= now() - interval '15 minutes'
    and (
      incoming_id like 'invoice:%'
      or coalesce(p.provider_payment_id, '') like 'invoice:%'
      or (new.invoice_id is not null and p.invoice_id is null)
      or (new.invoice_id is null and p.invoice_id is not null)
    )
  order by
    case when new.invoice_id is not null and p.invoice_id = new.invoice_id then 0 else 1 end,
    p.created_at desc
  limit 1;

  if found then
    existing_id := coalesce(existing_row.provider_payment_id, '');
    update public.billing_payments
    set provider_payment_id = case
          when incoming_id like 'pi\_%' escape '\' and (existing_id = '' or existing_id like 'invoice:%') then new.provider_payment_id
          else existing_row.provider_payment_id
        end,
        invoice_id = coalesce(existing_row.invoice_id, new.invoice_id),
        subscription_id = coalesce(existing_row.subscription_id, new.subscription_id),
        description = coalesce(new.description, existing_row.description),
        paid_at = coalesce(existing_row.paid_at, new.paid_at),
        metadata = coalesce(existing_row.metadata, '{}'::jsonb) || coalesce(new.metadata, '{}'::jsonb),
        updated_at = now()
    where id = existing_row.id;
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists vms_stripe_payment_dedupe_guard on public.billing_payments;
create trigger vms_stripe_payment_dedupe_guard
before insert on public.billing_payments
for each row
execute function public.vms_stripe_payment_dedupe_guard();
