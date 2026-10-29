import type { Permit, PermitFormData, PermitStatus, TransitionAction, User } from "./types";
import { currentRevision } from "./types";
import { canCloseForGroup, isGroupMember } from "./groupStore";
import { safetyChecklistComplete } from "./safetyChecklist";

export interface Decision { allowed: boolean; reason: string }
const yes = (reason = "Action permitted") => ({ allowed: true, reason });
const no = (reason: string) => ({ allowed: false, reason });

export function isComplete(data: PermitFormData, type: Permit["type"]): boolean {
  if (data.templateId) return Boolean(data.site && data.discipline && data.startAt && data.endAt && data.hostId && data.hostSupervisorId && data.hostManagerId && (data.individualReviewerIds?.length || data.individualReviewerId) && (data.mtGroups?.length || data.mtGroup) && (data.finalApprovalMtGroup || data.mtGroup)) && new Date(data.startAt) < new Date(data.endAt);
  const base = Boolean(data.title.trim() && data.description.trim() && data.site && data.discipline && data.location.trim() && data.company.trim() && data.startAt && data.endAt && data.hostId && data.hostSupervisorId && data.hostManagerId && (data.individualReviewerIds?.length || data.individualReviewerId) && (data.mtGroups?.length || data.mtGroup) && (data.finalApprovalMtGroup || data.mtGroup))
    && new Date(data.startAt) < new Date(data.endAt)
    && safetyChecklistComplete(data.safetyChecklistResponses);
  if (!base || type !== "HOT_WORK") return base;
  return Boolean(data.hotWork?.fireWatchName.trim() && data.hotWork.fireWatchMobile.trim() && data.hotWork.combustibleMaterialsRemoved && data.hotWork.extinguishersAvailable);
}

export function effectiveStatus(permit: Permit, now = new Date()): PermitStatus {
  const revision = currentRevision(permit);
  if (["ACTIVE", "SUSPENDED", "APPROVED"].includes(revision.status) && new Date(revision.data.endAt) < now) return "EXPIRED";
  return revision.status;
}

const commentRequired = new Set<TransitionAction>(["REQUEST_CHANGES", "REJECT", "CANCEL", "SUSPEND", "RESUME", "REQUEST_CLOSURE", "CLOSE"]);
const canRaise = (actor: User) => ["CONTRACTOR_REQUESTOR", "MICRON_STAFF", "SUPER_ADMIN"].includes(actor.role);
export const hasSelfApprovalAssignment = (data: PermitFormData, actorId: string): boolean => {
  const individualReviewerIds = data.individualReviewerIds?.length ? data.individualReviewerIds : data.individualReviewerId ? [data.individualReviewerId] : [];
  return data.hostId === actorId || data.hostSupervisorId === actorId || data.hostManagerId === actorId || individualReviewerIds.includes(actorId);
};
const assignedReviewer = (permit: Permit, actor: User, status: PermitStatus) => {
  const data = currentRevision(permit).data;
  if (status === "INDIVIDUAL_REVIEW") return actor.role === "CONTRACTOR_PM" && actor.id === data.hostId;
  if (status === "MT_REVIEW") return ["MICRON_SUPERVISOR", "MICRON_STAFF"].includes(actor.role) && actor.id === data.hostSupervisorId;
  if (status === "PM_REVIEW") return actor.id === data.hostManagerId && ["SUPER_ADMIN", "MICRON_SUPERVISOR", "MICRON_STAFF"].includes(actor.role);
  if (status === "AREA_MANAGER_REVIEW") {
    const selectedIds = data.individualReviewerIds?.length ? data.individualReviewerIds : [data.individualReviewerId];
    const nextReviewerId = currentRevision(permit).areaManagerApprovals?.find((approval) => approval.status === "PENDING")?.userId ?? selectedIds[0];
    return actor.role === "MICRON_STAFF" && actor.id === nextReviewerId;
  }
  if (status === "MT_GROUP_REVIEW") return actor.role === "MICRON_STAFF" && (data.mtGroups?.length ? data.mtGroups : [data.mtGroup]).some((group) => isGroupMember(actor, group));
  if (status === "FINAL_MT_REVIEW") return actor.role === "MICRON_STAFF" && isGroupMember(actor, data.finalApprovalMtGroup || data.mtGroup);
  return false;
};

