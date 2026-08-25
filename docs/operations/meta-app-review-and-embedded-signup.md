# Meta Embedded Signup and App Review Runbook

This is an application-readiness runbook, not approval to submit the app, accept
terms, enter an OTP, register or migrate a phone number, or add a payment card.
The product owner must review every value and perform those Meta actions.

## Application-side prerequisites

- Public HTTPS application URL and stable `/api/webhooks/whatsapp` callback.
- Public `/privacy`, `/terms`, and `/data-deletion` pages after owner/legal
  placeholders are replaced and approved.
- Server secret `META_APP_SECRET`, webhook verify token, credential encryption
  key, and existing Supabase/OpenAI keys.
- Browser-safe Meta App ID and Embedded Signup Configuration ID.
- Webhook `messages` field subscribed and raw-body signature verification live.

## Meta portal setup (manual)

1. Open **Meta for Developers → SmartDesk app → Facebook Login for Business →
   Configurations**. Create a WhatsApp Embedded Signup configuration using the
   Cloud API/system-user token option and only permissions required for the
   implemented flow.
2. Copy the public Configuration ID to
   `NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID`; copy the public App ID to
   `NEXT_PUBLIC_META_APP_ID`. Never put the App Secret in a `NEXT_PUBLIC_`
   variable.
3. Under Login for Business settings, allow the exact production HTTPS domain
   and exact redirect URI `/dashboard/whatsapp`. Do not use wildcard redirects.
4. In WhatsApp/Webhooks, keep the callback at
   `https://<production-domain>/api/webhooks/whatsapp`, verify with the
   server-held token, and subscribe `messages`.
5. Complete Meta business verification and request the current Advanced Access
   permissions Meta requires for Embedded Signup and WABA management. Recheck
   exact permission names in Meta's current portal before submission.

## Review evidence

- Screencast: company admin signs in, opens WhatsApp settings, launches Meta's
  dialog, selects company-owned assets, returns to connected status, receives a
  customer message, completes a confirmed request, and sees exactly one request
  in the tenant dashboard.
- Negative evidence: a non-admin is denied; another tenant cannot see the
  account; a repeated signed provider message produces no duplicate reply or
  request; an invalid signature is rejected; no token appears in browser tools.
- Permission narrative: WABA management is used only to inspect assets selected
  by the client and subscribe the app; messaging is used only for that client's
  customer conversations. Organization identity comes from destination assets,
  never customer text.
- Data handling: access tokens are encrypted with authenticated encryption,
  never returned to the browser, never logged, and deleted/invalidated on a
  verified disconnect/retention workflow.

## Client-owned billing

The client completes Meta payment setup inside Meta. SmartDesk must not request,
proxy, store, or log card details and does not extend a shared line of credit.
The dashboard records only provider-reported readiness/action-required status.

## Final manual gates

- Replace and approve legal entity, privacy contact, retention, and terms.
- Review current Meta policies, permission list, screencast, tester account,
  domains, deletion URL, and data-use answers.
- Product owner explicitly approves App Review submission.
- Each client explicitly authorizes its own assets and completes any Meta OTP,
  phone registration/migration, terms, and billing steps.

Official operational reference: Meta's WhatsApp Business Platform collection
documents `POST /{WABA-ID}/subscribed_apps` and requires an authorized token;
portal/API labels must be revalidated at the time of review.
