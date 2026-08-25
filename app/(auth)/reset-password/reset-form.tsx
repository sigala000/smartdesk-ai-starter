"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { resetPassword, type ResetState } from "./actions";

const initialState: ResetState = { error: null };
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" disabled={pending} type="submit">
      {pending ? "Updating…" : "Update password"}
    </button>
  );
}
export function ResetForm() {
  const [state, action] = useActionState(resetPassword, initialState);
  return (
    <form action={action} className="auth-form">
      <div className="field">
        <label htmlFor="new-password">New password</label>
        <input
          autoComplete="new-password"
          id="new-password"
          minLength={12}
          name="password"
          required
          type="password"
        />
      </div>
      <div className="field">
        <label htmlFor="confirm-password">Confirm password</label>
        <input
          autoComplete="new-password"
          id="confirm-password"
          minLength={12}
          name="confirmation"
          required
          type="password"
        />
      </div>
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <Submit />
    </form>
  );
}
