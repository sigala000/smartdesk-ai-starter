type SignOutResult = PromiseLike<Readonly<{ error: unknown | null }>>;
type SignOut = (options?: Readonly<{ scope: "local" }>) => SignOutResult;

export async function clearEmployeeSession(signOut: SignOut): Promise<boolean> {
  const globalResult = await signOut();
  if (!globalResult.error) return true;

  const localResult = await signOut({ scope: "local" });
  return !localResult.error;
}
