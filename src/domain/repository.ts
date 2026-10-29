import { approvalStages, createSeedState, uid } from "./data";
import { USERS } from "./constants";
import { effectiveStatus, getActionDecision, hasSelfApprovalAssignment, isComplete, nextApprovalStatus } from "./policy";
import type { ActivityLog, ApprovalRole, AuditEvent, EptwState, Permit, PermitFilters, PermitFormData, PermitRevision, PermitStatus, TransitionAction, TransitionPayload, User } from "./types";
import { currentRevision } from "./types";
import { sectionUpdateKeys } from "./sectionAccess";

const STORAGE_KEY = "eptw-functional-draft:v2";
const clone = <T,>(value: T): T => structuredClone(value);
const isEmbeddedBinary = (value: string) => /^data:[^;,]+;base64,/i.test(value);
const duplicateFieldValue = (value: string | boolean | string[]) => {
  if (typeof value !== "string") return value;
  if (isEmbeddedBinary(value)) return "";
  try {
    const attachment = JSON.parse(value) as { dataUrl?: unknown };
    return typeof attachment.dataUrl === "string" && isEmbeddedBinary(attachment.dataUrl) ? "" : value;
  } catch { return value; }
};
const duplicatePermitData = (input: PermitFormData) => {
  const data = clone(input);
  data.customFields = Object.fromEntries(Object.entries(data.customFields ?? {}).map(([key, value]) => [key, duplicateFieldValue(value)]));
  return data;
};
const approvalRoleForStatus: Partial<Record<PermitStatus, ApprovalRole>> = { INDIVIDUAL_REVIEW: "VENDOR_PM", MT_REVIEW: "HOST_SUPERVISOR", PM_REVIEW: "HOST_MANAGER", AREA_MANAGER_REVIEW: "AREA_MANAGER", MT_GROUP_REVIEW: "MT_GROUP", FINAL_MT_REVIEW: "FINAL_MT_GROUP" };
const approvalRoles: ApprovalRole[] = ["VENDOR_PM", "HOST_SUPERVISOR", "HOST_MANAGER", "AREA_MANAGER", "MT_GROUP", "FINAL_MT_GROUP"];
const approvalStageFor = (revision: PermitRevision, status: PermitStatus) => {
  const role = approvalRoleForStatus[status];
  if (!role) return undefined;
  let stage = revision.approvals.find((item) => item.role === role);
  if (!stage) { stage = { role, status: "PENDING" }; revision.approvals.push(stage); }
  return stage;
};
const selectedAreaManagerIds = (revision: PermitRevision) => revision.data.individualReviewerIds?.length ? revision.data.individualReviewerIds : revision.data.individualReviewerId ? [revision.data.individualReviewerId] : [];
const resetAreaManagerApprovals = (revision: PermitRevision) => { revision.areaManagerApprovals = selectedAreaManagerIds(revision).map((userId) => ({ userId, status: "PENDING" })); };

export interface PermitRepository {
  listPermits(filters?: PermitFilters): Permit[];
  getPermit(id: string): Permit | undefined;
  createPermit(input: PermitFormData, actor: User): Permit;
  duplicatePermit(sourceId: string, input: PermitFormData, actor: User): Permit;
  createChildPermit(input: PermitFormData, parentId: string, templateCode: string, actor: User): Permit;
  updateDraft(id: string, input: PermitFormData, actor: User): Permit;
  deleteDraft(id: string, actor: User): void;
  syncAttachedChildren(parentId: string, children: AttachedChildInput[], actor: User): Permit;
  updateSection(id: string, sectionId: string, fields: Record<string, string | boolean | string[]>, actor: User): Permit;
  submitPermit(id: string, actor: User): Permit;
  performTransition(id: string, action: TransitionAction, payload: TransitionPayload, actor: User): Permit;
  addActivityLog(id: string, input: Pick<ActivityLog, "date" | "summary" | "safetyConfirmed">, actor: User): Permit;
  createRevision(id: string, actor: User): Permit;
  resetDemoData(): EptwState;
}

export type AttachedChildInput = { key: string; code: string; data: PermitFormData };

