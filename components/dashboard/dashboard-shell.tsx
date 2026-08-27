import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
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
        <div className="sidebar-brand">
          <span className="product-mark-icon">
            <DashboardIcon name="brand" size={22} />
          </span>
          <div>
            <p className="brand">SmartDesk AI</p>
          </div>
        </div>
        <div className="workspace-switcher" aria-label="Current workspace">
          <span>Workspace</span>
          <strong>{access.organization.name}</strong>
        </div>
        <DashboardNavigation role={access.membership.role} />
        <div className="account-summary">
          <span className="account-avatar">
            <DashboardIcon name="user" size={18} />
          </span>
          <div>
            <p className="account-name">{access.membership.displayName}</p>
            <p>{access.user.email ?? formatRole(access.membership.role)}</p>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="dashboard-main" id="main-content">
        <header className="dashboard-topbar">
          <form action="/dashboard/requests" className="dashboard-search">
            <DashboardIcon name="search" size={18} />
            <label className="sr-only" htmlFor="dashboard-search">
              Search requests
            </label>
            <input
              id="dashboard-search"
              name="search"
              placeholder="Search requests…"
              minLength={2}
              maxLength={100}
            />
            <button className="sr-only" type="submit">
              Search requests
            </button>
          </form>
          <span className="topbar-role">
            {formatRole(access.membership.role)}
          </span>
        </header>
        <header className="dashboard-mobile-header">
          <span className="product-mark-icon">
            <DashboardIcon name="brand" size={20} />
          </span>
          <div>
            <strong>{access.organization.name}</strong>
            <small>{formatRole(access.membership.role)}</small>
          </div>
          <LogoutButton />
        </header>
        {children}
      </main>
    </div>
  );
}
