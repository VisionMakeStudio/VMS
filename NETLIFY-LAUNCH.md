# Vision Make Studio — Netlify Launch Checklist

This project is prepared for a Git-based Netlify deployment. The build publishes the public website plus protected Admin and Client Portal deployment copies without changing the approved source prototypes.

## 1. Create the business email first

Recommended setup:

- Create the full mailbox `info@visionmakestudio.com` with Zoho Mail Lite.
- Use that address for customer replies, sales, Business Checkups, and account ownership.
- Use Resend for automated website notification delivery. Resend is the sender service; Zoho is the mailbox you read and reply from.

At the DNS provider for `visionmakestudio.com`, add every verification, MX, SPF, DKIM, and DMARC record provided by Zoho. Then verify the domain (or a sending subdomain) in Resend and add its requested DNS records. Do not create two competing SPF records—combine approved senders into one SPF record when required.

## 2. Create the Netlify site

1. Push this folder to a private Git repository.
2. In Netlify, choose **Add new site → Import an existing project**.
3. Select the repository. Netlify reads `netlify.toml`; no custom build fields should be necessary.
4. Confirm the build command is `npm run build` and the publish directory is `dist/client`.
5. Deploy once, then connect `visionmakestudio.com` in **Domain management**.

## 3. Add environment variables

In Netlify, open **Site configuration → Environment variables** and add:

```text
VMS_NOTIFICATION_EMAIL=info@visionmakestudio.com
VMS_FROM_EMAIL=Vision Make Studio <notifications@visionmakestudio.com>
RESEND_API_KEY=your_resend_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

Trigger a fresh deploy after saving them.

## 4. Activate the VMS owner login

1. Enable Netlify Identity for the site.
2. Set registration to **Invite only**. Public Admin signup should remain disabled.
3. Invite `info@visionmakestudio.com` as the owner.
4. Open that Identity user and assign the exact role `admin`.
5. Open the invitation email, visit `/staff-login/`, and create a password of at least 10 characters.
6. Future Admin sign-ins use `https://visionmakestudio.com/staff-login/`.

The `/admin/*` pages are protected by the `admin` role in `netlify.toml`. A user without that role cannot open the VMS Admin suite.

## 5. Activate Client Portal magic links

1. Create a Supabase project.
2. In Supabase Auth, set the production site URL to `https://visionmakestudio.com`.
3. Add `https://visionmakestudio.com/portal/` as an allowed redirect URL.
4. Keep public signup disabled in the VMS workflow. Create each client account from the Admin process after services and payment are confirmed.
5. Enter the Supabase values in Netlify as shown above and redeploy.

The public Member Portal form requests a one-time sign-in link. `shouldCreateUser` is disabled, so an unknown email does not create its own account.

## 6. Verify notifications

1. Submit a Business Checkup using a test business and a test reply address.
2. Confirm the request is stored in the Netlify Blobs store named `vms-business-checkups`.
3. Confirm the notification arrives at `info@visionmakestudio.com`.
4. Reply from the new mailbox and verify SPF/DKIM pass in the received-message details.

## 7. Final production checks

- Public site: mobile menu, all section links, service dialogs, score interaction, Business Checkup form, Member Portal dialog, footer email, and Admin Login link.
- Admin: `/staff-login/`, role protection, dashboard menu, every tool link, QR tool, Client Portal link, Public Website link, and sign out.
- Client Portal: approved-client magic link, portal session gate, menu, files, notifications, QR, LinkHub, services, requests, and sign out.
- Test on one iPhone-size screen, one Android-size screen, and a desktop browser.
- Keep Netlify deploy previews enabled for future changes; publish to production only after the preview passes.

## Local verification commands

```bash
npm install
npm run build
npm run qa:suite
npm test
```

