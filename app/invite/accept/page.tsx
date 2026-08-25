import { acceptInvitation } from "./actions";

export default async function AcceptInvitationPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ token?: string }> }>) {
  const { token } = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Company invitation</p>
        <h1>Join the workspace</h1>
        <p className="lead">
          Sign in with the invited email address, then accept this invitation.
        </p>
        {token ? (
          <form action={acceptInvitation}>
            <input name="token" type="hidden" value={token} />
            <button className="button-primary" type="submit">
              Accept invitation
            </button>
          </form>
        ) : (
          <p className="form-error">This invitation link is incomplete.</p>
        )}
      </section>
    </main>
  );
}
