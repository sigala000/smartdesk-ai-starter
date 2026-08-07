import type { EmployeeRole } from "@/lib/auth/roles";

export const permissions = ["dashboard:view", "organization:view"] as const;
export type Permission = (typeof permissions)[number];

const rolePermissions: Readonly<Record<EmployeeRole, readonly Permission[]>> = {
  admin: permissions,
  manager: permissions,
  commercial_officer: ["dashboard:view"],
  technical_officer: ["dashboard:view"],
  project_manager: ["dashboard:view"],
  support_officer: ["dashboard:view"],
  viewer: ["dashboard:view"],
};

export function can(role: EmployeeRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export type NavigationItem = Readonly<{
  href: string;
  label: string;
  permission: Permission;
}>;

const navigationItems: readonly NavigationItem[] = [
  { href: "/dashboard", label: "Overview", permission: "dashboard:view" },
  {
    href: "/dashboard/organization",
    label: "Organization",
    permission: "organization:view",
  },
];

export function navigationForRole(
  role: EmployeeRole,
): readonly NavigationItem[] {
  return navigationItems.filter((item) => can(role, item.permission));
}
