export default function DashboardLoading() {
  return (
    <main className="loading-state" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>Verifying your employee access…</p>
    </main>
  );
}
