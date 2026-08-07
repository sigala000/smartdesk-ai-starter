import { logout } from "@/app/(auth)/logout-action";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button className="button button-secondary" type="submit">
        Sign out
      </button>
    </form>
  );
}
