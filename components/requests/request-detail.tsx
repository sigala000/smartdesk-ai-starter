import { formatRequestStatus } from "@/lib/domain/requests";
import type { EmployeeRequestDetail } from "@/lib/dto/request-dto";
import { AttachmentUploader } from "@/components/attachments/attachment-uploader";

export function RequestDetail({
  request,
}: Readonly<{ request: EmployeeRequestDetail }>) {
  return (
    <div className="request-detail-grid">
      <section className="detail-card">
        <h2>Request</h2>
        <dl>
          <div>
            <dt>Reference</dt>
            <dd>{request.referenceNumber}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{formatRequestStatus(request.status)}</dd>
          </div>
          <div>
            <dt>Service</dt>
            <dd>{request.serviceName}</dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>{request.priority}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{request.location ?? "Not provided"}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{request.departmentName ?? "Unassigned"}</dd>
          </div>
          <div>
            <dt>Employee</dt>
            <dd>{request.assignedMemberName ?? "Unassigned"}</dd>
          </div>
        </dl>
        <h3>Description</h3>
        <p>{request.description ?? "No description."}</p>
      </section>
      <section className="detail-card">
        <h2>Customer</h2>
        <p>{request.customerName}</p>
        <p>{request.customerPhone ?? "No phone"}</p>
        <p>{request.customerEmail ?? "No email"}</p>
      </section>
      <section className="detail-card">
        <h2>Status history</h2>
        {request.statusHistory.length ? (
          <ol className="timeline">
            {request.statusHistory.map((item) => (
              <li key={item.id}>
                <strong>
                  {formatRequestStatus(
                    item.toStatus as Parameters<typeof formatRequestStatus>[0],
                  )}
                </strong>
                <span>
                  {item.changedByName ?? item.changedByType} ·{" "}
                  {new Date(item.createdAt).toLocaleString("en-GB")}
                </span>
                {item.reason ? <p>{item.reason}</p> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p>No status history.</p>
        )}
      </section>
      <section className="detail-card">
        <h2>Assignment history</h2>
        {request.assignmentHistory.length ? (
          <ol className="timeline">
            {request.assignmentHistory.map((item) => (
              <li key={item.id}>
                <strong>
                  {item.memberName ?? item.departmentName ?? "Unassigned"}
                </strong>
                <span>
                  Assigned by {item.assignedByName ?? "System"} ·{" "}
                  {new Date(item.assignedAt).toLocaleString("en-GB")}
                </span>
                {item.reason ? <p>{item.reason}</p> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p>No assignment history.</p>
        )}
      </section>
      <section className="detail-card employee-only">
        <h2>Internal notes</h2>
        {request.internalNotes.length ? (
          request.internalNotes.map((note) => (
            <article key={note.id}>
              <p>{note.content}</p>
              <small>
                {note.authorName} ·{" "}
                {new Date(note.createdAt).toLocaleString("en-GB")}
              </small>
            </article>
          ))
        ) : (
          <p>No internal notes.</p>
        )}
      </section>
      <section className="detail-card">
        <h2>Customer conversation</h2>
        {request.messages.length ? (
          request.messages.map((message) => (
            <article key={message.id}>
              <strong>{message.senderName ?? message.senderType}</strong>
              <p>{message.content}</p>
              <small>
                {new Date(message.createdAt).toLocaleString("en-GB")}
              </small>
            </article>
          ))
        ) : (
          <p>No linked customer conversation.</p>
        )}
      </section>
      <section className="detail-card">
        <h2>Attachments</h2>
        <AttachmentUploader
          target={{ kind: "request", requestId: request.id }}
          initialAttachments={request.attachments}
        />
      </section>
    </div>
  );
}
