import { approvalStages, createSeedState, uid } from "./data";
import { effectiveStatus, getActionDecision, isComplete, nextApprovalStatus } from "./policy";
import type { ActivityLog, AuditEvent, EptwState, Permit, PermitFilters, PermitFormData, TransitionAction, TransitionPayload, User } from "./types";
import { currentRevision } from "./types";

const STORAGE_KEY = "eptw-functional-draft:v2";
const clone = <T,>(value: T): T => structuredClone(value);

export interface PermitRepository {
  listPermits(filters?: PermitFilters): Permit[];
  getPermit(id: string): Permit | undefined;
  createPermit(input: PermitFormData, actor: User): Permit;
  updateDraft(id: string, input: PermitFormData, actor: User): Permit;
  submitPermit(id: string, actor: User): Permit;
  performTransition(id: string, action: TransitionAction, payload: TransitionPayload, actor: User): Permit;
  addActivityLog(id: string, input: Pick<ActivityLog, "date" | "summary" | "safetyConfirmed">, actor: User): Permit;
  createRevision(id: string, actor: User): Permit;
  resetDemoData(): EptwState;
}

export class LocalPermitRepository implements PermitRepository {
  private read(): EptwState {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return this.resetDemoData();
    try {
      const state = JSON.parse(raw) as EptwState;
      if (state.version !== 2) return this.resetDemoData();
      if (!state.permits.some((permit) => permit.id === "permit-draft")) {
        const draft = createSeedState().permits.find((permit) => permit.id === "permit-draft");
        if (draft) { state.permits.push(draft); this.write(state); }
      }
      return this.expire(state);
    }
    catch { return this.resetDemoData(); }
  }
  private write(state: EptwState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
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
    const state = this.read(); const id = uid(); const sequence = String(state.permits.length + 1).padStart(4, "0"); const revisionId = uid(); const today = new Date().toISOString().slice(0, 10);
    const permit: Permit = { id, permitNumber: `${input.site}-G-${input.discipline}-${today}/${sequence}`, type: "GENERAL", childIds: [], requestorId: actor.id, currentRevisionId: revisionId, revisions: [{ id: revisionId, number: 1, status: "DRAFT", data: clone(input), approvals: approvalStages(), createdAt: new Date().toISOString(), createdBy: actor.id }], activities: [], audit: [] };
    this.audit(permit, actor, "CREATED", undefined, "DRAFT"); state.permits.unshift(permit);
    this.write(state); return clone(permit);
  }
  updateDraft(id: string, input: PermitFormData, actor: User) {
    const state = this.read(), permit = this.find(state, id), revision = currentRevision(permit);
    if (!["CONTRACTOR_REQUESTOR", "MICRON_STAFF", "SUPER_ADMIN"].includes(actor.role) || permit.requestorId !== actor.id || !["DRAFT", "CHANGES_REQUESTED"].includes(revision.status)) throw new Error("This revision cannot be edited by the current user.");
    revision.data = clone(input); this.audit(permit, actor, "DRAFT_UPDATED", revision.status, revision.status); this.write(state); return clone(permit);
  }
  submitPermit(id: string, actor: User) { return this.performTransition(id, "SUBMIT", {}, actor); }
  performTransition(id: string, action: TransitionAction, payload: TransitionPayload, actor: User) {
    const state = this.read(), permit = this.find(state, id), revision = currentRevision(permit), before = revision.status;
    const decision = getActionDecision(permit, action, actor, state.permits, payload.comment); if (!decision.allowed) throw new Error(decision.reason);
    if (action === "SUBMIT") { revision.status = "INDIVIDUAL_REVIEW"; revision.submittedAt = new Date().toISOString(); revision.approvals = approvalStages(); }
    if (action === "APPROVE") { const stage = revision.approvals.find((item) => item.role === (before === "INDIVIDUAL_REVIEW" ? "INDIVIDUAL_REVIEWER" : before === "MT_REVIEW" ? "MT_GROUP" : "PM")); if (stage) Object.assign(stage, { status: "APPROVED", actorId: actor.id, actedAt: new Date().toISOString(), comment: payload.comment }); revision.status = nextApprovalStatus(before); if (revision.status === "APPROVED" && revision.number > 1) permit.revisions.filter((item) => item.id !== revision.id && ["APPROVED", "SUSPENDED", "ACTIVE", "EXPIRED"].includes(item.status)).forEach((item) => { item.status = "SUPERSEDED"; }); }
    if (action === "REQUEST_CHANGES") { const stage = revision.approvals.find((item) => item.role === (before === "INDIVIDUAL_REVIEW" ? "INDIVIDUAL_REVIEWER" : before === "MT_REVIEW" ? "MT_GROUP" : "PM")); if (stage) Object.assign(stage, { status: "CHANGES_REQUESTED", actorId: actor.id, actedAt: new Date().toISOString(), comment: payload.comment }); revision.status = "CHANGES_REQUESTED"; }
    if (action === "REJECT") { const stage = revision.approvals.find((item) => item.role === (before === "INDIVIDUAL_REVIEW" ? "INDIVIDUAL_REVIEWER" : before === "MT_REVIEW" ? "MT_GROUP" : "PM")); if (stage) Object.assign(stage, { status: "REJECTED", actorId: actor.id, actedAt: new Date().toISOString(), comment: payload.comment }); revision.status = "REJECTED"; }
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
    const old = previous.status; if (old === "ACTIVE") previous.status = "SUSPENDED"; const next = { ...clone(previous), id: uid(), number: previous.number + 1, status: "DRAFT" as const, approvals: approvalStages(), createdAt: new Date().toISOString(), createdBy: actor.id, submittedAt: undefined };
    permit.revisions.push(next); permit.currentRevisionId = next.id; this.audit(permit, actor, "REVISION_CREATED", old, "DRAFT", `Revision ${next.number} created; prior approved record retained.`); this.write(state); return clone(permit);
  }
  resetDemoData() { const state = createSeedState(); this.write(state); return clone(state); }
}

export const repository = new LocalPermitRepository();
export { STORAGE_KEY };
