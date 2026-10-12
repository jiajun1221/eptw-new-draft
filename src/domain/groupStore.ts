import type { User } from "./types";

export type StoredMtGroup = { id: string; number: number; name: string; site: string; canClose: boolean; editable: boolean; memberIds?: string[] };
export const GROUP_KEY = "eptw-mt-groups:v2";
export const groupSeeds: StoredMtGroup[] = [
  { id: "group-facilities", number: 1, name: "Facilities MT", site: "F10A1", canClose: true, editable: true, memberIds: ["mt-1", "ir-1", "ms-2", "ms-3", "ms-4", "ms-5"] },
  { id: "group-amhs", number: 2, name: "F10A1 AMHS Engineer", site: "F10A1", canClose: false, editable: true, memberIds: ["ir-1"] },
  { id: "group-building", number: 3, name: "F10A1 Building Services Manager", site: "F10A1", canClose: false, editable: false, memberIds: [] },
  { id: "group-electrical", number: 4, name: "F10A1 Electrical Manager", site: "F10A1", canClose: false, editable: false, memberIds: [] },
];
export function readGroups(): StoredMtGroup[] { try { const value = localStorage.getItem(GROUP_KEY); const parsed = value ? JSON.parse(value) as StoredMtGroup[] : groupSeeds; return parsed.map((group) => ({ ...group, editable: group.editable ?? groupSeeds.find((seed) => seed.id === group.id)?.editable ?? false, memberIds: group.memberIds ?? [] })); } catch { return groupSeeds; } }
export function saveGroups(groups: StoredMtGroup[]) { localStorage.setItem(GROUP_KEY, JSON.stringify(groups)); }
export function isGroupMember(user: User, groupName: string) { return readGroups().some((group) => group.name === groupName && group.memberIds?.includes(user.id)) || user.group === groupName; }
export function canCloseForGroup(user: User, groupName: string) { return readGroups().some((group) => group.name === groupName && group.canClose && group.memberIds?.includes(user.id)); }
