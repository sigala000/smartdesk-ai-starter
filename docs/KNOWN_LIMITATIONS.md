# Known Limitations

- WhatsApp is limited to Meta's developer test number and authorized recipients. Production WhatsApp is outside the MVP.
- Status verification has a development mock only. Production fails closed until a real provider is implemented.
- English is the default. French infrastructure and the public-chat entry vocabulary exist, but dynamic database prompts, employee screens, validation messages, and every workflow are not fully translated.
- Automated accessibility checks are smoke tests, not a substitute for keyboard and screen-reader review.
- File upload validation checks type, signature, size, and private access; a production malware scanner still requires an external provider.
- AI usage is emitted as redacted structured logs. Persistent dashboards, budgets, and alerts depend on the selected hosting/observability platform.
- Rate limiting is application/database backed and depends on a deployment proxy that overwrites the configured client-IP header. This must be verified in staging.
- Backup retention, point-in-time recovery, staging, domains, and monitoring are provider settings and are not created by repository code.
- Automatic final quotations, autonomous pricing, payments, voice, accounting integration, and multi-agent orchestration remain out of scope.
