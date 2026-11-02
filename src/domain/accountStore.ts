import type { User } from "./types";

const profileKey = (userId: string) => `eptw-account-profile:${userId}`;
const passwordKey = (userId: string) => `eptw-password-updated:${userId}`;

export function readAccountProfile(user: User): User {
  try {
    const saved = JSON.parse(localStorage.getItem(profileKey(user.id)) ?? "null") as { name?: string; sites?: string[] } | null;
    if (!saved) return user;
    return { ...user, name: saved.name?.trim() || user.name, sites: saved.sites?.length ? saved.sites : user.sites };
  } catch {
    return user;
  }
}

export function saveAccountProfile(user: User): User {
  const profile = { name: user.name.trim(), sites: user.sites ?? [] };
  localStorage.setItem(profileKey(user.id), JSON.stringify(profile));
  return { ...user, ...profile };
}

export function recordPasswordChange(userId: string) {
  // Record only that a password changed; never store the password itself.
  localStorage.setItem(passwordKey(userId), new Date().toISOString());
}
