import { currentRevision, type Permit, type User } from "./types";
import { readGroups } from "./groupStore";

export type SectionEditAccess = { assessor?: boolean; mtGroupIds?: string[] };
export function canEditTemplateSection(permit: Permit, actor: User, access?: SectionEditAccess) {
  const revision = currentRevision(permit);
  if (["CLOSED", "CANCELLED", "REJECTED", "EXPIRED", "SUPERSEDED"].includes(revision.status)) return false;
  if (actor.role === "ASSESSOR") return Boolean(access?.assessor && revision.data.assessorIds?.includes(actor.id));
  if (actor.role !== "MICRON_STAFF") return false;
  const assigned = revision.data.mtGroups?.length ? revision.data.mtGroups : [revision.data.mtGroup];
  return readGroups().some((group) => access?.mtGroupIds?.includes(group.id) && assigned.includes(group.name) && group.memberIds?.includes(actor.id));
}

type AccessField = { id: string; type: string; options?: string[]; childTemplateIds?: (string | null)[] };
type AccessSection = { id: string; fields: AccessField[]; editAccess?: SectionEditAccess };
type AccessTemplate = { id: string; kind: string; sections?: AccessSection[] };
export function sectionUpdateKeys(permit: Permit, sectionId: string, actor: User, next: Record<string, string | boolean | string[]>) {
  const templates = JSON.parse(localStorage.getItem("eptw-templates:v4") ?? "[]") as AccessTemplate[];
  const revision = currentRevision(permit);
  const section = templates.find((template) => template.id === revision.data.templateId)?.sections?.find((item) => item.id === sectionId);
  if (!section || !canEditTemplateSection(permit, actor, section.editAccess)) throw new Error("You do not have permission to edit this section.");
  const keys = new Set<string>();
  for (const field of section.fields) {
    keys.add(field.id);
    field.options?.forEach((_, index) => keys.add(`${field.id}:specify:${index}`));
    if (field.type !== "MULTI_CHECKBOX") continue;
    const selected = next[field.id] ?? revision.data.customFields?.[field.id];
    if (!Array.isArray(selected)) continue;
    for (const index of selected) {
      const child = templates.find((template) => template.kind === "CHILD" && template.id === field.childTemplateIds?.[Number(index)]);
      child?.sections?.forEach((childSection) => childSection.fields.forEach((childField) => {
        const key = `${field.id}:${index}:${child.id}:${childField.id}`;
        keys.add(key);
        childField.options?.forEach((_, optionIndex) => keys.add(`${key}:specify:${optionIndex}`));
      }));
    }
  }
  if (Object.keys(next).some((key) => !keys.has(key))) throw new Error("Changes are limited to fields in the permitted section.");
  return keys;
}
