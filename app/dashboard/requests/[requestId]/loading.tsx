export default function RequestLoading() {
  return (
    <section aria-busy="true">
      <p className="eyebrow">Request detail</p>
      <h1>Loading request…</h1>
      <div className="loading-panel">
        Loading authorized customer and workflow data.
      </div>
    </section>
  );
}
