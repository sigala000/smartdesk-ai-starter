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
        <Link className="button button-primary" href="/login">
          Employee sign in
        </Link>
      </section>
    </main>
  );
}
