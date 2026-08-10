export default function RequestsLoading() {
  return (
    <section aria-busy="true">
      <p className="eyebrow">Request management</p>
      <h1>Loading requests…</h1>
      <div className="loading-panel">
        Preparing your authorized request queue.
      </div>
    </section>
  );
}
