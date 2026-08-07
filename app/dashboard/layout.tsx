import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireEmployeeAccess } from "@/lib/auth/require-access";

type DashboardLayoutProps = Readonly<{ children: ReactNode }>;

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const access = await requireEmployeeAccess("/dashboard");
  return <DashboardShell access={access}>{children}</DashboardShell>;
}
