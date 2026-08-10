import Link from "next/link";

export default function HomePage() {
  return (
    <main className="auth-page">
      <section aria-labelledby="page-title" className="auth-card">
        <p className="eyebrow">Smart customer operations</p>
        <h1 id="page-title">SmartDesk AI</h1>
        <p className="lead">
          A secure workspace for service teams to receive and follow customer
          requests.
        </p>
        <div className="chat-options">
          <Link
            className="button button-primary"
            href="/chat/buildpro-cameroon"
          >
            Start BuildPro chat
          </Link>
          <Link className="button" href="/login">
            Employee sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
