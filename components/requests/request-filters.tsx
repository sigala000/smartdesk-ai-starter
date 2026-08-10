import type { EmployeeRequestDetail } from "@/lib/dto/request-dto";
import { requestStatuses } from "@/lib/domain/requests";

type Props = Readonly<{
  values: Readonly<Record<string, string | undefined>>;
  departments: EmployeeRequestDetail["departments"];
  members: EmployeeRequestDetail["assignableMembers"];
}>;

export function RequestFilters({ values, departments, members }: Props) {
  return (
    <form className="request-filters" method="get">
      <label>
        Search
        <input
          name="search"
          defaultValue={values.search}
          placeholder="Reference, customer, title or location"
          minLength={2}
          maxLength={100}
        />
      </label>
      <label>
        Status
        <select name="status" defaultValue={values.status ?? ""}>
          <option value="">All statuses</option>
          {requestStatuses.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Department
        <select name="departmentId" defaultValue={values.departmentId ?? ""}>
          <option value="">All departments</option>
          {departments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Assignee
        <select
          name="assignedMemberId"
          defaultValue={values.assignedMemberId ?? ""}
        >
          <option value="">All assignees</option>
          {members.map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName}
            </option>
          ))}
        </select>
      </label>
      <div className="filter-actions">
        <button type="submit">Apply filters</button>
        <Link href="/dashboard/requests">Clear</Link>
      </div>
    </form>
  );
}
import Link from "next/link";
