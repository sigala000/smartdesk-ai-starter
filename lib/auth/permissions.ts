import type { EmployeeRole } from "@/lib/auth/roles";

export const permissions = [
  "dashboard:view",
  "organization:view",
  "requests:list",
  "requests:view",
  "requests:assign",
  "requests:status:update",
  "requests:notes:view",
  "requests:notes:create",
  "requests:request_information",
  "attachments:view",
  "attachments:create",
  "attachments:invalidate",
] as const;
export type Permission = (typeof permissions)[number];

const rolePermissions: Readonly<Record<EmployeeRole, readonly Permission[]>> = {
  admin: permissions,
  manager: permissions,
  commercial_officer: [
    "dashboard:view",
    "requests:list",
    "requests:view",
    "requests:assign",
    "requests:status:update",
    "requests:notes:view",
    "requests:notes:create",
    "requests:request_information",
    "attachments:view",
    "attachments:create",
    "attachments:invalidate",
  ],
  technical_officer: [
    "dashboard:view",
    "requests:list",
    "requests:view",
    "requests:status:update",
    "requests:notes:view",
    "requests:notes:create",
    "requests:request_information",
    "attachments:view",
    "attachments:create",
    "attachments:invalidate",
  ],
  project_manager: [
    "dashboard:view",
    "requests:list",
    "requests:view",
    "requests:status:update",
    "requests:notes:view",
    "requests:notes:create",
    "requests:request_information",
    "attachments:view",
    "attachments:create",
    "attachments:invalidate",
  ],
  support_officer: [
    "dashboard:view",
    "requests:list",
    "requests:view",
    "requests:status:update",
    "requests:notes:view",
    "requests:notes:create",
    "requests:request_information",
    "attachments:view",
    "attachments:create",
    "attachments:invalidate",
  ],
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
    href: "/dashboard/requests",
    label: "Requests",
    permission: "requests:list",
  },
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
