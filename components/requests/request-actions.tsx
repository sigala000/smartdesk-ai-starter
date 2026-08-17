"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { EmployeeRole } from "@/lib/auth/roles";
import { transitionsForRole } from "@/lib/domain/request-transitions";
import { formatRequestStatus } from "@/lib/domain/requests";
import type { EmployeeRequestDetail } from "@/lib/dto/request-dto";

type Props = Readonly<{
  request: EmployeeRequestDetail;
  canAssign: boolean;
  canApproveQuotation: boolean;
  canTransition: boolean;
  canAddNote: boolean;
  canRequestInformation: boolean;
  role: EmployeeRole;
}>;

async function mutation(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<string | null> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.ok) return null;
  const payload: unknown = await response.json().catch(() => null);
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error;
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
    )
      return error.message;
  }
  return "The action could not be completed.";
}

export function RequestActions({
  request,
  canAssign,
  canApproveQuotation,
  canTransition,
  canAddNote,
  canRequestInformation,
  role,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    path: string,
    method: "POST" | "PATCH",
    body: (data: FormData) => unknown,
  ) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const error = await mutation(
      `/api/dashboard/requests/${request.id}/${path}`,
      method,
      body(new FormData(event.currentTarget)),
    );
    setPending(false);
    if (error) setMessage(error);
    else {
      setMessage("Saved.");
      router.refresh();
    }
  }

  return (
    <section
      className="request-actions"
      aria-labelledby="request-actions-title"
    >
      <h2 id="request-actions-title">Actions</h2>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      {canAssign ? (
        <form
          onSubmit={(event) =>
            submit(event, "assignment", "PATCH", (data) => ({
              departmentId: data.get("departmentId") || null,
              memberId: data.get("memberId") || null,
              reason: data.get("reason") || null,
              expectedUpdatedAt: request.updatedAt,
            }))
          }
        >
          <h3>Assignment</h3>
          <label>
            Department
            <select name="departmentId" defaultValue="">
              <option value="">Select department</option>
              {request.departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Employee
            <select name="memberId" defaultValue="">
              <option value="">No primary employee</option>
              {request.assignableMembers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reason
            <input name="reason" maxLength={500} />
          </label>
          <button disabled={pending}>Save assignment</button>
        </form>
      ) : null}
      {canTransition &&
      transitionsForRole(role, request.status, request.requestType).length >
        0 ? (
        <form
          onSubmit={(event) =>
            submit(event, "status-transitions", "POST", (data) => ({
              newStatus: data.get("newStatus"),
              reason: data.get("reason") || null,
              expectedUpdatedAt: request.updatedAt,
            }))
          }
        >
          <h3>Change status</h3>
          <label>
            New status
            <select name="newStatus">
              {transitionsForRole(
                role,
                request.status,
                request.requestType,
              ).map((status) => (
                <option key={status} value={status}>
                  {formatRequestStatus(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reason
            <input name="reason" maxLength={500} />
          </label>
          <button disabled={pending}>Update status</button>
        </form>
      ) : null}
      {canAddNote ? (
        <form
          onSubmit={(event) =>
            submit(event, "notes", "POST", (data) => ({
              content: data.get("content"),
            }))
          }
        >
          <h3>Internal note</h3>
          <label>
            Employee-only note
            <textarea name="content" required maxLength={4000} />
          </label>
          <button disabled={pending}>Add note</button>
        </form>
      ) : null}
      {canRequestInformation ? (
        <form
          onSubmit={(event) =>
            submit(event, "request-information", "POST", (data) => ({
              question: data.get("question"),
              expectedUpdatedAt: request.updatedAt,
            }))
          }
        >
          <h3>Request more information</h3>
          <label>
            Customer-visible question
            <textarea name="question" required maxLength={2000} />
          </label>
          <button disabled={pending}>Record question</button>
          <small>
            The question is saved in the linked customer conversation.
          </small>
        </form>
      ) : null}
      {canApproveQuotation &&
      request.attachments.some(
        (item) => item.mimeType === "application/pdf" && !item.approvedAt,
      ) ? (
        <div>
          <h3>Approve quotation evidence</h3>
          {request.attachments
            .filter(
              (item) => item.mimeType === "application/pdf" && !item.approvedAt,
            )
            .map((item) => (
              <button
                key={item.id}
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  const error = await mutation(
                    `/api/dashboard/requests/${request.id}/quotations/${item.id}/approve`,
                    "POST",
                    {},
                  );
                  setPending(false);
                  setMessage(error ?? "Quotation approved.");
                  if (!error) router.refresh();
                }}
              >
                Approve {item.filename} as quotation
              </button>
            ))}
        </div>
      ) : null}
    </section>
  );
}
