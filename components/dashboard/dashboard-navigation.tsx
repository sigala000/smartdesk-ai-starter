import Link from "next/link";

import { navigationForRole } from "@/lib/auth/permissions";
import type { EmployeeRole } from "@/lib/auth/roles";

type DashboardNavigationProps = Readonly<{ role: EmployeeRole }>;

export function DashboardNavigation({ role }: DashboardNavigationProps) {
  return (
    <nav aria-label="Employee dashboard" className="dashboard-nav">
      {navigationForRole(role).map((item) => (
        <Link href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
