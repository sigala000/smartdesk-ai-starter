"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  editableFields,
  publicActions,
} from "@/lib/domain/conversation-workflow";
import type { PublicConversationView } from "@/lib/dto/public-conversation-dto";
import { AttachmentUploader } from "@/components/attachments/attachment-uploader";
import { messages, type AppLocale } from "@/lib/i18n/messages";

type ApiError = { error?: { message?: string } };

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
  locale,
}: Readonly<{ organizationSlug: string; locale: AppLocale }>) {
  const copy = messages[locale];
  const [conversation, setConversation] =
    useState<PublicConversationView | null>(null);
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const confirmationIdempotencyKey = useRef<string | null>(null);
  const conversationStorageKey = `smartdesk:${organizationSlug}:conversation-id`;

  const rememberConversation = useCallback(
    (id: string) => {
      try {
        window.localStorage.setItem(conversationStorageKey, id);
      } catch {
        // Storage can be unavailable in privacy-restricted browsers. The
        // HttpOnly access cookie still protects the active in-memory session.
      }
    },
    [conversationStorageKey],
  );

  const recalledConversationId = useCallback(() => {
    try {
      return window.localStorage.getItem(conversationStorageKey);
    } catch {
      return null;
    }
  }, [conversationStorageKey]);

  const createConversation = useCallback(async () => {
    const payload = await jsonRequest("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationSlug, locale }),
    });
    const created = payload.conversation as { id: string };
    rememberConversation(created.id);
    return jsonRequest(`/api/conversations/${created.id}`);
  }, [locale, organizationSlug, rememberConversation]);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const view = await createConversation();
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
        const recalledId = recalledConversationId();
        let view: Record<string, unknown>;
        if (recalledId) {
          try {
            view = await jsonRequest(`/api/conversations/${recalledId}`);
          } catch {
            view = await createConversation();
          }
        } else {
          view = await createConversation();
        }
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
  }, [createConversation, recalledConversationId]);

  useEffect(() => {
    if (!conversation?.handoffStatus) return;
    const timer = window.setInterval(() => {
      void jsonRequest(`/api/conversations/${conversation.id}`)
        .then((payload) =>
          setConversation(payload.conversation as PublicConversationView),
        )
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [conversation?.id, conversation?.handoffStatus]);

  async function requestHuman() {
    if (!conversation) return;
    setPending(true);
    setError(null);
    try {
      await jsonRequest(`/api/conversations/${conversation.id}/handoffs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestId: crypto.randomUUID(),
          reason: "Customer explicitly requested human support.",
        }),
      });
      const payload = await jsonRequest(
        `/api/conversations/${conversation.id}`,
      );
      setConversation(payload.conversation as PublicConversationView);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Human support could not be requested.",
      );
    } finally {
      setPending(false);
    }
  }

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
      `Enter the new ${copy.fields[field].toLowerCase()}:`,
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
        <p>{copy.opening}</p>
      </div>
    );
  if (!conversation)
    return (
      <div className="chat-card error-panel">
        <h1>{copy.unavailable}</h1>
        <p>{error}</p>
        <button onClick={() => void start()}>{copy.restart}</button>
      </div>
    );

  const draft = conversation.draft;
  return (
    <section className="chat-card" aria-busy={pending}>
      <header>
        <p className="eyebrow">BuildPro Cameroon</p>
        <h1>{copy.virtualAssistant}</h1>
        <p>{copy.introduction}</p>
      </header>
      <div
        className="chat-transcript"
        aria-label="Conversation transcript"
        aria-live="polite"
        role="log"
        tabIndex={0}
      >
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
      {conversation.handoffStatus ? (
        <div className="success-panel" role="status">
          <h2>
            {conversation.handoffStatus === "active"
              ? "A BuildPro employee has joined"
              : conversation.handoffStatus === "assigned"
                ? "Your conversation is assigned"
                : "Human support requested"}
          </h2>
          <p>
            {conversation.handoffStatus === "active"
              ? "Messages now go to the employee. The virtual assistant is paused."
              : "Your messages are saved for the support team. We will not claim an employee has joined until one accepts."}
          </p>
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void send({ kind: "message", message: answer });
            }}
          >
            <label htmlFor="handoff-message">
              Message for the support team
            </label>
            <input
              id="handoff-message"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={pending}
              maxLength={2000}
              required
            />
            <button disabled={pending}>Send message</button>
          </form>
        </div>
      ) : null}
      {!conversation.handoffStatus &&
      !reference &&
      draft.stage === "choose_action" ? (
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
                onClick={() =>
                  action === "speak_to_employee"
                    ? void requestHuman()
                    : void send({ kind: "action", action })
                }
              >
                {copy.actions[action]}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {!conversation.handoffStatus &&
      !reference &&
      draft.stage === "choose_service" ? (
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
      {!conversation.handoffStatus &&
      !reference &&
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
      {!conversation.handoffStatus && !reference && draft.stage === "review" ? (
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
                Edit {copy.fields[field]}
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
      {!conversation.handoffStatus &&
      !reference &&
      draft.stage === "cancelled" ? (
        <div className="empty-state">
          <h2>Draft cancelled</h2>
          <p>No request was created.</p>
          <button onClick={() => void start()}>Start a new chat</button>
        </div>
      ) : null}
      {!conversation.handoffStatus ? (
        <div className="chat-options">
          <a
            className="secondary"
            href={`/status?conversationId=${encodeURIComponent(conversation.id)}`}
          >
            Check an existing request securely
          </a>
          <button
            className="secondary"
            disabled={pending}
            onClick={() => void requestHuman()}
          >
            {copy.requestHuman}
          </button>
        </div>
      ) : null}
      {pending ? <p role="status">{copy.saving}</p> : null}
    </section>
  );
}
