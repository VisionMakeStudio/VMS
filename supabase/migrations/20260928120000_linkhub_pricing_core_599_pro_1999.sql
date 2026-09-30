-- LinkHub pricing decision (Sept 28, 2026):
--   VMS LinkHub Core = $5.99/month, VMS LinkHub Pro = $19.99/month.
-- Updates the live catalog only. Existing client_services rows with
-- price_locked = true keep their agreed price (new prices apply to new sales).
update public.service_catalog
   set kind='subscription', pricing_model='Recurring', one_time_price=null,
       recurring_price=5.99, cadence='Monthly', updated_at=now()
 where id='linkhub-core';

update public.service_catalog
   set pricing_model='Recurring', one_time_price=null,
       recurring_price=19.99, cadence='Monthly', updated_at=now()
 where id='linkhub-pro';
