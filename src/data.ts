import { USERS } from "./constants";
import type { ApprovalStage, EptwState, Permit, PermitFormData, PermitStatus, PermitType, User } from "./types";

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const dateOffset = (days: number, hour = 8) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
export const approvalStages = (): ApprovalStage[] => ["INDIVIDUAL_REVIEWER", "MT_GROUP", "PM"].map((role) => ({ role: role as ApprovalStage["role"], status: "PENDING" }));

export const blankPermitData = (): PermitFormData => ({
  templateId: "", templateName: "", title: "", description: "", site: "F10A1", discipline: "AMHS", location: "", company: "", startAt: dateOffset(0), endAt: dateOffset(2, 18),
  hostId: "pm-1", hostSupervisorId: "supervisor-1", hostManagerId: "admin-1", individualReviewerId: "ir-1", mtGroup: "Facilities MT", finalApprovalMtGroup: "Facilities MT", assessorIds: [], hazards: [], safetyDeclarations: [], attachments: [],
  safetyChecklistResponses: {},
});

const completeData = (title: string, hot = false): PermitFormData => ({
  ...blankPermitData(), title, description: `${title} with controlled access and pre-work safety briefing.`, location: "Level 2, Utility Bay 4", company: "Acme Engineering",
  hazards: hot ? ["HOT_WORK", "ENERGY_ISOLATION"] : ["ENERGY_ISOLATION"], safetyDeclarations: ["Risk assessment reviewed", "Workers briefed", "Area barricaded"],
  attachments: [{ id: uid(), name: "risk-assessment.pdf", type: "application/pdf", size: 248000 }],
  hotWork: hot ? { fireWatchName: "Lee Wei", fireWatchMobile: "+65 8123 4567", gasTestingRequired: true, combustibleMaterialsRemoved: true, extinguishersAvailable: true } : undefined,
});

function makePermit(id: string, number: string, type: PermitType, status: PermitStatus, requestorId: string, data: PermitFormData, parentId?: string): Permit {
  const revisionId = `${id}-r1`; const createdAt = dateOffset(-1);
  const approvedCount = status === "MT_REVIEW" ? 1 : status === "PM_REVIEW" ? 2 : ["APPROVED", "ACTIVE", "SUSPENDED", "CLOSURE_REQUESTED", "CLOSED"].includes(status) ? 3 : 0;
  const approvals = approvalStages().map((stage, index) => index < approvedCount ? { ...stage, status: "APPROVED" as const, actorId: ["ir-1", "mt-1", "pm-1"][index], actedAt: createdAt } : stage);
  return { id, permitNumber: number, type, parentId, childIds: [], requestorId, currentRevisionId: revisionId, revisions: [{ id: revisionId, number: 1, status, data, approvals, createdAt, createdBy: requestorId, submittedAt: status !== "DRAFT" ? createdAt : undefined }], activities: [], audit: [{ id: uid(), at: createdAt, actorId: requestorId, actorRole: "CONTRACTOR_REQUESTOR", revision: 1, action: "CREATED", toStatus: "DRAFT" }] };
}

export function createSeedState(): EptwState {
  const review = makePermit("permit-review", "F10A1-G-AMHS-2026-09-08/0001", "GENERAL", "INDIVIDUAL_REVIEW", "req-1", completeData("Cooling system preventative maintenance"));
  const child = makePermit("permit-hot-child", "F10A1-B1-Facilities-2026-09-09/0002-1", "HOT_WORK", "PM_REVIEW", "req-2", { ...completeData("Pipe bracket welding", true), templateId: "tpl-child-b1", templateName: "HOT WORKS", discipline: "Facilities" }, "permit-hot-parent");
  const confinedSpace = makePermit("permit-confined-child", "F10A1-B2-Facilities-2026-09-09/0002-2", "HOT_WORK", "DRAFT", "req-2", { ...completeData("Utility pit inspection"), templateId: "tpl-child-b2", templateName: "CONFINED SPACE", discipline: "Facilities", location: "Level 1 utility pit", company: "SafeSpace Engineering" }, "permit-hot-parent");
  const lifting = makePermit("permit-lifting-child", "F10A1-B3-Facilities-2026-09-09/0002-3", "HOT_WORK", "DRAFT", "req-2", { ...completeData("Chiller motor lifting"), templateId: "tpl-child-b3", templateName: "LIFTING", discipline: "Facilities", location: "Central utility building", company: "Prime Lifting Services" }, "permit-hot-parent");
  const workAtHeight = makePermit("permit-height-child", "F10A1-B4-Facilities-2026-09-09/0002-4", "HOT_WORK", "DRAFT", "req-2", { ...completeData("Overhead pipe support installation"), templateId: "tpl-child-b4", templateName: "WORK AT HEIGHT", discipline: "Facilities", location: "Level 3 service corridor", company: "Acme Engineering" }, "permit-hot-parent");
  const riskAssessment = makePermit("permit-a01-child", "F10A1-A01-Facilities-2026-09-09/0002-5", "HOT_WORK", "DRAFT", "req-2", { ...completeData("Risk assessment submission"), templateId: "tpl-child-a01", templateName: "Upload Risk Assessment Form", discipline: "Facilities", location: "Utility Bay 4" }, "permit-hot-parent");
  const sampleChildren = [child, confinedSpace, lifting, workAtHeight, riskAssessment];
  const parent = makePermit("permit-hot-parent", "F10A1-G-Facilities-2026-09-09/0002", "GENERAL", "PM_REVIEW", "req-2", { ...completeData("Utility pipe replacement", true), discipline: "Facilities" }); parent.childIds = sampleChildren.map((item) => item.id);
  const active = makePermit("permit-active", "F10N-G-IT-2026-09-09/0003", "GENERAL", "ACTIVE", "req-1", { ...completeData("Server room cable inspection"), site: "F10N", discipline: "IT" });
  active.activities.push({ id: uid(), date: dateOffset(0), summary: "Pre-start briefing completed; barricades inspected.", safetyConfirmed: true, actorId: "req-1", createdAt: new Date().toISOString() });
  const draft = makePermit("permit-draft", "F10A2-G-Facilities-2026-09-09/0004", "GENERAL", "DRAFT", "req-1", { ...blankPermitData(), site: "F10A2", discipline: "Facilities", title: "Air handler inspection", company: "Acme Engineering" });
  return { version: 2, permits: [review, parent, ...sampleChildren, active, draft] };
}

export const findUser = (id: string): User => USERS.find((user) => user.id === id) ?? USERS[0];
export { uid, dateOffset };
