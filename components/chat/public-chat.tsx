"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  editableFields,
  publicActions,
} from "@/lib/domain/conversation-workflow";
import type { PublicConversationView } from "@/lib/dto/public-conversation-dto";
import { AttachmentUploader } from "@/components/attachments/attachment-uploader";

type ApiError = { error?: { message?: string } };
const actionLabels: Record<(typeof publicActions)[number], string> = {
  request_quotation: "Request a quotation",
  request_site_visit: "Request a site visit",
  ask_about_services: "Ask about services",
  check_request_status: "Check an existing request",
  report_problem: "Report a problem",
  speak_to_employee: "Speak with an employee",
};
const fieldLabels: Record<(typeof editableFields)[number], string> = {
  service: "Service",
  customer_name: "Full name",
  phone: "Contact number",
  description: "Description",
  location: "Location",
  email: "Email",
  preferred_start_date: "Preferred starting date",
  budget: "Budget range",
};

async function jsonRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const payload = (await response.json().catch(() => ({}))) as ApiError &
    Record<string, unknown>;
  if (!response.ok)
    throw new Error(payload.error?.message ?? "The chat could not be updated.");
  return payload;
}

export function PublicChat({
  organizationSlug,
}: Readonly<{ organizationSlug: string }>) {
  const [conversation, setConversation] =
    useState<PublicConversationView | null>(null);
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const confirmationIdempotencyKey = useRef<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const payload = await jsonRequest("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationSlug, locale: "en" }),
      });
      const created = payload.conversation as { id: string };
      const view = await jsonRequest(`/api/conversations/${created.id}`);
      setConversation(view.conversation as PublicConversationView);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chat unavailable.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const payload = await jsonRequest("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationSlug, locale: "en" }),
        });
        const created = payload.conversation as { id: string };
        const view = await jsonRequest(`/api/conversations/${created.id}`);
        if (active)
          setConversation(view.conversation as PublicConversationView);
      } catch (reason) {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "Chat unavailable.",
          );
      } finally {
        if (active) setPending(false);
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [organizationSlug]);

  async function send(body: object) {
    if (!conversation) return;
    setPending(true);
    setError(null);
    setNonce(null);
    try {
      const payload = await jsonRequest(
        `/api/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientMessageId: crypto.randomUUID(),
            ...body,
          }),
        },
      );
      setConversation(payload.conversation as PublicConversationView);
      setAnswer("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your message was saved, but the next step could not load. Retry safely.",
      );
    } finally {
      setPending(false);
    }
  }

  async function prepareSummary() {
    if (!conversation) return;
    setPending(true);
    setError(null);
    try {
      const payload = await jsonRequest(
        `/api/conversations/${conversation.id}/summary`,
        { method: "POST" },
      );
      setConversation(payload.conversation as PublicConversationView);
      setNonce(payload.confirmationNonce as string);
      confirmationIdempotencyKey.current = crypto.randomUUID();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Summary unavailable.",
      );
    } finally {
      setPending(false);
    }
  }

  async function confirm() {
    if (!conversation || !nonce) return;
    setPending(true);
    setError(null);
    try {
      const payload = await jsonRequest(
        `/api/conversations/${conversation.id}/confirm-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmation: true,
            confirmationNonce: nonce,
            idempotencyKey: (confirmationIdempotencyKey.current ??=
              crypto.randomUUID()),
          }),
        },
      );
      const request = payload.request as { referenceNumber: string };
      setReference(request.referenceNumber);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Confirmation failed safely. Please retry.",
      );
    } finally {
      setPending(false);
    }
  }

  async function edit(field: (typeof editableFields)[number]) {
    if (!conversation) return;
    const value = window.prompt(
      `Enter the new ${fieldLabels[field].toLowerCase()}:`,
    );
    if (!value) return;
    setPending(true);
    setError(null);
    setNonce(null);
    try {
      const payload = await jsonRequest(
        `/api/conversations/${conversation.id}/draft`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field,
            value,
            expectedVersion: conversation.draft.version,
          }),
        },
      );
      setConversation(payload.conversation as PublicConversationView);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Edit failed.");
    } finally {
      setPending(false);
    }
  }

  if (pending && !conversation)
    return (
      <div className="chat-card" aria-busy="true">
        <h1>BuildPro Cameroon</h1>
        <p>Opening the virtual assistant…</p>
      </div>
    );
  if (!conversation)
    return (
      <div className="chat-card error-panel">
        <h1>Chat unavailable</h1>
        <p>{error}</p>
        <button onClick={() => void start()}>Start again</button>
      </div>
    );

  const draft = conversation.draft;
  return (
    <section className="chat-card" aria-busy={pending}>
      <header>
        <p className="eyebrow">BuildPro Cameroon</p>
        <h1>Virtual request assistant</h1>
        <p>
          I’m a virtual assistant. I collect your request for a BuildPro
          employee; I do not calculate prices or promise schedules.
        </p>
      </header>
      <div className="chat-transcript" aria-live="polite">
        {conversation.messages.map((message) => (
          <article
            className={`chat-message ${message.senderType}`}
            key={message.id}
          >
            <strong>
              {message.senderType === "customer"
                ? "You"
                : message.senderType === "employee"
                  ? "BuildPro employee"
                  : "Virtual assistant"}
            </strong>
            <p>{message.content}</p>
          </article>
        ))}
      </div>
      {error ? (
        <p className="form-message error-panel" role="alert">
          {error}
        </p>
      ) : null}
      {reference ? (
        <div className="success-panel">
          <h2>Request submitted</h2>
          <p>
            Your reference is <strong>{reference}</strong>.
          </p>
          <p>
            Keep it safe. The reference alone cannot be used to view private
            request information.
          </p>
        </div>
      ) : null}
      {!reference && draft.stage === "choose_action" ? (
        <>
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void send({ kind: "message", message: answer });
            }}
          >
            <label htmlFor="natural-chat-message">
              Describe what you need, or choose an option below.
            </label>
            <input
              id="natural-chat-message"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={pending}
              maxLength={2000}
              required
            />
            <button disabled={pending}>Send message</button>
          </form>
          <div className="chat-options">
            {publicActions.map((action) => (
              <button
                disabled={pending}
                key={action}
                onClick={() => void send({ kind: "action", action })}
              >
                {actionLabels[action]}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {!reference && draft.stage === "choose_service" ? (
        <div className="chat-options">
          {conversation.services.map((service) => (
            <button
              disabled={pending}
              key={service.id}
              onClick={() => void send({ kind: "answer", value: service.id })}
            >
              {service.name}
            </button>
          ))}
        </div>
      ) : null}
      {!reference &&
      ![
        "choose_action",
        "choose_service",
        "review",
        "confirmed",
        "cancelled",
      ].includes(draft.stage) ? (
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void send({ kind: "answer", value: answer });
          }}
        >
          <label htmlFor="chat-answer">{conversation.prompt}</label>
          <input
            id="chat-answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={pending}
            required
          />
          <div className="chat-form-actions">
            <button disabled={pending}>Send answer</button>
            {["collect_email", "collect_start", "collect_budget"].includes(
              draft.stage,
            ) ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void send({ kind: "skip" })}
              >
                Skip optional question
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
      {!reference && draft.stage === "review" ? (
        <div className="draft-summary">
          <h2>Review your request</h2>
          <dl>
            <div>
              <dt>Full name</dt>
              <dd>{draft.customerName}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{draft.phone}</dd>
            </div>
            <div>
              <dt>Service</dt>
              <dd>{draft.serviceName}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{draft.description}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{draft.location}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{draft.email ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Preferred start</dt>
              <dd>{draft.preferredStartDate ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Budget</dt>
              <dd>
                {draft.budgetMin == null
                  ? "Not provided"
                  : `${draft.budgetMin.toLocaleString()}–${draft.budgetMax?.toLocaleString()} XAF`}
              </dd>
            </div>
          </dl>
          <AttachmentUploader
            target={{ kind: "conversation", conversationId: conversation.id }}
            onBusyChange={setAttachmentBusy}
          />
          <div className="chat-options">
            {editableFields.map((field) => (
              <button
                key={field}
                disabled={pending}
                onClick={() => void edit(field)}
              >
                Edit {fieldLabels[field]}
              </button>
            ))}
          </div>
          {nonce ? (
            <button
              disabled={pending || attachmentBusy}
              onClick={() => void confirm()}
            >
              Confirm and submit request
            </button>
          ) : (
            <button
              disabled={pending || attachmentBusy}
              onClick={() => void prepareSummary()}
            >
              Prepare confirmation
            </button>
          )}{" "}
          <button
            className="secondary"
            disabled={pending || attachmentBusy}
            onClick={() => void send({ kind: "cancel" })}
          >
            Cancel draft
          </button>
        </div>
      ) : null}
      {!reference && draft.stage === "cancelled" ? (
        <div className="empty-state">
          <h2>Draft cancelled</h2>
          <p>No request was created.</p>
          <button onClick={() => void start()}>Start a new chat</button>
        </div>
      ) : null}
      {pending ? <p role="status">Saving…</p> : null}
    </section>
  );
}
