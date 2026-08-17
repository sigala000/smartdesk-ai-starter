import { RequestStatusFlow } from "@/components/status/request-status-flow";
export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ conversationId?: string }>;
}) {
  const { conversationId } = await searchParams;
  return (
    <main className="status-page" id="main-content">
      <section className="status-card">
        <p className="eyebrow">BuildPro Cameroon</p>
        <h1>Check request status</h1>
        <p>
          Enter your reference and confirmed contact number. A reference alone
          never reveals request information.
        </p>
        <RequestStatusFlow conversationId={conversationId} />
      </section>
    </main>
  );
}
