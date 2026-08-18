# Vision Make Studio — Final Netlify Production Candidate

This folder is the deployable Vision Make Studio web suite.

## Entry points

- `/` — Public Vision Make Studio website
- `/admin/login.html` — Private VMS Admin login
- `/admin/` — VMS Admin dashboard
- `/portal/` — Client Portal
- `/admin/service-catalog.html` — Central service/package/pricing catalog
- `/admin/audit.html` — VMS Audit + AI Assistant

## Production architecture

- **Netlify** — static hosting + serverless API functions
- **Supabase** — passwordless authentication, database, row-level security, shared workspace state, private client files
- **OpenAI API** — server-side VMS Audit AI / review lookup; the key is never exposed to the browser
- **Resend (optional)** — transactional VMS notifications to `info@visionmakestudio.com`
- **Google Workspace** — existing VMS mailbox for `info@visionmakestudio.com`

## Central catalog

`assets/vms-catalog.js` contains the safe local fallback catalog. In production, the source of truth is the Supabase `service_catalog` table.

Admin Service Catalog → Supabase → Public Website + Client Portal + Billing + Promotions.

New catalog prices apply to new sales. Existing client-specific agreed prices stay locked unless VMS intentionally changes them.

## Current LinkHub pricing logic

- VMS LinkHub Core — $19.99 one time
- LinkHub Wi-Fi Feature — $6.99 one time
- LinkHub Restaurant Menu — $49.99 one time
- VMS LinkHub Pro — $14.99/month
  - Core included
  - Wi-Fi included
  - Restaurant Menu included
  - Smart Scan Activity included
  - Client Portal management + ongoing management included
- Optional Done-for-You LinkHub build — $49 one time
- VMS Activation Fee — $4.99 once on the client's first paid standalone order; waived for packages/bundles

Restaurant Menu and Wi-Fi are **LinkHub features**, not QR products.

## Build / validation

Run:

```bash
npm install
npm run build
```

The build command validates local links/assets, inline JavaScript syntax, common DOM ID wiring, shared Admin navigation, pricing rules, Supabase schema requirements and Netlify functions; TypeScript-checks the server functions; generates the private-safe `dist/` publish directory; then validates `dist/` again.

Netlify publishes **`dist/`**, not the project root. Setup files such as `VMS-Launch-Guide.html`, `supabase/schema.sql`, build scripts and README stay out of the public site.

## Before first production deploy

1. Create the Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Put the Supabase Project URL and anon key in `assets/config.js`.
4. Add the required secret environment variables in Netlify.
5. Invite/create `info@visionmakestudio.com` in Supabase Auth.
6. Run the admin-promotion SQL line at the bottom of `supabase/schema.sql`.
7. Configure Supabase Auth Site URL / Redirect URLs for your real domain.
8. Verify the Resend sending domain if using automated email notifications.
9. Deploy the entire project folder through Netlify.
10. For future customers, open their Admin Client Profile and use **Invite to Portal**. That server-side action creates/syncs their production client record and sends the Supabase invitation without exposing the secret key.

See `VMS-Launch-Guide.html` for the complete setup.

## Important payment note

VMS Billing can create invoices, record payments, manage subscriptions, apply the one-time VMS Activation Fee, preserve agreed client prices, and record Cash/Zelle/Card/Bank Transfer/manual payment status. **Live online card checkout is intentionally disabled until a real payment processor is connected.** This avoids shipping a fake/simulated checkout path.

## Production test client

The schema intentionally includes one test client:

`info@visionmakestudio.com`

That account is seeded with VMS service access for testing the Client Portal. Other fake/demo businesses and fake payments are not part of the production fallbacks.
