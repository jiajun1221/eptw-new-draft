import { beforeEach, describe, expect, it } from "vitest";
import { USERS } from "../src/domain/constants";
import { blankPermitData } from "../src/domain/data";
import { LocalPermitRepository, STORAGE_KEY } from "../src/domain/repository";
import { currentRevision } from "../src/domain/types";

const user = (id: string) => USERS.find((item) => item.id === id)!;
const complete = () => ({ ...blankPermitData(), title: "Cooling pipe welding", description: "Replace the damaged cooling pipe under controlled conditions.", location: "Utility bay 2", company: "Acme Engineering", hazards: ["HOT_WORK"], safetyDeclarations: ["Risk assessment reviewed", "Workers briefed", "Area barricaded"], hotWork: { fireWatchName: "Lee Wei", fireWatchMobile: "+65 8123 4567", gasTestingRequired: true, combustibleMaterialsRemoved: true, extinguishersAvailable: true } });

describe("local permit repository", () => {
  beforeEach(() => localStorage.clear());

  it("keeps selected Hot Work checklist data embedded in the parent permit", () => {
    const repo = new LocalPermitRepository(); const data = complete(); data.safetyChecklistResponses = { "hot-work": { executionDetails: "Fire watch and isolation are arranged.", micronReference: "B1-2026-44", hasExternalPermit: false, externalPermitNumber: "" } };
    const parent = repo.createPermit(data, user("req-1")); const reloaded = new LocalPermitRepository(); const saved = reloaded.getPermit(parent.id)!;
    expect(saved.childIds).toEqual([]); expect(currentRevision(saved).data.safetyChecklistResponses?.["hot-work"].executionDetails).toContain("Fire watch"); expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it("duplicates a permit as an editable draft owned by the current user", () => {
    const repo = new LocalPermitRepository(); const source = repo.getPermit("permit-review")!; const sourceData = currentRevision(source).data;
    sourceData.customFields = { "work-description": "Copied work details", building: ["ADMIN"] };
    const copy = repo.duplicatePermit(source.id, sourceData, user("req-2")); const revision = currentRevision(copy);

    expect(copy.id).not.toBe(source.id);
    expect(copy.requestorId).toBe("req-2");
    expect(revision.status).toBe("DRAFT");
    expect(revision.data.customFields).toEqual(sourceData.customFields);
    expect(revision.approvals.every((approval) => approval.status === "PENDING")).toBe(true);
    expect(copy.audit[0].action).toBe("DUPLICATED_FROM");
    expect(copy.childIds).toEqual([]);
  });

  it("adds the walkthrough draft to older persisted demo data without resetting it", () => {
    const repo = new LocalPermitRepository();
    const state = repo.resetDemoData();
    const retained = state.permits.find((permit) => permit.id === "permit-active")!;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, permits: [retained] }));

    const permits = repo.listPermits();
    expect(permits.some((permit) => permit.id === "permit-active")).toBe(true);
    expect(currentRevision(permits.find((permit) => permit.id === "permit-draft")!).status).toBe("DRAFT");
  });

  it("repairs legacy approval routes that assign the permit submitter as an approver", () => {
    const repo = new LocalPermitRepository(); const state = repo.resetDemoData(); const permit = state.permits.find((item) => item.id === "permit-review")!; const revision = currentRevision(permit);
    revision.data.hostSupervisorId = permit.requestorId;
    revision.data.hostManagerId = permit.requestorId;
    revision.data.individualReviewerId = permit.requestorId;
    revision.data.individualReviewerIds = [permit.requestorId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    const repaired = repo.getPermit(permit.id)!; const data = currentRevision(repaired).data;
    expect(data.hostSupervisorId).not.toBe(repaired.requestorId);
    expect(data.hostManagerId).not.toBe(repaired.requestorId);
    expect(data.individualReviewerIds).not.toContain(repaired.requestorId);
    expect(repaired.audit[0].action).toBe("APPROVAL_ROUTE_REASSIGNED");
  });

  it("normalizes out-of-order legacy approval markers to the current workflow stage", () => {
    const repo = new LocalPermitRepository(); const state = repo.resetDemoData(); const permit = state.permits.find((item) => item.id === "permit-hot-parent")!; const revision = currentRevision(permit);
    revision.status = "PM_REVIEW";
    revision.approvals = revision.approvals.map((stage) => ({ ...stage, status: stage.role === "MT_GROUP" ? "APPROVED" as const : "PENDING" as const }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    const repaired = currentRevision(repo.getPermit(permit.id)!);
    expect(repaired.approvals.find((stage) => stage.role === "VENDOR_PM")?.status).toBe("APPROVED");
    expect(repaired.approvals.find((stage) => stage.role === "HOST_SUPERVISOR")?.status).toBe("APPROVED");
    expect(repaired.approvals.find((stage) => stage.role === "HOST_MANAGER")?.status).toBe("PENDING");
    expect(repaired.approvals.find((stage) => stage.role === "MT_GROUP")?.status).toBe("PENDING");
  });

  it("requires selected Area Managers to approve one by one in selection order", () => {
    const repo = new LocalPermitRepository(); const state = repo.resetDemoData(); const permit = state.permits.find((item) => item.id === "permit-review")!; const revision = currentRevision(permit);
    revision.status = "AREA_MANAGER_REVIEW";
    revision.data.individualReviewerId = "ir-1";
    revision.data.individualReviewerIds = ["ir-1", "mt-1", "ms-2"];
    revision.areaManagerApprovals = undefined;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    expect(() => repo.performTransition(permit.id, "APPROVE", {}, user("mt-1"))).toThrow(/current approval stage/i);
    repo.performTransition(permit.id, "APPROVE", {}, user("ir-1"));
    let current = currentRevision(repo.getPermit(permit.id)!);
    expect(current.status).toBe("AREA_MANAGER_REVIEW");
    expect(current.areaManagerApprovals?.map((approval) => approval.status)).toEqual(["APPROVED", "PENDING", "PENDING"]);

    repo.performTransition(permit.id, "APPROVE", {}, user("mt-1"));
    current = currentRevision(repo.getPermit(permit.id)!);
    expect(current.status).toBe("AREA_MANAGER_REVIEW");
    expect(() => repo.performTransition(permit.id, "APPROVE", {}, user("ir-1"))).toThrow(/current approval stage/i);

    repo.performTransition(permit.id, "APPROVE", {}, user("ms-2"));
    current = currentRevision(repo.getPermit(permit.id)!);
    expect(current.status).toBe("MT_GROUP_REVIEW");
    expect(current.areaManagerApprovals?.every((approval) => approval.status === "APPROVED")).toBe(true);
  });

  it("never allows the permit submitter to approve their own permit", () => {
    const repo = new LocalPermitRepository(); const permit = repo.getPermit("permit-review")!;
    expect(() => repo.performTransition(permit.id, "APPROVE", {}, user(permit.requestorId))).toThrow(/own permit/i);
  });

  it("keeps parent and child approval workflows independent", () => {
    const repo = new LocalPermitRepository(); const parent = repo.getPermit("permit-hot-parent")!; const childId = parent.childIds[0];
    repo.performTransition(parent.id, "APPROVE", {}, user("admin-1"));
    expect(currentRevision(repo.getPermit(parent.id)!).status).toBe("AREA_MANAGER_REVIEW");
    expect(currentRevision(repo.getPermit(childId)!).status).toBe("PM_REVIEW");
  });

  it("records operational logs and PM-verified closure", () => {
    const repo = new LocalPermitRepository(); const permit = repo.getPermit("permit-active")!;
    repo.addActivityLog(permit.id, { date: new Date().toISOString(), summary: "Barricade and isolation rechecked.", safetyConfirmed: true }, user("req-1"));
    repo.performTransition(permit.id, "REQUEST_CLOSURE", { comment: "Work complete; area restored." }, user("req-1")); repo.performTransition(permit.id, "CLOSE", { comment: "Restoration inspected and accepted." }, user("mt-1"));
    const closed = repo.getPermit(permit.id)!; expect(currentRevision(closed).status).toBe("CLOSED"); expect(closed.audit.some((event) => event.action === "CLOSE")).toBe(true);
  });

  it("keeps the previous revision and supersedes it after reapproval", () => {
    const repo = new LocalPermitRepository(); const permit = repo.getPermit("permit-active")!; repo.createRevision(permit.id, user("req-1")); repo.submitPermit(permit.id, user("req-1"));
    repo.performTransition(permit.id, "APPROVE", {}, user("pm-1"));
    repo.performTransition(permit.id, "APPROVE", {}, user("supervisor-1"));
    repo.performTransition(permit.id, "APPROVE", {}, user("admin-1"));
    repo.performTransition(permit.id, "APPROVE", {}, user("ir-1"));
    repo.performTransition(permit.id, "APPROVE", {}, user("mt-1"));
    repo.performTransition(permit.id, "APPROVE", {}, user("mt-1"));
    const revised = repo.getPermit(permit.id)!; expect(revised.revisions).toHaveLength(2); expect(revised.revisions[0].status).toBe("SUPERSEDED"); expect(currentRevision(revised).number).toBe(2);
  });

  it("lets only the owner delete a draft and removes its attached children", () => {
    const repo = new LocalPermitRepository();
    const parent = repo.createPermit(complete(), user("req-1"));
    repo.syncAttachedChildren(parent.id, [{ key: "b1", code: "B1", data: { ...complete(), templateId: "tpl-child-b1", templateName: "HOT WORKS" } }], user("req-1"));
    const childId = repo.getPermit(parent.id)!.childIds[0];

    expect(() => repo.deleteDraft(parent.id, user("req-2"))).toThrow(/only the owner/i);
    repo.deleteDraft(parent.id, user("req-1"));

    expect(repo.getPermit(parent.id)).toBeUndefined();
    expect(repo.getPermit(childId)).toBeUndefined();
  });

  it("does not recreate an attached child draft after the owner deletes it", () => {
    localStorage.setItem("eptw-templates:v4", JSON.stringify([
      { id: "parent-template", kind: "PARENT", code: "G", name: "General", sections: [{ fields: [{ id: "children", type: "MULTI_CHECKBOX", childTemplateIds: ["b1"] }] }] },
      { id: "b1", kind: "CHILD", code: "B1", name: "Hot Work" },
    ]));
    const repo = new LocalPermitRepository();
    const parent = repo.createPermit({ ...complete(), templateId: "parent-template", customFields: { children: ["0"] } }, user("req-1"));
    repo.syncAttachedChildren(parent.id, [{ key: "b1", code: "B1", data: { ...complete(), templateId: "b1", templateName: "Hot Work" } }], user("req-1"));
    const childId = repo.getPermit(parent.id)!.childIds[0];

    repo.deleteDraft(childId, user("req-1"));

    expect(repo.getPermit(childId)).toBeUndefined();
    expect(repo.getPermit(parent.id)!.childIds).not.toContain(childId);
    expect(repo.listPermits().filter((permit) => permit.parentId === parent.id)).toHaveLength(0);
  });
});
