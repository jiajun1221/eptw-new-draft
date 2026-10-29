import { describe, expect, it } from "vitest";
import { USERS } from "../src/domain/constants";
import { createSeedState } from "../src/domain/data";
import { effectiveStatus, getActionDecision, isComplete, nextApprovalStatus } from "../src/domain/policy";
import { currentRevision } from "../src/domain/types";

const user = (id: string) => USERS.find((item) => item.id === id)!;

describe("central workflow policy", () => {
  it("requires a complete permit before submission", () => {
    const state = createSeedState(); const draft = state.permits.find((p) => p.id === "permit-draft")!;
    expect(isComplete(currentRevision(draft).data, draft.type)).toBe(false);
    expect(getActionDecision(draft, "SUBMIT", user("req-1"), state.permits).allowed).toBe(false);
  });

  it("allows only the assigned role at each sequential stage", () => {
    const state = createSeedState(); const permit = state.permits.find((p) => p.id === "permit-review")!;
    expect(getActionDecision(permit, "APPROVE", user("pm-1"), state.permits).allowed).toBe(true);
    expect(getActionDecision(permit, "APPROVE", user("ir-1"), state.permits).reason).toMatch(/assignment.*current approval stage/i);
    expect(getActionDecision(permit, "APPROVE", user("mt-1"), state.permits).reason).toMatch(/assignment.*current approval stage/i);
    expect(nextApprovalStatus("INDIVIDUAL_REVIEW")).toBe("MT_REVIEW");
    expect(nextApprovalStatus("MT_REVIEW")).toBe("PM_REVIEW");
    expect(nextApprovalStatus("PM_REVIEW")).toBe("AREA_MANAGER_REVIEW");
    expect(nextApprovalStatus("AREA_MANAGER_REVIEW")).toBe("MT_GROUP_REVIEW");
    expect(nextApprovalStatus("MT_GROUP_REVIEW")).toBe("FINAL_MT_REVIEW");
    expect(nextApprovalStatus("FINAL_MT_REVIEW")).toBe("APPROVED");
  });

  it("allows only each assigned approver as the permit advances through all six stages", () => {
    const state = createSeedState(); const permit = state.permits.find((p) => p.id === "permit-review")!; const data = currentRevision(permit).data;
    expect(getActionDecision(permit, "APPROVE", user("pm-1"), state.permits).allowed).toBe(true);
    currentRevision(permit).status = "MT_REVIEW";
    expect(getActionDecision(permit, "APPROVE", user("supervisor-1"), state.permits).allowed).toBe(true);
    currentRevision(permit).status = "PM_REVIEW";
    expect(getActionDecision(permit, "APPROVE", user("admin-1"), state.permits).allowed).toBe(true);
    currentRevision(permit).status = "AREA_MANAGER_REVIEW";
    expect(getActionDecision(permit, "APPROVE", user("ir-1"), state.permits).allowed).toBe(true);
    currentRevision(permit).status = "MT_GROUP_REVIEW";
    data.mtGroups = ["F10A1 AMHS Engineer", "Facilities MT"];
    expect(getActionDecision(permit, "APPROVE", user("mt-1"), state.permits).allowed).toBe(true);
    currentRevision(permit).status = "FINAL_MT_REVIEW";
    expect(getActionDecision(permit, "APPROVE", user("mt-1"), state.permits).allowed).toBe(true);
  });

  it("prevents self approval and does not give Micron Admin an approval override", () => {
    const state = createSeedState(); const permit = state.permits.find((p) => p.id === "permit-review")!;
    const selfReviewer = { ...user("ir-1"), id: permit.requestorId };
    expect(getActionDecision(permit, "APPROVE", selfReviewer, state.permits).reason).toMatch(/own permit/i);
    expect(getActionDecision(permit, "APPROVE", user("admin-1"), state.permits).allowed).toBe(false);
    expect(getActionDecision(permit, "APPROVE", user("admin-1"), state.permits).reason).toMatch(/assignment.*current approval stage/i);
  });

  it("prevents submission when the creator is assigned as an approver", () => {
    const state = createSeedState(); const permit = state.permits.find((p) => p.id === "permit-draft")!; const creator = user(permit.requestorId);
    currentRevision(permit).data.hostManagerId = creator.id;
    expect(getActionDecision(permit, "SUBMIT", creator, state.permits).reason).toMatch(/cannot assign yourself/i);
  });

  it("allows a Micron Supervisor only at their assigned host-supervisor stage", () => {
    const state = createSeedState(); const permit = state.permits.find((p) => p.id === "permit-review")!;
    const supervisor = user("supervisor-1");
    expect(getActionDecision(permit, "APPROVE", supervisor, state.permits).allowed).toBe(false);
    expect(getActionDecision(permit, "REQUEST_CHANGES", supervisor, state.permits, "Needs revision").allowed).toBe(false);
    expect(getActionDecision(permit, "REJECT", supervisor, state.permits, "Not acceptable").allowed).toBe(false);
    currentRevision(permit).status = "MT_REVIEW";
    expect(getActionDecision(permit, "APPROVE", supervisor, state.permits).allowed).toBe(true);
  });

  it("keeps parent approval independent from child permit status", () => {
    const state = createSeedState(); const parent = state.permits.find((p) => p.id === "permit-hot-parent")!;
    expect(getActionDecision(parent, "APPROVE", user("admin-1"), state.permits).allowed).toBe(true);
  });

  it.each(["REQUEST_CHANGES", "REJECT", "SUSPEND", "RESUME", "REQUEST_CLOSURE", "CLOSE"] as const)("requires a comment for %s", (action) => {
    const state = createSeedState(); const permit = state.permits.find((p) => p.id === "permit-review")!;
    expect(getActionDecision(permit, action, user("ir-1"), state.permits).reason).toMatch(/required/i);
  });

  it("derives expiry and prevents resumption", () => {
    const state = createSeedState(); const permit = state.permits.find((p) => p.id === "permit-active")!;
    currentRevision(permit).status = "SUSPENDED";
    currentRevision(permit).data.endAt = new Date(Date.now() - 1000).toISOString();
    expect(effectiveStatus(permit)).toBe("EXPIRED");
    expect(getActionDecision(permit, "RESUME", user("pm-1"), state.permits, "Safe to resume").allowed).toBe(false);
  });
});
