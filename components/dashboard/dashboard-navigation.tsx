"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { navigationForRole } from "@/lib/auth/permissions";
import type { EmployeeRole } from "@/lib/auth/roles";

type DashboardNavigationProps = Readonly<{ role: EmployeeRole }>;

export function DashboardNavigation({ role }: DashboardNavigationProps) {
  const pathname = usePathname();
  const icons: Readonly<
    Record<
      string,
      "overview" | "requests" | "handoffs" | "organization" | "whatsapp"
    >
  > = {
    "/dashboard": "overview",
    "/dashboard/requests": "requests",
    "/dashboard/handoffs": "handoffs",
    "/dashboard/organization": "organization",
    "/dashboard/whatsapp": "whatsapp",
  };
  return (
    <nav aria-label="Employee dashboard" className="dashboard-nav">
      {navigationForRole(role).map((item) => (
        <Link
          aria-current={
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))
              ? "page"
              : undefined
          }
          className={
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))
              ? "active"
              : undefined
          }
          href={item.href}
          key={item.href}
        >
          <span className="dashboard-nav-icon">
            <DashboardIcon name={icons[item.href]} />
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