export class LocalPermitRepository implements PermitRepository {
  private migrateAreaManagerApprovals(state: EptwState): boolean {
    let changed = false;
    const completedStatuses: PermitStatus[] = ["MT_GROUP_REVIEW", "FINAL_MT_REVIEW", "APPROVED", "ACTIVE", "SUSPENDED", "CLOSURE_REQUESTED", "CLOSED", "EXPIRED", "SUPERSEDED"];
    state.permits.forEach((permit) => {
      const revision = currentRevision(permit), selectedIds = selectedAreaManagerIds(revision);
      const existing = revision.areaManagerApprovals ?? [];
      if (existing.length === selectedIds.length && existing.every((approval, index) => approval.userId === selectedIds[index])) return;
      const areaStageComplete = completedStatuses.includes(revision.status);
      revision.areaManagerApprovals = selectedIds.map((userId) => existing.find((approval) => approval.userId === userId) ?? { userId, status: areaStageComplete ? "APPROVED" : "PENDING" });
      changed = true;
    });
    return changed;
  }

  private normalizeApprovalStageHistory(state: EptwState): boolean {
    let changed = false;
    const fullyApprovedStatuses: PermitStatus[] = ["APPROVED", "ACTIVE", "SUSPENDED", "CLOSURE_REQUESTED", "CLOSED", "EXPIRED", "SUPERSEDED"];
    state.permits.forEach((permit) => {
      const revision = currentRevision(permit);
      const currentRole = approvalRoleForStatus[revision.status];
      let completedCount = currentRole ? approvalRoles.indexOf(currentRole) : fullyApprovedStatuses.includes(revision.status) ? approvalRoles.length : -1;
      let outcomeRole: ApprovalRole | undefined;
      let outcome: "REJECTED" | "CHANGES_REQUESTED" | undefined;
      if (["REJECTED", "CHANGES_REQUESTED"].includes(revision.status)) {
        outcome = revision.status as "REJECTED" | "CHANGES_REQUESTED";
        const action = outcome === "REJECTED" ? "REJECT" : "REQUEST_CHANGES";
        const event = permit.audit.find((item) => item.revision === revision.number && item.action === action);
        outcomeRole = event?.fromStatus ? approvalRoleForStatus[event.fromStatus] : revision.approvals.find((stage) => stage.status === outcome)?.role;
        completedCount = outcomeRole ? approvalRoles.indexOf(outcomeRole) : -1;
      }
      if (completedCount < 0) return;
      const normalized = approvalRoles.map((role, index) => {
        const expectedStatus = index < completedCount ? "APPROVED" as const : role === outcomeRole && outcome ? outcome : "PENDING" as const;
        const existing = revision.approvals.find((stage) => stage.role === role && stage.status === expectedStatus);
        return existing ? { ...existing } : { role, status: expectedStatus };
      });
      if (JSON.stringify(revision.approvals) === JSON.stringify(normalized)) return;
      revision.approvals = normalized;
      permit.audit.unshift({ id: uid(), at: new Date().toISOString(), actorId: "system", actorRole: "SUPER_ADMIN", revision: revision.number, action: "APPROVAL_HISTORY_NORMALIZED", fromStatus: revision.status, toStatus: revision.status, comment: "Aligned approval markers with the sequential workflow status." });
      changed = true;
    });
    return changed;
  }

