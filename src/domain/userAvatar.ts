import type { Role } from "./types";

export const userInitials = (name: string) => name
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join("")
  .toUpperCase();

const ROLE_AVATAR_CLASSES: Record<string, string> = {
  SUPER_ADMIN: "avatar-role-micron-admin",
  USER_ADMIN: "avatar-role-vendor-admin",
  MICRON_SUPERVISOR: "avatar-role-micron-supervisor",
  MICRON_STAFF: "avatar-role-micron-staff",
  CONTRACTOR_REQUESTOR: "avatar-role-contractor-requestor",
  CONTRACTOR_PM: "avatar-role-contractor-pm",
  ASSESSOR: "avatar-role-assessor",
};

export const userAvatarColorClass = (role: Role) => ROLE_AVATAR_CLASSES[role] ?? "avatar-role-default";
