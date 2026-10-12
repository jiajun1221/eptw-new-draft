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

  it("adds the walkthrough draft to older persisted demo data without resetting it", () => {
    const repo = new LocalPermitRepository();
    const state = repo.resetDemoData();
    const retained = state.permits.find((permit) => permit.id === "permit-active")!;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, permits: [retained] }));

    const permits = repo.listPermits();
    expect(permits.some((permit) => permit.id === "permit-active")).toBe(true);
    expect(currentRevision(permits.find((permit) => permit.id === "permit-draft")!).status).toBe("DRAFT");
  });

  it("keeps parent and child approval workflows independent", () => {
    const repo = new LocalPermitRepository(); const parent = repo.getPermit("permit-hot-parent")!; const childId = parent.childIds[0];
    repo.performTransition(parent.id, "APPROVE", {}, user("pm-1"));
    expect(currentRevision(repo.getPermit(parent.id)!).status).toBe("APPROVED");
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
    repo.performTransition(permit.id, "APPROVE", {}, user("ir-1")); repo.performTransition(permit.id, "APPROVE", {}, user("mt-1")); repo.performTransition(permit.id, "APPROVE", {}, user("pm-1"));
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