  private repairSelfAssignedApprovalRoutes(state: EptwState): boolean {
    let changed = false;
    const approvalStatuses: PermitStatus[] = ["INDIVIDUAL_REVIEW", "MT_REVIEW", "PM_REVIEW", "AREA_MANAGER_REVIEW", "MT_GROUP_REVIEW", "FINAL_MT_REVIEW"];
    state.permits.forEach((permit) => {
      const revision = currentRevision(permit);
      if (!approvalStatuses.includes(revision.status)) return;
      const data = revision.data, requestorId = permit.requestorId;
      const replacement = (roles: User["role"][], preferredId?: string) => USERS.find((candidate) => candidate.id === preferredId && candidate.id !== requestorId && roles.includes(candidate.role)) ?? USERS.find((candidate) => candidate.id !== requestorId && roles.includes(candidate.role));
      let routeChanged = false;
      if (!data.hostId || data.hostId === requestorId) { data.hostId = replacement(["CONTRACTOR_PM"], "pm-1")?.id ?? ""; routeChanged = true; }
      if (!data.hostSupervisorId || data.hostSupervisorId === requestorId) { data.hostSupervisorId = replacement(["MICRON_SUPERVISOR", "MICRON_STAFF"], "supervisor-1")?.id ?? ""; routeChanged = true; }
      if (!data.hostManagerId || data.hostManagerId === requestorId) { data.hostManagerId = replacement(["SUPER_ADMIN", "MICRON_SUPERVISOR", "MICRON_STAFF"], "admin-1")?.id ?? ""; routeChanged = true; }
      const reviewerIds = (data.individualReviewerIds?.length ? data.individualReviewerIds : data.individualReviewerId ? [data.individualReviewerId] : []).filter((id) => id !== requestorId && USERS.some((candidate) => candidate.id === id && candidate.role === "MICRON_STAFF"));
      if (!reviewerIds.length) { const reviewer = replacement(["MICRON_STAFF"], "ir-1"); if (reviewer) reviewerIds.push(reviewer.id); }
      if (reviewerIds.join("|") !== (data.individualReviewerIds?.length ? data.individualReviewerIds : data.individualReviewerId ? [data.individualReviewerId] : []).join("|")) routeChanged = true;
      data.individualReviewerIds = reviewerIds; data.individualReviewerId = reviewerIds[0] ?? "";
      if (!routeChanged) return;
      permit.audit.unshift({ id: uid(), at: new Date().toISOString(), actorId: "system", actorRole: "SUPER_ADMIN", revision: revision.number, action: "APPROVAL_ROUTE_REASSIGNED", fromStatus: revision.status, toStatus: revision.status, comment: "Removed the permit submitter from the approval route." });
      changed = true;
    });
    return changed;
  }
  private backfillSelectedBChildren(state: EptwState) {
    type StoredTemplate = { id: string; kind: string; name: string; code: string; sections?: { fields: { id: string; type: string; childTemplateIds?: (string | null)[] }[] }[] };
    let templates: StoredTemplate[] = [];
    try { templates = JSON.parse(localStorage.getItem("eptw-templates:v4") ?? "[]") as StoredTemplate[]; } catch { return false; }
    if (!templates.length) return false;
    const checklistCodes: Record<string, string> = { "hot-work": "B1", "confined-space": "B2", "crane-lifting": "B3", "work-at-height": "B4" };
    let changed = false;
    [...state.permits].filter((permit) => !permit.parentId).forEach((parent) => {
      const data = currentRevision(parent).data, parentTemplate = templates.find((template) => template.id === data.templateId);
      const selectedTemplateIds = (parentTemplate?.sections ?? []).flatMap((section) => section.fields.flatMap((field) => field.type === "MULTI_CHECKBOX" && Array.isArray(data.customFields?.[field.id]) ? (data.customFields[field.id] as string[]).map((index) => field.childTemplateIds?.[Number(index)]).filter((id): id is string => Boolean(id)) : []));
      const selectedCodes = Object.entries(checklistCodes).filter(([id]) => Boolean(data.safetyChecklistResponses?.[id])).map(([, code]) => code);
      const selected = [...new Set([...selectedTemplateIds.map((id) => templates.find((template) => template.id === id)?.code), ...selectedCodes].filter((code): code is string => typeof code === "string" && /^B[1-4]$/i.test(code)))];
      selected.forEach((code) => {
        const template = templates.find((item) => item.kind === "CHILD" && item.code.toUpperCase() === code.toUpperCase());
        const alreadyAttached = state.permits.some((child) => (parent.childIds.includes(child.id) || child.parentId === parent.id) && currentRevision(child).data.templateId === template?.id);
        if (!template || alreadyAttached || state.deletedChildSelections?.includes(`${parent.id}:${template.id}`)) return;
        const id = uid(), revisionId = uid(), createdAt = new Date().toISOString(), sequence = parent.childIds.length + 1;
        const child: Permit = { id, permitNumber: `${parent.permitNumber.replace(/-G-/i, `-${code.toUpperCase()}-`)}-${sequence}`, type: code.toUpperCase() === "B1" ? "HOT_WORK" : "GENERAL", parentId: parent.id, attachmentKey: `migrated:${code.toUpperCase()}`, childIds: [], requestorId: parent.requestorId, currentRevisionId: revisionId, revisions: [{ id: revisionId, number: 1, status: "DRAFT", data: { ...clone(data), templateId: template.id, templateName: template.name, title: template.name, customFields: {} }, approvals: approvalStages(), createdAt, createdBy: parent.requestorId }], activities: [], audit: [{ id: uid(), at: createdAt, actorId: "system", actorRole: "SUPER_ADMIN", revision: 1, action: "BACKFILLED_FROM_PARENT_SELECTION", toStatus: "DRAFT" }] };
        state.permits.push(child); parent.childIds.push(child.id); changed = true;
      });
    });
    return changed;
  }
  private read(): EptwState {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return this.resetDemoData();
    try {
      const state = JSON.parse(raw) as EptwState;
      if (state.version !== 2) return this.resetDemoData();
      if (!state.permits.some((permit) => permit.id === "permit-draft") && !state.deletedPermitIds?.includes("permit-draft")) {
        const draft = createSeedState().permits.find((permit) => permit.id === "permit-draft");
        if (draft) { state.permits.push(draft); this.write(state); }
      }
      const seeds = createSeedState();
      const sampleChildIds = ["permit-confined-child", "permit-lifting-child", "permit-height-child", "permit-a01-child"];
      const missingChildren = seeds.permits.filter((permit) => sampleChildIds.includes(permit.id) && !state.permits.some((existing) => existing.id === permit.id));
      const sampleParent = state.permits.find((permit) => permit.id === "permit-hot-parent");
      const originalChild = state.permits.find((permit) => permit.id === "permit-hot-child");
      const originalChildData = originalChild ? currentRevision(originalChild).data : undefined;
      const upgradeOriginalChild = Boolean(originalChildData && !originalChildData.templateId);
      if (missingChildren.length || upgradeOriginalChild || (sampleParent && sampleChildIds.some((id) => !sampleParent.childIds.includes(id)))) {
        state.permits.push(...missingChildren);
        if (originalChildData && upgradeOriginalChild) { originalChildData.templateId = "tpl-child-b1"; originalChildData.templateName = "HOT WORKS"; }
        if (sampleParent) sampleParent.childIds = [...new Set([...sampleParent.childIds, ...sampleChildIds])];
        this.write(state);
      }
      if (this.backfillSelectedBChildren(state)) this.write(state);
      if (this.repairSelfAssignedApprovalRoutes(state)) this.write(state);
      if (this.migrateAreaManagerApprovals(state)) this.write(state);
      if (this.normalizeApprovalStageHistory(state)) this.write(state);
      return this.expire(state);
    }
    catch { return this.resetDemoData(); }
  }
  private write(state: EptwState) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) {
      if ((error as DOMException).name === "QuotaExceededError") throw new Error("Browser storage is full. Remove an unused draft or large attachment, then try again.");
      throw error;
    }
  }
  private expire(state: EptwState): EptwState {
    let changed = false;
    state.permits.forEach((permit) => { const revision = currentRevision(permit); const effective = effectiveStatus(permit); if (effective === "EXPIRED" && revision.status !== "EXPIRED") { const before = revision.status; revision.status = "EXPIRED"; permit.audit.unshift({ id: uid(), at: new Date().toISOString(), actorId: "system", actorRole: "SUPER_ADMIN", revision: revision.number, action: "AUTO_EXPIRED", fromStatus: before, toStatus: "EXPIRED" }); changed = true; } });
    if (changed) this.write(state); return state;
  }
  private find(state: EptwState, id: string) { const permit = state.permits.find((item) => item.id === id); if (!permit) throw new Error("Permit not found."); return permit; }
  private audit(permit: Permit, actor: User, action: string, fromStatus?: AuditEvent["fromStatus"], toStatus?: AuditEvent["toStatus"], comment?: string) {
    permit.audit.unshift({ id: uid(), at: new Date().toISOString(), actorId: actor.id, actorRole: actor.role, revision: currentRevision(permit).number, action, fromStatus, toStatus, comment });
  }
  listPermits(filters: PermitFilters = {}) {
    const permits = this.read().permits; const q = filters.query?.trim().toLowerCase();
    return clone(permits.filter((permit) => { const revision = currentRevision(permit); const text = `${permit.permitNumber} ${revision.data.title} ${revision.data.description} ${revision.data.company} ${revision.data.discipline}`.toLowerCase(); return (!q || text.includes(q)) && (!filters.status || revision.status === filters.status) && (!filters.type || permit.type === filters.type) && (!filters.site || revision.data.site === filters.site) && (!filters.discipline || revision.data.discipline === filters.discipline); }));
  }
  getPermit(id: string) { const permit = this.read().permits.find((item) => item.id === id); return permit ? clone(permit) : undefined; }
  createPermit(input: PermitFormData, actor: User) {
    if (!["CONTRACTOR_REQUESTOR", "MICRON_STAFF", "SUPER_ADMIN"].includes(actor.role)) throw new Error("This role cannot create permits.");
    if (hasSelfApprovalAssignment(input, actor.id)) throw new Error("You cannot assign yourself as a reviewer or approver.");
    const state = this.read(); const id = uid(); const sequence = String(state.permits.length + 1).padStart(4, "0"); const revisionId = uid(); const today = new Date().toISOString().slice(0, 10);
    const permit: Permit = { id, permitNumber: `${input.site}-G-${input.discipline}-${today}/${sequence}`, type: "GENERAL", childIds: [], requestorId: actor.id, currentRevisionId: revisionId, revisions: [{ id: revisionId, number: 1, status: "DRAFT", data: clone(input), approvals: approvalStages(), createdAt: new Date().toISOString(), createdBy: actor.id }], activities: [], audit: [] };
    this.audit(permit, actor, "CREATED", undefined, "DRAFT"); state.permits.unshift(permit);
    this.write(state); return clone(permit);
  }
  duplicatePermit(sourceId: string, input: PermitFormData, actor: User) {
    if (!["CONTRACTOR_REQUESTOR", "MICRON_STAFF", "SUPER_ADMIN"].includes(actor.role)) throw new Error("This role cannot duplicate permits.");
    const state = this.read(), source = this.find(state, sourceId), data = duplicatePermitData(input);
    if (data.hostId === actor.id) data.hostId = "";
    if (data.hostSupervisorId === actor.id) data.hostSupervisorId = "";
    if (data.hostManagerId === actor.id) data.hostManagerId = "";
    const reviewers = (data.individualReviewerIds?.length ? data.individualReviewerIds : data.individualReviewerId ? [data.individualReviewerId] : []).filter((reviewerId) => reviewerId !== actor.id);
    data.individualReviewerIds = reviewers; data.individualReviewerId = reviewers[0] ?? "";
    const id = uid(), revisionId = uid(), createdAt = new Date().toISOString(), sequence = String(state.permits.length + 1).padStart(4, "0");
    const code = source.type === "HOT_WORK" ? "HW" : "G";
    const permit: Permit = { id, permitNumber: `${data.site}-${code}-${data.discipline}-${createdAt.slice(0, 10)}/${sequence}`, type: source.type, childIds: [], requestorId: actor.id, currentRevisionId: revisionId, revisions: [{ id: revisionId, number: 1, status: "DRAFT", data, approvals: approvalStages(), areaManagerApprovals: reviewers.map((userId) => ({ userId, status: "PENDING" })), createdAt, createdBy: actor.id }], activities: [], audit: [] };
    this.audit(permit, actor, "DUPLICATED_FROM", undefined, "DRAFT", source.permitNumber);
    state.permits.unshift(permit); this.write(state); return clone(permit);
  }
  createChildPermit(input: PermitFormData, parentId: string, templateCode: string, actor: User) {
    if (!["CONTRACTOR_REQUESTOR", "MICRON_STAFF", "SUPER_ADMIN"].includes(actor.role)) throw new Error("This role cannot create permits.");
    if (hasSelfApprovalAssignment(input, actor.id)) throw new Error("You cannot assign yourself as a reviewer or approver.");
    const state = this.read(), parent = this.find(state, parentId);
    if (parent.parentId || parent.type !== "GENERAL" || parent.requestorId !== actor.id) throw new Error("Select one of your valid parent permits.");
    const id = uid(), revisionId = uid(), createdAt = new Date().toISOString();
    const sequence = state.permits.filter((item) => item.parentId === parent.id).length + 1;
    const code = templateCode.trim().toUpperCase() || "CHILD";
    const permit: Permit = { id, permitNumber: `${parent.permitNumber.replace(/-G-/i, `-${code}-`)}-${sequence}`, type: "HOT_WORK", parentId: parent.id, attachmentKey: `manual:${id}`, childIds: [], requestorId: actor.id, currentRevisionId: revisionId, revisions: [{ id: revisionId, number: 1, status: "DRAFT", data: clone(input), approvals: approvalStages(), createdAt, createdBy: actor.id }], activities: [], audit: [] };
    this.audit(permit, actor, "CREATED_AND_ATTACHED_TO_PARENT", undefined, "DRAFT");
    state.permits.unshift(permit); parent.childIds.push(permit.id);
    this.write(state); return clone(permit);
  }
  updateDraft(id: string, input: PermitFormData, actor: User) {
    const state = this.read(), permit = this.find(state, id), revision = currentRevision(permit);
    if (!["CONTRACTOR_REQUESTOR", "MICRON_STAFF", "SUPER_ADMIN"].includes(actor.role) || permit.requestorId !== actor.id || !["DRAFT", "CHANGES_REQUESTED"].includes(revision.status)) throw new Error("This revision cannot be edited by the current user.");
    if (hasSelfApprovalAssignment(input, actor.id)) throw new Error("You cannot assign yourself as a reviewer or approver.");
    revision.data = clone(input); this.audit(permit, actor, "DRAFT_UPDATED", revision.status, revision.status); this.write(state); return clone(permit);
  }
  deleteDraft(id: string, actor: User) {
    const state = this.read(), permit = this.find(state, id), revision = currentRevision(permit);
    if (permit.requestorId !== actor.id || revision.status !== "DRAFT" || !["CONTRACTOR_REQUESTOR", "MICRON_STAFF", "SUPER_ADMIN"].includes(actor.role)) throw new Error("Only the owner can delete their own draft permit.");
    const removeIds = new Set([permit.id, ...state.permits.filter((item) => item.parentId === permit.id).map((item) => item.id)]);
    state.permits = state.permits.filter((item) => !removeIds.has(item.id));
    state.deletedPermitIds = [...new Set([...(state.deletedPermitIds ?? []), ...removeIds])];
    if (permit.parentId && revision.data.templateId) state.deletedChildSelections = [...new Set([...(state.deletedChildSelections ?? []), `${permit.parentId}:${revision.data.templateId}`])];
    state.permits.forEach((item) => { item.childIds = item.childIds.filter((childId) => !removeIds.has(childId)); });
    this.write(state);
  }
  syncAttachedChildren(parentId: string, children: AttachedChildInput[], actor: User) {
    const state = this.read(), parent = this.find(state, parentId);
    if (parent.requestorId !== actor.id || !["CONTRACTOR_REQUESTOR", "MICRON_STAFF", "SUPER_ADMIN"].includes(actor.role)) throw new Error("Only the permit requestor can update attached child permits.");
    const requestedKeys = new Set(children.map((child) => child.key));
    const obsolete = state.permits.filter((permit) => permit.parentId === parent.id && permit.attachmentKey && !requestedKeys.has(permit.attachmentKey));
    if (obsolete.length) {
      const obsoleteIds = new Set(obsolete.map((permit) => permit.id));
      state.permits = state.permits.filter((permit) => !obsoleteIds.has(permit.id));
      parent.childIds = parent.childIds.filter((id) => !obsoleteIds.has(id));
    }
    children.forEach((input, index) => {
      const existing = state.permits.find((permit) => permit.parentId === parent.id && permit.attachmentKey === input.key);
      if (existing) {
        const revision = currentRevision(existing);
        if (["DRAFT", "CHANGES_REQUESTED"].includes(revision.status)) revision.data = clone(input.data);
        if (!parent.childIds.includes(existing.id)) parent.childIds.push(existing.id);
        return;
      }
      const id = uid(), revisionId = uid();
      const permitNumber = `${parent.permitNumber.replace(/-G-/i, `-${input.code.toUpperCase()}-`)}-${index + 1}`;
      const child: Permit = { id, permitNumber, type: input.code.toUpperCase() === "B1" ? "HOT_WORK" : "GENERAL", parentId: parent.id, attachmentKey: input.key, childIds: [], requestorId: actor.id, currentRevisionId: revisionId, revisions: [{ id: revisionId, number: 1, status: "DRAFT", data: clone(input.data), approvals: approvalStages(), createdAt: new Date().toISOString(), createdBy: actor.id }], activities: [], audit: [] };
      this.audit(child, actor, "CREATED_FROM_PARENT_SELECTION", undefined, "DRAFT");
      state.permits.unshift(child); parent.childIds.push(child.id);
    });
    this.write(state); return clone(parent);
  }
  updateSection(id: string, sectionId: string, fields: Record<string, string | boolean | string[]>, actor: User) {
    const state = this.read(), permit = this.find(state, id), revision = currentRevision(permit);
    sectionUpdateKeys(permit, sectionId, actor, fields);
    revision.data.customFields = { ...revision.data.customFields, ...clone(fields) };
    this.audit(permit, actor, "SECTION_UPDATED", revision.status, revision.status, `Section ${sectionId}`);
    this.write(state); return clone(permit);
  }
  submitPermit(id: string, actor: User) { return this.performTransition(id, "SUBMIT", {}, actor); }
  performTransition(id: string, action: TransitionAction, payload: TransitionPayload, actor: User) {
    const state = this.read(), permit = this.find(state, id), revision = currentRevision(permit), before = revision.status;
    const decision = getActionDecision(permit, action, actor, state.permits, payload.comment); if (!decision.allowed) throw new Error(decision.reason);
    if (action === "SUBMIT") { revision.status = "INDIVIDUAL_REVIEW"; revision.submittedAt = new Date().toISOString(); revision.approvals = approvalStages(); resetAreaManagerApprovals(revision); }
    if (action === "APPROVE") { const stage = approvalStageFor(revision, before); if (before === "AREA_MANAGER_REVIEW") { if (!revision.areaManagerApprovals?.length) resetAreaManagerApprovals(revision); const reviewer = revision.areaManagerApprovals?.find((approval) => approval.status === "PENDING"); if (reviewer) Object.assign(reviewer, { status: "APPROVED", actorId: actor.id, actedAt: new Date().toISOString(), comment: payload.comment }); const areaComplete = revision.areaManagerApprovals?.every((approval) => approval.status === "APPROVED") ?? true; if (areaComplete) { if (stage) Object.assign(stage, { status: "APPROVED", actorId: actor.id, actedAt: new Date().toISOString(), comment: payload.comment }); revision.status = nextApprovalStatus(before); } } else { if (stage) Object.assign(stage, { status: "APPROVED", actorId: actor.id, actedAt: new Date().toISOString(), comment: payload.comment }); revision.status = nextApprovalStatus(before); } if (revision.status === "APPROVED" && revision.number > 1) permit.revisions.filter((item) => item.id !== revision.id && ["APPROVED", "SUSPENDED", "ACTIVE", "EXPIRED"].includes(item.status)).forEach((item) => { item.status = "SUPERSEDED"; }); }
    if (action === "REQUEST_CHANGES") { const stage = approvalStageFor(revision, before); if (stage) Object.assign(stage, { status: "CHANGES_REQUESTED", actorId: actor.id, actedAt: new Date().toISOString(), comment: payload.comment }); if (before === "AREA_MANAGER_REVIEW") { const reviewer = revision.areaManagerApprovals?.find((approval) => approval.status === "PENDING"); if (reviewer) Object.assign(reviewer, { status: "CHANGES_REQUESTED", actorId: actor.id, actedAt: new Date().toISOString(), comment: payload.comment }); } revision.status = "CHANGES_REQUESTED"; }
    if (action === "REJECT") { const stage = approvalStageFor(revision, before); if (stage) Object.assign(stage, { status: "REJECTED", actorId: actor.id, actedAt: new Date().toISOString(), comment: payload.comment }); if (before === "AREA_MANAGER_REVIEW") { const reviewer = revision.areaManagerApprovals?.find((approval) => approval.status === "PENDING"); if (reviewer) Object.assign(reviewer, { status: "REJECTED", actorId: actor.id, actedAt: new Date().toISOString(), comment: payload.comment }); } revision.status = "REJECTED"; }
    if (action === "CANCEL") revision.status = "CANCELLED";
    if (action === "ACTIVATE") { revision.status = "ACTIVE"; permit.childIds.forEach((childId) => { const child = this.find(state, childId); currentRevision(child).status = "ACTIVE"; this.audit(child, actor, "ACTIVATED_WITH_PARENT", "APPROVED", "ACTIVE"); }); }
    if (action === "SUSPEND") revision.status = "SUSPENDED";
    if (action === "RESUME") revision.status = "ACTIVE";
    if (action === "REQUEST_CLOSURE") revision.status = "CLOSURE_REQUESTED";
    if (action === "CLOSE") { revision.status = "CLOSED"; permit.childIds.forEach((childId) => { const child = this.find(state, childId); const childRevision = currentRevision(child); const old = childRevision.status; childRevision.status = "CLOSED"; this.audit(child, actor, "CLOSED_WITH_PARENT", old, "CLOSED", payload.comment); }); }
    this.audit(permit, actor, action, before, revision.status, payload.comment); this.write(state); return clone(permit);
  }
  addActivityLog(id: string, input: Pick<ActivityLog, "date" | "summary" | "safetyConfirmed">, actor: User) {
    const state = this.read(), permit = this.find(state, id), status = effectiveStatus(permit);
    if (!["ACTIVE", "SUSPENDED"].includes(status) || !input.safetyConfirmed || !input.summary.trim() || !((actor.id === permit.requestorId && ["CONTRACTOR_REQUESTOR", "MICRON_STAFF", "SUPER_ADMIN"].includes(actor.role)) || (actor.role === "ASSESSOR" && currentRevision(permit).data.assessorIds?.includes(actor.id)))) throw new Error("A confirmed safety log can only be added by the requestor or assigned Assessor.");
    permit.activities.unshift({ id: uid(), ...input, actorId: actor.id, createdAt: new Date().toISOString() }); this.audit(permit, actor, "ACTIVITY_LOG_ADDED", status, status, input.summary); this.write(state); return clone(permit);
  }
  createRevision(id: string, actor: User) {
    const state = this.read(), permit = this.find(state, id), previous = currentRevision(permit);
    if (!["CONTRACTOR_REQUESTOR", "MICRON_STAFF", "SUPER_ADMIN"].includes(actor.role) || actor.id !== permit.requestorId || !["APPROVED", "ACTIVE", "SUSPENDED", "EXPIRED"].includes(effectiveStatus(permit))) throw new Error("Only the requestor can revise an approved or operational permit.");
    const old = previous.status; if (old === "ACTIVE") previous.status = "SUSPENDED"; const next = { ...clone(previous), id: uid(), number: previous.number + 1, status: "DRAFT" as const, approvals: approvalStages(), areaManagerApprovals: selectedAreaManagerIds(previous).map((userId) => ({ userId, status: "PENDING" as const })), createdAt: new Date().toISOString(), createdBy: actor.id, submittedAt: undefined };
    permit.revisions.push(next); permit.currentRevisionId = next.id; this.audit(permit, actor, "REVISION_CREATED", old, "DRAFT", `Revision ${next.number} created; prior approved record retained.`); this.write(state); return clone(permit);
  }
  resetDemoData() { const state = createSeedState(); this.write(state); return clone(state); }
}

export const repository = new LocalPermitRepository();
export { STORAGE_KEY };
