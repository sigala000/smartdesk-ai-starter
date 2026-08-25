"use client";

import { useState } from "react";

export function DisconnectWhatsAppButton() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function disconnect() {
    if (
      !window.confirm(
        "Disconnect this WhatsApp account? New WhatsApp messages will stop until it is reconnected.",
      )
    )
      return;
    setPending(true);
    const response = await fetch("/api/meta/whatsapp/disconnect", {
      method: "POST",
    });
    const body = (await response.json()) as { error?: { message?: string } };
    setMessage(
      response.ok
        ? "WhatsApp disconnected. Refresh the page to reconnect."
        : (body.error?.message ?? "Disconnect failed."),
    );
    setPending(false);
  }
  return (
    <div className="stack-actions">
      <button
        className="button-secondary"
        disabled={pending}
        onClick={disconnect}
        type="button"
      >
        {pending ? "Disconnecting…" : "Disconnect WhatsApp"}
      </button>
      {message ? <p aria-live="polite">{message}</p> : null}
    </div>
  );
}