export function getActionDecision(permit: Permit, action: TransitionAction, actor: User, permits: Permit[], comment = "", now = new Date()): Decision {
  const revision = currentRevision(permit);
  const status = effectiveStatus(permit, now);
  const owner = permit.requestorId === actor.id;
  if (actor.role === "USER_ADMIN") return no("Vendor Admins configure the system but cannot make permit workflow decisions.");
  if (commentRequired.has(action) && !comment.trim()) return no("A reason or evidence note is required for this action.");

  if (action === "SUBMIT") {
    if (!owner || !canRaise(actor)) return no("Only the original permit requestor can submit it.");
    if (!["DRAFT", "CHANGES_REQUESTED"].includes(status)) return no("Only a draft or returned permit can be submitted.");
    if (hasSelfApprovalAssignment(revision.data, actor.id)) return no("You cannot assign yourself as a reviewer or approver.");
    return isComplete(revision.data, permit.type) ? yes() : no("Complete all required permit and safety fields first.");
  }
  if (["APPROVE", "REQUEST_CHANGES", "REJECT"].includes(action)) {
    if (!["INDIVIDUAL_REVIEW", "MT_REVIEW", "PM_REVIEW", "AREA_MANAGER_REVIEW", "MT_GROUP_REVIEW", "FINAL_MT_REVIEW"].includes(status)) return no("This permit is not awaiting a review decision.");
    if (revision.createdBy === actor.id || permit.requestorId === actor.id) return no("Separation of duties prevents reviewing your own permit.");
    if (!assignedReviewer(permit, actor, status)) return no("Approval requires assignment to the current approval stage.");
    return yes();
  }
  if (action === "CANCEL") return owner && canRaise(actor) && ["DRAFT", "CHANGES_REQUESTED", "INDIVIDUAL_REVIEW", "MT_REVIEW", "PM_REVIEW", "AREA_MANAGER_REVIEW", "MT_GROUP_REVIEW", "FINAL_MT_REVIEW", "APPROVED"].includes(status) ? yes() : no("Only the original requestor can request cancellation.");
  if (action === "ACTIVATE") {
    if (!owner || !canRaise(actor) || status !== "APPROVED") return no("Only the original requestor can activate an approved permit.");
    const start = new Date(revision.data.startAt), end = new Date(revision.data.endAt);
    if (now < start || now > end) return no("The permit can activate only within its approved work period.");
    return yes();
  }
  if (action === "SUSPEND") return ["MICRON_STAFF", "SUPER_ADMIN"].includes(actor.role) && status === "ACTIVE" ? yes() : no("Only authorised Micron Staff can suspend active work.");
  if (action === "RESUME") return ["MICRON_STAFF", "SUPER_ADMIN"].includes(actor.role) && status === "SUSPENDED" && now <= new Date(revision.data.endAt) ? yes() : no("Only authorised Micron Staff can resume a valid suspended permit.");
  if (action === "REQUEST_CLOSURE") return owner && canRaise(actor) && ["ACTIVE", "SUSPENDED", "EXPIRED"].includes(status) ? yes() : no("Only the original requestor can request closure.");
  if (action === "CLOSE") return actor.role === "MICRON_STAFF" && status === "CLOSURE_REQUESTED" && (revision.data.mtGroups?.length ? revision.data.mtGroups : [revision.data.mtGroup]).some((group) => canCloseForGroup(actor, group)) ? yes() : no("Closure requires assigned Micron Staff in an MT Group with closure permission.");
  return no("Action is unavailable.");
}

export const nextApprovalStatus = (status: PermitStatus): PermitStatus => status === "INDIVIDUAL_REVIEW" ? "MT_REVIEW" : status === "MT_REVIEW" ? "PM_REVIEW" : status === "PM_REVIEW" ? "AREA_MANAGER_REVIEW" : status === "AREA_MANAGER_REVIEW" ? "MT_GROUP_REVIEW" : status === "MT_GROUP_REVIEW" ? "FINAL_MT_REVIEW" : "APPROVED";

export function availableActions(permit: Permit, actor: User, permits: Permit[]): { action: TransitionAction; decision: Decision }[] {
  const actions: TransitionAction[] = ["SUBMIT", "APPROVE", "REQUEST_CHANGES", "REJECT", "CANCEL", "ACTIVATE", "SUSPEND", "RESUME", "REQUEST_CLOSURE", "CLOSE"];
  return actions.map((action) => ({ action, decision: getActionDecision(permit, action, actor, permits, commentRequired.has(action) ? "preview" : "") }));
}
