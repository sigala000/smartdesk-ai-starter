"use client";

import Link from "next/link";
import { useActionState } from "react";

import { registerOwner, type RegistrationState } from "./actions";

const initialState: RegistrationState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerOwner, initialState);
  return (
    <form action={action} className="auth-form">
      <label htmlFor="fullName">Your full name</label>
      <input
        autoComplete="name"
        id="fullName"
        name="fullName"
        required
        maxLength={160}
      />
      <label htmlFor="email">Work email</label>
      <input
        autoComplete="email"
        id="email"
        name="email"
        required
        type="email"
        maxLength={254}
      />
      <label htmlFor="password">Password</label>
      <input
        autoComplete="new-password"
        id="password"
        name="password"
        required
        type="password"
        minLength={12}
        maxLength={128}
      />
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="button-primary" disabled={pending} type="submit">
        {pending ? "Creating account…" : "Create company account"}
      </button>
      <p className="auth-help">
        Already registered? <Link href="/login">Sign in</Link>.
      </p>
    </form>
  );
}
