-- Oct 1, 2026: LinkHub QR rules + the Tap and Scan Stand
-- Run once in the Supabase SQL editor. Safe to run again.
update public.service_catalog
   set features='["Business profile and contact actions","Custom links and social icons","Theme and brand colors","Visit Us / Directions page","Unlimited static QR codes"]'::jsonb, updated_at=now()
 where id='linkhub-core';

update public.service_catalog
   set features='["Everything in LinkHub Core","Tracked (dynamic) QR codes with scan counts","Restaurant Menu included","Wi-Fi feature included","Smart Scan Activity","LinkHub views and click analytics","Dynamic management and ongoing updates","Client Portal management"]'::jsonb, updated_at=now()
 where id='linkhub-pro';

insert into public.service_catalog
 (id,name,kind,category,icon,status,featured,display_order,description,pricing_model,one_time_price,recurring_price,cadence,starting_at,sales_mode,website_visible,portal_visible,promo_eligible,features,included,metadata)
values
 ('tap-scan-stand','VMS Tap and Scan Stand','addon','QR & Growth','QR','Published',false,45,
  'A countertop stand with a QR code and an NFC tap tag. VMS sets it up to open the link you choose, such as your LinkHub, reviews or menu.',
  'One-Time',29.99,null,null,false,'Request First',true,true,false,
  '["Tap with a phone or scan the QR code","Set to any link you choose, and changeable later with a tracked code","Counter or desk stand","Free shipping in the U.S."]'::jsonb,'[]'::jsonb,
  '{"family":"stand","physical":true,"freeShipping":true}'::jsonb)
on conflict (id) do update set
  name=excluded.name, description=excluded.description, one_time_price=excluded.one_time_price,
  features=excluded.features, metadata=excluded.metadata, status='Published', website_visible=true, portal_visible=true, updated_at=now();
