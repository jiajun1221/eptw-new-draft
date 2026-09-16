import type { SafetyChecklistResponse, SafetyChecklistResponses } from "./types";

export type SafetyChecklistTabId = "health-safety" | "ehs-permits" | "environmental";
export type SafetyChecklistKind = "impact" | "permit" | "environmental" | "environmental-other";

export type SafetyChecklistItem = {
  id: string;
  tab: SafetyChecklistTabId;
  label: string;
  reference?: string;
  kind: SafetyChecklistKind;
};

export const SAFETY_CHECKLIST_TABS: { id: SafetyChecklistTabId; badge: string; label: string; shortLabel: string; description: string }[] = [
  { id: "health-safety", badge: "A", label: "Section 2a: Health & Safety Impact", shortLabel: "Health & Safety", description: "Identify work that can affect people, operations, or site safety systems." },
  { id: "ehs-permits", badge: "B", label: "Section 2b: EHS Permit-to-Work System", shortLabel: "EHS Permit", description: "Select accompanying permits and checklists required before work starts." },
  { id: "environmental", badge: "C", label: "Section 2c: Environmental Impact", shortLabel: "Environmental", description: "Identify environmental impacts that require an EAI assessment." },
];

const impacts: Omit<SafetyChecklistItem, "tab" | "kind">[] = [
  { id: "portable-water", label: "Proposed work affecting portable water" },
  { id: "operations-traffic", label: "Proposed work affecting operations, traffic, or truck loading / unloading areas", reference: "#A2" },
  { id: "emergency-egress", label: "Proposed work affecting emergency exit doors, passageways, signs, or access", reference: "#A2" },
  { id: "chemical-gas-lines", label: "Proposed breaking of chemical or gas lines, demolition, decontamination, or disposal", reference: "#A3" },
  { id: "initial-charge-in", label: "Proposed initial chemical / gas charge-in or initial tool power-up", reference: "#A4" },
  { id: "safety-equipment", label: "Proposed relocation of safety equipment or fire-protection systems" },
  { id: "ladder-use", label: "Proposed ladder use within an existing building or operation", reference: "#A5" },
  { id: "material-lifting", label: "Proposed use of material lifter / lifting equipment or lifting of pressure vessels", reference: "#A6" },
  { id: "explosive-tools", label: "Proposed use of explosive-powered or projectile tools", reference: "#A7" },
  { id: "excavation", label: "Proposed excavation works", reference: "#A8" },
  { id: "scaffolding", label: "Proposed erection, alteration, or dismantling of scaffolding", reference: "#A4(a–c)" },
  { id: "raised-floor", label: "Proposed raised metal floor opening with entry beneath the floor", reference: "#A10" },
  { id: "srl-srd", label: "Proposed use of self-retractable lanyard or device", reference: "#A11" },
  { id: "mewp", label: "Proposed use of personnel lift / MEWP", reference: "#A12" },
  { id: "demolition", label: "Proposed use of demolition methods or tools", reference: "#A13" },
];

const permits: Omit<SafetyChecklistItem, "tab" | "kind">[] = [
  { id: "hot-work", label: "Hot Work Permit (work involving ignition sources)", reference: "#B1" },
  { id: "confined-space", label: "Confined Space Entry Work Permit", reference: "#B2" },
  { id: "crane-lifting", label: "Crane Lifting Permit", reference: "#B3" },
  { id: "work-at-height", label: "Work at Height Permit", reference: "#B4" },
  { id: "lss-impairment", label: "LSS Impairment Permit", reference: "#B5" },
];

const environmental: Omit<SafetyChecklistItem, "tab" | "kind">[] = [
  { id: "air-emission", label: "Potential air / GHG emission, odour, or radiation" },
  { id: "noise-nuisance", label: "Potential noise nuisance to the public" },
  { id: "stormwater-discharge", label: "Potential discharge outside containment or into stormwater drain" },
  { id: "solid-hazardous-waste", label: "Solid hazardous waste generation" },
  { id: "liquid-chemical-waste", label: "Liquid chemical waste generation" },
  { id: "soil-contamination", label: "Potential soil contamination due to spill or leak" },
  { id: "environmental-other", label: "Other environmental impact — specify below" },
];

export const SAFETY_CHECKLIST_ITEMS: SafetyChecklistItem[] = [
  ...impacts.map((item) => ({ ...item, tab: "health-safety" as const, kind: "impact" as const })),
  ...permits.map((item) => ({ ...item, tab: "ehs-permits" as const, kind: "permit" as const })),
  ...environmental.map((item) => ({ ...item, tab: "environmental" as const, kind: item.id === "environmental-other" ? "environmental-other" as const : "environmental" as const })),
];

export const checklistItem = (id: string) => SAFETY_CHECKLIST_ITEMS.find((item) => item.id === id);
export const checklistItemsForTab = (tab: SafetyChecklistTabId) => SAFETY_CHECKLIST_ITEMS.filter((item) => item.tab === tab);
export const checklistResponse = (kind: SafetyChecklistKind): SafetyChecklistResponse => kind === "impact"
  ? { impactDetails: "", controls: "", references: "" }
  : kind === "permit"
    ? { executionDetails: "", micronReference: "", hasExternalPermit: false, externalPermitNumber: "" }
    : kind === "environmental-other"
      ? { impactDescription: "", assessmentPlan: "", eaiReference: "" }
      : { assessmentPlan: "", eaiReference: "" };

const text = (response: Record<string, string | boolean> | undefined, field: string) => String(response?.[field] ?? "").trim();

export function safetyChecklistErrors(responses: SafetyChecklistResponses | undefined) {
  const errors: Record<string, string[]> = {};
  Object.entries(responses ?? {}).forEach(([id, response]) => {
    const item = checklistItem(id);
    if (!item) return;
    const missing: string[] = [];
    if (item.kind === "impact") {
      if (!text(response, "impactDetails")) missing.push("Work impact details");
      if (!text(response, "controls")) missing.push("Controls and prerequisites");
    }
    if (item.kind === "permit") {
      if (!text(response, "executionDetails")) missing.push("Execution details");
      if (response.hasExternalPermit === true && !text(response, "externalPermitNumber")) missing.push("Non-Micron permit number");
    }
    if (item.kind === "environmental" || item.kind === "environmental-other") {
      if (item.kind === "environmental-other" && !text(response, "impactDescription")) missing.push("Environmental impact description");
      if (!text(response, "assessmentPlan")) missing.push("Assessment and control plan");
      if (!text(response, "eaiReference")) missing.push("EAI assessment reference");
    }
    if (missing.length) errors[id] = missing;
  });
  return errors;
}

export const safetyChecklistComplete = (responses: SafetyChecklistResponses | undefined) => Object.keys(safetyChecklistErrors(responses)).length === 0;
