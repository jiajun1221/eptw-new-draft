import { beforeEach, describe, expect, it } from "vitest";
import { LocalPermitRepository } from "../src/repository";
import { currentRevision, type User } from "../src/types";

describe("section edit permissions", () => {
  const repository = new LocalPermitRepository();
  const assessor: User = { id: "assessor", name: "Assessor", email: "assessor@example.com", role: "ASSESSOR" };
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("eptw-templates:v4", JSON.stringify([{ id: "template", sections: [{ id: "allowed", editAccess: { assessor: true, mtGroupIds: ["group-facilities"] }, fields: [{ id: "reading", type: "TEXT" }] }, { id: "locked", fields: [{ id: "secret", type: "TEXT" }] }] }]));
  });
  const create = () => { const seed = repository.resetDemoData().permits[0]; return repository.createPermit({ ...currentRevision(seed).data, templateId: "template", assessorIds: [assessor.id], mtGroups: ["Facilities MT"], customFields: { secret: "unchanged" } }, { id: "owner", name: "Owner", email: "owner@example.com", role: "CONTRACTOR_REQUESTOR" }); };
  it("allows an assigned Assessor to update only a granted section and audits it", () => {
    const permit = create();
    const saved = repository.updateSection(permit.id, "allowed", { reading: "42" }, assessor);
    expect(currentRevision(saved).data.customFields).toEqual({ secret: "unchanged", reading: "42" });
    expect(saved.audit[0].action).toBe("SECTION_UPDATED");
    expect(() => repository.updateSection(permit.id, "locked", { secret: "changed" }, assessor)).toThrow();
    expect(() => repository.updateSection(permit.id, "allowed", { secret: "changed" }, assessor)).toThrow();
    expect(() => repository.updateSection(permit.id, "allowed", { reading: "43" }, { ...assessor, id: "unassigned" })).toThrow();
  });
  it("requires matching MT membership and permit group assignment", () => {
    const permit = create();
    const staff: User = { id: "mt-1", name: "MT", email: "mt@example.com", role: "MICRON_STAFF" };
    expect(currentRevision(repository.updateSection(permit.id, "allowed", { reading: "MT value" }, staff)).data.customFields?.reading).toBe("MT value");
    expect(() => repository.updateSection(permit.id, "allowed", { reading: "wrong" }, { ...staff, id: "outsider" })).toThrow();
  });
});
