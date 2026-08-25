"use client";

import { useActionState } from "react";

import { createOrganization, type OnboardingState } from "./actions";

const initialState: OnboardingState = {};

export function OnboardingForm({
  displayName,
}: Readonly<{ displayName: string }>) {
  const [state, action, pending] = useActionState(
    createOrganization,
    initialState,
  );
  return (
    <form action={action} className="auth-form">
      <label htmlFor="name">Company name</label>
      <input id="name" name="name" required maxLength={160} />
      <label htmlFor="slug">Workspace address</label>
      <input
        aria-describedby="slug-help"
        id="slug"
        name="slug"
        placeholder="example-company"
        required
        maxLength={63}
      />
      <small id="slug-help">
        Customers will use /chat/your-workspace-address.
      </small>
      <label htmlFor="referencePrefix">Request reference prefix</label>
      <input
        id="referencePrefix"
        name="referencePrefix"
        placeholder="EX"
        required
        maxLength={10}
      />
      <input name="displayName" type="hidden" value={displayName} />
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="button-primary" disabled={pending} type="submit">
        {pending ? "Creating workspace…" : "Create workspace"}
      </button>
    </form>
  );
}
