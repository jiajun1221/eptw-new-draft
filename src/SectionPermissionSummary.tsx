import { readGroups } from "./groupStore";
import type { SectionEditAccess } from "./sectionAccess";

export default function SectionPermissionSummary({ access }: { access?: SectionEditAccess }) {
  const groups = readGroups();
  const names = (access?.mtGroupIds ?? []).map((id) => groups.find((group) => group.id === id)?.name ?? "Unavailable MT group");
  if (!access?.assessor && !names.length) return null;
  return <div className="section-permission-summary" aria-label="Section edit permissions"><span>Can edit:</span>{access?.assessor && <b className="assessor-permission">Assigned Assessor</b>}{names.map((name, index) => <b className="mt-permission" key={index}>{name}</b>)}</div>;
}
