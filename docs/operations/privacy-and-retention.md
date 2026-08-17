# Privacy and Retention Controls

Before pilot, the product owner must approve and record retention periods for conversations/messages, requests/history, attachments, verification/security events, audit events, and redacted application logs. The default is not “keep forever.” Legal requirements for Cameroon and the operating company require qualified review.

Access and deletion requests must be authenticated, tenant scoped, audited, and reviewed for records that must be retained. Attachment deletion must invalidate metadata and private storage objects. Backups age out according to the approved backup retention rather than being edited in place.

Logs may contain opaque IDs, trace IDs, outcome codes, latency, tool names, and token counts. They must not contain message bodies, prompts, contact fields, access/verification tokens, cookies, credentials, internal notes, or attachment contents. Use the shared redacting logger and test with sentinel values.

The pilot notice must disclose virtual-assistant use, purpose, human escalation, attachment handling, retention/contact route, and that the reference number alone cannot retrieve a request.
