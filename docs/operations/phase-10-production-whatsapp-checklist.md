# Phase 10 Production WhatsApp Checklist

Do not enable a production tenant until every required item has a named owner,
date, and private evidence link.

- [ ] Meta business/app verification and required Advanced Access are approved.
- [ ] Privacy, terms, and deletion pages contain approved legal entity/contact,
      retention, jurisdiction, and support details.
- [ ] Exact production HTTPS domain and `/dashboard/whatsapp` redirect are in
      Meta Login for Business settings; no wildcard redirect is used.
- [ ] Production webhook verifies and the `messages` field is subscribed.
- [ ] `META_CREDENTIAL_ENCRYPTION_KEY` is a backed-up 32-byte secret with an
      assigned rotation/recovery owner; it is different from staging.
- [ ] App secret, verify token, Supabase service role, and OpenAI key are in host
      secret storage and absent from browser bundles/logs/Git.
- [ ] The client explicitly owns/authorizes the WABA and phone, completes Meta
      terms, OTP/registration or approved migration, and configures Meta billing.
- [ ] SmartDesk stores no payment card and uses no shared line of credit.
- [ ] Cross-tenant, signature, replay, credential-tamper, delivery-deduplication,
      confirmation/idempotency, handoff pause, and provider-failure tests pass.
- [ ] A synthetic staging customer completes one request and exactly one ticket
      appears in that tenant's employee dashboard.
- [ ] Connection health, rate limits, delivery review queue, redacted logs,
      trace correlation, alerts, disconnect, and rollback are rehearsed.
- [ ] SmartDesk subscription/trial state and entitlements are approved separately
      from Meta billing. No unapproved price/provider is displayed.

Disconnect must confirm provider unsubscribe before disabling the local account.
If provider outcome is ambiguous, keep the connection in an action-required
state and do not claim success or delete the only credential.
