export default function DataDeletionPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <p className="eyebrow">Privacy request</p>
        <h1>Request data access or deletion</h1>
        <p>
          <strong>
            This procedure requires the product owner to publish an approved
            privacy contact before production.
          </strong>
        </p>
        <ol>
          <li>
            Contact the company that received your request using its published
            support channel.
          </li>
          <li>
            Provide the request reference and complete the company&apos;s
            identity-verification process. Never send passwords or verification
            codes to support staff.
          </li>
          <li>
            The company will scope the request to its own tenant, review records
            it must lawfully retain, and record the fulfilled action.
          </li>
        </ol>
        <p>
          SmartDesk administrators must not delete audit or customer data solely
          from an unauthenticated email. Requests are authenticated,
          tenant-scoped, audited, and applied to live data and private
          attachment metadata; backups expire under the approved retention
          policy.
        </p>
      </article>
    </main>
  );
}
