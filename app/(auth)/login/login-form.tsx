"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { login, type LoginState } from "@/app/(auth)/login/actions";

type LoginFormProps = Readonly<{ nextPath: string }>;
const initialLoginState: LoginState = { error: null, email: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" disabled={pending} type="submit">
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const [state, formAction] = useActionState(login, initialLoginState);

  return (
    <form action={formAction} className="auth-form" noValidate>
      <input name="next" type="hidden" value={nextPath} />
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input
          autoComplete="email"
          defaultValue={state.email}
          id="email"
          inputMode="email"
          maxLength={254}
          name="email"
          required
          type="email"
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          autoComplete="current-password"
          id="password"
          maxLength={1024}
          name="password"
          required
          type="password"
        />
      </div>
      {state.error ? (
        <p aria-live="polite" className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
