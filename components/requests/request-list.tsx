import Link from "next/link";

import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { formatRequestStatus } from "@/lib/domain/requests";
import type { RequestListResult } from "@/lib/dto/request-dto";

type Props = Readonly<{ result: RequestListResult; nextHref: string | null }>;

export function RequestList({ result, nextHref }: Props) {
  if (result.items.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">
          <DashboardIcon name="empty" size={42} />
        </span>
        <h2>No requests found</h2>
        <p>Try clearing one or more filters.</p>
        <Link className="button button-secondary" href="/dashboard/requests">
          Clear all filters
        </Link>
      </div>
    );
  }
  return (
    <>
      <div className="request-table-wrap">
        <table className="request-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Status</th>
              <th>Assignment</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/dashboard/requests/${item.id}`}>
                    {item.referenceNumber}
                  </Link>
                  <small>{item.title}</small>
                </td>
                <td>{item.customerName}</td>
                <td>{item.serviceName}</td>
                <td>
                  <span className="status-pill">
                    {formatRequestStatus(item.status)}
                  </span>
                </td>
                <td>
                  {item.assignedMemberName ??
                    item.departmentName ??
                    "Unassigned"}
                </td>
                <td>
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleDateString("en-GB")}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nextHref ? (
        <div className="pagination">
          <Link href={nextHref}>Next page</Link>
        </div>
      ) : null}
    </>
  );
}
