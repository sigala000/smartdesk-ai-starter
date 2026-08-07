export const employeeRoles = [
  "admin",
  "manager",
  "commercial_officer",
  "technical_officer",
  "project_manager",
  "support_officer",
  "viewer",
] as const;

export type EmployeeRole = (typeof employeeRoles)[number];

export function isEmployeeRole(value: string): value is EmployeeRole {
  return employeeRoles.some((role) => role === value);
}

export function formatRole(role: EmployeeRole): string {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
