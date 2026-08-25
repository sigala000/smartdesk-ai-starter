# Environment Separation

Development, staging, and production use separate Supabase projects, storage buckets, Auth users, OpenAI projects/keys, rate-limit secrets, and hosting environment variables. Never promote `.env.local`, databases, or storage objects between them.

| Control | Development | Staging | Production |
|---|---|---|---|
| Status provider | mock permitted | real provider sandbox | real provider only |
| WhatsApp | Meta test allowlist | Meta test/Embedded Signup rehearsal | connected client assets only after Meta approval |
| Sample seed | explicit development script | prohibited | prohibited |
| Debug/code exposure | local only | mock code prohibited | mock rejected at startup |
| Data | synthetic | synthetic test identities | pilot customer data |

For each environment configure the documented variables from `.env.example` in the host secret store. Set trusted proxy IP-header behavior, canonical URL, Auth redirect allowlist, and private storage. Apply migrations through CI/CLI after reviewing `supabase db diff --linked`; never through undocumented dashboard SQL.

Promotion order is development → staging migration/restore rehearsal → production change window. Keys are least privilege, server-only, rotated on exposure or staff change, and never copied into support tickets or logs.

Production WhatsApp additionally requires an environment-specific 32-byte
credential encryption key, exact HTTPS Embedded Signup domains/redirects, and
client-owned Meta billing. Never copy production credentials into development.
