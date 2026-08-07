import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";
import type { EmployeeAccessContext } from "@/lib/auth/access-records";
import { formatRole } from "@/lib/auth/roles";

type DashboardShellProps = Readonly<{
  access: EmployeeAccessContext;
  children: ReactNode;
}>;

export function DashboardShell({ access, children }: DashboardShellProps) {
  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div>
          <p className="brand">SmartDesk AI</p>
          <p className="organization-name">{access.organization.name}</p>
        </div>
        <DashboardNavigation role={access.membership.role} />
        <div className="account-summary">
          <p className="account-name">{access.membership.displayName}</p>
          <p>{formatRole(access.membership.role)}</p>
          {access.membership.departmentName ? (
            <p>{access.membership.departmentName}</p>
          ) : null}
          <LogoutButton />
        </div>
      </aside>
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
