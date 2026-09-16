import { beforeEach, describe, expect, it } from "vitest";
import { USERS } from "../src/constants";
import { blankPermitData } from "../src/data";
import { LocalPermitRepository, STORAGE_KEY } from "../src/repository";
import { currentRevision } from "../src/types";

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

  it("executes the sequential approval workflow and enforces child gating", () => {
    const repo = new LocalPermitRepository(); const parent = repo.getPermit("permit-hot-parent")!; const childId = parent.childIds[0];
    expect(() => repo.performTransition(parent.id, "APPROVE", {}, user("pm-1"))).toThrow(/child permits/i);
    repo.performTransition(childId, "APPROVE", {}, user("pm-1")); repo.performTransition(parent.id, "APPROVE", {}, user("pm-1"));
    expect(currentRevision(repo.getPermit(parent.id)!).status).toBe("APPROVED");
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
});
