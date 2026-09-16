import { describe, expect, it } from "vitest";
import { checklistItemsForTab, checklistResponse, safetyChecklistComplete, safetyChecklistErrors } from "../src/safetyChecklist";
import type { SafetyChecklistResponse, SafetyChecklistResponses } from "../src/types";

describe("embedded safety checklists", () => {
  it("keeps selections independent between tabs and discards an unchecked response", () => {
    const impact = checklistItemsForTab("health-safety")[0];
    const permit = checklistItemsForTab("ehs-permits")[0];
    const responses: SafetyChecklistResponses = {
      [impact.id]: { ...checklistResponse(impact.kind), impactDetails: "Water isolation could affect production.", controls: "Use an approved isolation and notify operations." },
      [permit.id]: { ...checklistResponse(permit.kind), executionDetails: "Assign a fire watch before welding begins." },
    };

    expect(Object.keys(responses)).toHaveLength(2);
    delete responses[impact.id];
    expect(responses[permit.id].executionDetails).toContain("fire watch");
    expect(responses[impact.id]).toBeUndefined();
  });

  it("requires the fields relevant to each selected checklist card", () => {
    const impact = checklistItemsForTab("health-safety")[0];
    const environmentalOther = checklistItemsForTab("environmental").find((item) => item.id === "environmental-other")!;
    const errors = safetyChecklistErrors({
      [impact.id]: checklistResponse(impact.kind),
      [environmentalOther.id]: checklistResponse(environmentalOther.kind),
    });

    expect(errors[impact.id]).toEqual(["Work impact details", "Controls and prerequisites"]);
    expect(errors[environmentalOther.id]).toEqual(["Environmental impact description", "Assessment and control plan", "EAI assessment reference"]);
  });

  it("requires an external permit number only when the declaration is selected", () => {
    const hotWork = checklistItemsForTab("ehs-permits")[0];
    const response: SafetyChecklistResponse = { ...checklistResponse(hotWork.kind), executionDetails: "Set up barriers and a fire watch." };
    expect(safetyChecklistComplete({ [hotWork.id]: response })).toBe(true);
    response.hasExternalPermit = true;
    expect(safetyChecklistErrors({ [hotWork.id]: response })[hotWork.id]).toEqual(["Non-Micron permit number"]);
    response.externalPermitNumber = "EXT-PTW-42";
    expect(safetyChecklistComplete({ [hotWork.id]: response })).toBe(true);
  });
});
