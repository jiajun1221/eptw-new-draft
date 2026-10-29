import { readGroups } from "../domain/groupStore";
import { USERS } from "../domain/constants";
import type { SectionEditAccess } from "../domain/sectionAccess";

export default function SectionPermissionSummary({ access }: { access?: SectionEditAccess }) {
  const groups = readGroups();
  const names = (access?.mtGroupIds ?? []).map((id) => groups.find((group) => group.id === id)?.name ?? "Unavailable MT group");
  const assessors = access?.assessorIds?.length ? access.assessorIds.map((id) => USERS.find((user) => user.id === id)?.name ?? "Unavailable Assessor") : access?.assessor ? ["Assigned Assessor"] : [];
  if (!assessors.length && !names.length) return null;
  return <div className="section-permission-summary" aria-label="Section edit permissions"><span>Can edit:</span>{assessors.map((name, index) => <b className="assessor-permission" key={`assessor-${index}`}>{name}</b>)}{names.map((name, index) => <b className="mt-permission" key={index}>{name}</b>)}</div>;
}
