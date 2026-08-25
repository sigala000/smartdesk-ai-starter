import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-page" id="main-content">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link className="product-mark" href="/">
          <span className="product-mark-icon">S</span>
          <span>SmartDesk AI</span>
        </Link>
        <div className="landing-nav-links">
          <Link href="/status">Track a request</Link>
          <Link href="/register">Create a company</Link>
          <Link className="button button-quiet" href="/login">
            Employee portal
          </Link>
        </div>
      </nav>
      <section className="landing-hero" aria-labelledby="page-title">
        <div className="landing-copy">
          <p className="eyebrow">BuildPro Cameroon customer desk</p>
          <h1 id="page-title">Your project request, clearly handled.</h1>
          <p className="landing-lead">
            Tell our virtual assistant what you need, review every detail, and
            receive a secure reference for follow-up—without repeating yourself.
          </p>
          <div className="landing-actions">
            <Link
              className="button button-primary"
              href="/chat/buildpro-cameroon"
            >
              Start a request
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button-secondary" href="/status">
              Check request status
            </Link>
          </div>
          <p className="language-link">
            Prefer French?{" "}
            <Link href="/chat/buildpro-cameroon?lang=fr" hrefLang="fr">
              Continuer en français
            </Link>
          </p>
        </div>
        <div className="landing-preview" aria-label="How SmartDesk works">
          <div className="preview-orb preview-orb-one" />
          <div className="preview-orb preview-orb-two" />
          <article className="preview-card preview-card-main">
            <span className="preview-avatar">BP</span>
            <div>
              <p className="preview-label">BuildPro virtual assistant</p>
              <p>What project would you like help with?</p>
            </div>
          </article>
          <article className="preview-card preview-card-step">
            <span className="step-check">✓</span>
            <div>
              <strong>One question at a time</strong>
              <p>You review everything before submission.</p>
            </div>
          </article>
          <article className="preview-card preview-card-ticket">
            <p className="preview-label">Request confirmed</p>
            <strong>BP-2026-000041</strong>
            <span className="status-chip status-new">New request</span>
          </article>
        </div>
      </section>
      <section className="trust-strip" aria-label="Product safeguards">
        <div>
          <strong>Private by design</strong>
          <span>Your details stay protected.</span>
        </div>
        <div>
          <strong>Human support</strong>
          <span>Ask for an employee at any time.</span>
        </div>
        <div>
          <strong>No surprise submission</strong>
          <span>Nothing is created before you confirm.</span>
        </div>
      </section>
    </main>
  );
}
