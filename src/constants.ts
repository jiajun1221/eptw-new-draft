import type { PermitStatus, Role, User } from "./types";
export const USERS: User[] = [
  { id: "req-1", name: "Aisha Rahman", email: "aisha@contractor.example", role: "CONTRACTOR_REQUESTOR", authMethod: "PASSWORD", company: "Acme Engineering" },
  { id: "req-2", name: "Daniel Tan", email: "daniel@vendor.example", role: "CONTRACTOR_REQUESTOR", authMethod: "PASSWORD", company: "Vendor Services" },
  { id: "ir-1", name: "Irene Lim", email: "irene@micron.com", role: "MICRON_STAFF", authMethod: "SSO" },
  { id: "mt-1", name: "Marcus Teo", email: "marcus@micron.com", role: "MICRON_STAFF", group: "Facilities MT", authMethod: "SSO" },
  { id: "ms-2", name: "Nur Aisyah", email: "aisyah@micron.com", role: "MICRON_STAFF", group: "Facilities MT", authMethod: "SSO" },
  { id: "ms-3", name: "Ethan Wong", email: "ethan.wong@micron.com", role: "MICRON_STAFF", group: "Facilities MT", authMethod: "SSO" },
  { id: "ms-4", name: "Mei Chen", email: "mei.chen@micron.com", role: "MICRON_STAFF", group: "Facilities MT", authMethod: "SSO" },
  { id: "ms-5", name: "Ravi Kumar", email: "ravi.kumar@micron.com", role: "MICRON_STAFF", group: "Facilities MT", authMethod: "SSO" },
  { id: "pm-1", name: "Priya Menon", email: "priya@contractor.example", role: "CONTRACTOR_PM", authMethod: "PASSWORD", company: "Acme Engineering" },
  { id: "admin-1", name: "Micron Administrator", email: "micronadmin@site.example", role: "SUPER_ADMIN", authMethod: "PASSWORD" },
  { id: "user-admin-1", name: "Vendor Administrator", email: "vendoradmin@site.example", role: "USER_ADMIN", authMethod: "PASSWORD" },
  { id: "assessor-1", name: "Permit Assessor", email: "assessor@site.example", role: "ASSESSOR", authMethod: "PASSWORD" },
];
export const ROLE_LABELS: Record<Role, string> = { SUPER_ADMIN: "Micron Admin", USER_ADMIN: "Vendor Admin", MICRON_STAFF: "Micron Staff", CONTRACTOR_REQUESTOR: "Contractor Requestor", CONTRACTOR_PM: "Contractor PM", ASSESSOR: "Assessor" };
export const STATUS_LABELS: Record<PermitStatus, string> = { DRAFT: "Draft", INDIVIDUAL_REVIEW: "Individual review", MT_REVIEW: "MT Group review", PM_REVIEW: "PM review", CHANGES_REQUESTED: "Changes requested", APPROVED: "Approved", ACTIVE: "Active", SUSPENDED: "Suspended", CLOSURE_REQUESTED: "Closure requested", CLOSED: "Closed", REJECTED: "Rejected", CANCELLED: "Cancelled", EXPIRED: "Expired", SUPERSEDED: "Superseded" };
export const SITES = ["F10A1", "F10A2", "F10N"];
export const DISCIPLINES = ["AMHS", "Facilities", "IT"];
export const SAFETY_DECLARATIONS = ["Risk assessment reviewed", "Workers briefed", "Area barricaded"];
