import { describe, expect, it } from "vitest";
import { USERS } from "../src/constants";
import { createSeedState } from "../src/data";
import { effectiveStatus, getActionDecision, isComplete, nextApprovalStatus } from "../src/policy";
import { currentRevision } from "../src/types";

const user = (id: string) => USERS.find((item) => item.id === id)!;

describe("central workflow policy", () => {
  it("requires a complete permit before submission", () => {
    const state = createSeedState(); const draft = state.permits.find((p) => p.id === "permit-draft")!;
    expect(isComplete(currentRevision(draft).data, draft.type)).toBe(false);
    expect(getActionDecision(draft, "SUBMIT", user("req-1"), state.permits).allowed).toBe(false);
  });

  it("allows only the assigned role at each sequential stage", () => {
    const state = createSeedState(); const permit = state.permits.find((p) => p.id === "permit-review")!;
    expect(getActionDecision(permit, "APPROVE", user("ir-1"), state.permits).allowed).toBe(true);
    expect(getActionDecision(permit, "APPROVE", user("mt-1"), state.permits).reason).toMatch(/assignment.*current approval stage/i);
    expect(nextApprovalStatus("INDIVIDUAL_REVIEW")).toBe("MT_REVIEW");
    expect(nextApprovalStatus("MT_REVIEW")).toBe("PM_REVIEW");
    expect(nextApprovalStatus("PM_REVIEW")).toBe("APPROVED");
  });

  it("allows any selected reviewer and any selected MT Group member at their stage", () => {
    const state = createSeedState(); const permit = state.permits.find((p) => p.id === "permit-review")!; const data = currentRevision(permit).data;
    data.individualReviewerIds = ["ir-1", "mt-1"];
    expect(getActionDecision(permit, "APPROVE", user("mt-1"), state.permits).allowed).toBe(true);
    currentRevision(permit).status = "MT_REVIEW";
    data.mtGroups = ["F10A1 AMHS Engineer", "Facilities MT"];
    expect(getActionDecision(permit, "APPROVE", user("mt-1"), state.permits).allowed).toBe(true);
  });

  it("prevents self approval and allows Micron Admin support", () => {
    const state = createSeedState(); const permit = state.permits.find((p) => p.id === "permit-review")!;
    const selfReviewer = { ...user("ir-1"), id: permit.requestorId };
    expect(getActionDecision(permit, "APPROVE", selfReviewer, state.permits).reason).toMatch(/own permit/i);
    expect(getActionDecision(permit, "APPROVE", user("admin-1"), state.permits).allowed).toBe(true);
  });

  it("keeps Micron Supervisors read-only throughout the permit workflow", () => {
    const state = createSeedState(); const permit = state.permits.find((p) => p.id === "permit-review")!;
    const supervisor = user("supervisor-1");
    expect(getActionDecision(permit, "APPROVE", supervisor, state.permits).allowed).toBe(false);
    expect(getActionDecision(permit, "REQUEST_CHANGES", supervisor, state.permits, "Needs revision").allowed).toBe(false);
    expect(getActionDecision(permit, "REJECT", supervisor, state.permits, "Not acceptable").allowed).toBe(false);
  });

  it("blocks parent final approval until its child is approved", () => {
    const state = createSeedState(); const parent = state.permits.find((p) => p.id === "permit-hot-parent")!;
    expect(getActionDecision(parent, "APPROVE", user("pm-1"), state.permits).reason).toMatch(/child permits/i);
    currentRevision(state.permits.find((p) => p.id === "permit-hot-child")!).status = "APPROVED";
    expect(getActionDecision(parent, "APPROVE", user("pm-1"), state.permits).allowed).toBe(true);
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
