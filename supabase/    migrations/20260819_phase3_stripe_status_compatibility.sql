-- VMS Phase 3: accept Stripe's full subscription lifecycle status set.
-- This migration was already applied to the production Supabase project on 2026-08-19.

alter table public.billing_subscriptions drop constraint if exists billing_subscriptions_status_check;
alter table public.billing_subscriptions add constraint billing_subscriptions_status_check
check (status = any (array[
  'trialing'::text,
  'active'::text,
  'past_due'::text,
  'paused'::text,
  'canceled'::text,
  'incomplete'::text,
  'incomplete_expired'::text,
  'unpaid'::text
]));
