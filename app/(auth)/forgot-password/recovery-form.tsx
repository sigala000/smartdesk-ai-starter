"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestPasswordRecovery, type RecoveryState } from "./actions";

const initialState: RecoveryState = { sent: false };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" disabled={pending} type="submit">
      {pending ? "Sending…" : "Send recovery link"}
    </button>
  );
}

export function RecoveryForm() {
  const [state, action] = useActionState(requestPasswordRecovery, initialState);
  return (
    <form action={action} className="auth-form">
      <div className="field">
        <label htmlFor="recovery-email">Work email</label>
        <input
          autoComplete="email"
          id="recovery-email"
          name="email"
          required
          type="email"
        />
      </div>
      {state.sent ? (
        <p className="status-message" role="status">
          If an eligible account exists, a recovery link has been sent.
        </p>
      ) : null}
      <Submit />
    </form>
  );
}
