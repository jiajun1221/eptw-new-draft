import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "C:/Users/jchng/eptw-new-draft";
const SKILL_DIR = "C:/Users/jchng/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const RUNTIME_PYTHON = "C:/Users/jchng/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
process.env.RUNTIME_NODE = "C:/Users/jchng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";
process.env.RUNTIME_NODE_MODULES = "C:/Users/jchng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
process.env.RUNTIME_BIN_DIR = "C:/Users/jchng/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override";
process.env.RUNTIME_PYTHON = RUNTIME_PYTHON;
const templatePath = path.join(workspaceDir, ".work", "inputs", "OST-PPT-Template-Apr-2026.potx");
const fontReferencePath = path.join(workspaceDir, ".work", "inputs", "OST-PPT-Template-Apr-2026-reference.pptx");
const stagingDir = path.join(workspaceDir, ".codex-finalizer");
const finalPath = path.join(workspaceDir, "output", "ePTW-System-Rebuild-Proposal.pptx");
await fs.mkdir(stagingDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });
await fs.copyFile(templatePath, fontReferencePath);

const presentation = await PresentationFile.importPptx(await FileBlob.load(templatePath));
while (presentation.slides.count > 0) presentation.slides.remove(0);

const W = 1280;
const H = 720;
const NAVY = "#0B1F4D";
const BLUE = "#0072BC";
const SKY = "#00B0F0";
const ORANGE = "#F26B43";
const INK = "#172033";
const MID = "#5D6675";
const LIGHT = "#EEF3F8";
const PALE_BLUE = "#E8F4FB";
const PALE_ORANGE = "#FFF1EB";
const WHITE = "#FFFFFF";
const GREEN = "#2E7D5A";
const RED = "#B43B35";
const HEAD = "Bahnschrift";
const BODY = "Segoe UI";
const px = (pt) => pt * 4 / 3;

function addText(slide, text, left, top, width, height, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: opts.name,
    position: { left, top, width, height },
    fill: opts.fill ?? "none",
    line: opts.line ?? { fill: "none", width: 0 },
    borderRadius: opts.borderRadius,
  });
  shape.text = text;
  shape.text.style = {
    typeface: opts.typeface ?? BODY,
    fontSize: px(opts.size ?? 18),
    bold: opts.bold ?? false,
    color: opts.color ?? INK,
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "top",
    autoFit: opts.autoFit ?? "shrinkText",
    wrap: "square",
    insets: opts.insets ?? { top: 4, right: 4, bottom: 4, left: 4 },
  };
  return shape;
}

function box(slide, left, top, width, height, fill = LIGHT, line = "#D4DEE8", radius = 10) {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: radius,
  });
}

function addTitle(slide, number, title, subtitle) {
  addText(slide, number, 74, 116, 44, 36, { size: 15, bold: true, color: ORANGE, typeface: HEAD, valign: "middle" });
  addText(slide, title, 136, 108, 1054, 58, { size: title.length > 45 ? 27 : 31, bold: true, color: NAVY, typeface: HEAD, valign: "middle", autoFit: "none" });
  if (subtitle) addText(slide, subtitle, 136, 158, 1040, 34, { size: 14, color: MID, valign: "middle", autoFit: "none" });
}

function addBullet(slide, text, left, top, width, opts = {}) {
  slide.shapes.add({ geometry: "rect", position: { left, top: top + 8, width: 7, height: 7 }, fill: opts.color ?? ORANGE, line: { fill: "none", width: 0 } });
  return addText(slide, text, left + 18, top, width - 18, opts.height ?? 58, { size: opts.size ?? 17, color: opts.textColor ?? INK, bold: opts.bold ?? false });
}

function addColumnHeading(slide, title, left, top, width, accent = BLUE) {
  slide.shapes.add({ geometry: "line", position: { left, top: top + 44, width: 46, height: 0 }, fill: "none", line: { style: "solid", fill: accent, width: 4 } });
  addText(slide, title, left, top, width, 42, { size: 21, bold: true, color: NAVY, typeface: HEAD, valign: "middle" });
}

function addStep(slide, n, title, detail, left, top, width, accent = BLUE) {
  const circle = slide.shapes.add({ geometry: "ellipse", position: { left, top, width: 42, height: 42 }, fill: accent, line: { fill: "none", width: 0 } });
  circle.text = String(n);
  circle.text.style = { typeface: HEAD, fontSize: px(16), bold: true, color: WHITE, alignment: "center", verticalAlignment: "middle", autoFit: "none" };
  addText(slide, title, left + 54, top - 1, width - 54, 30, { size: 17, bold: true, color: NAVY, typeface: HEAD, valign: "middle" });
  addText(slide, detail, left + 54, top + 30, width - 54, 70, { size: 13.5, color: MID });
  return circle;
}

function connect(slide, from, to, fromSide = "right", toSide = "left", color = "#8CA1B8") {
  return slide.shapes.connect(from, to, { kind: "straight", fromSide, toSide, line: { style: "solid", fill: color, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } });
}

function note(slide, sources, message = "") {
  slide.speakerNotes.textFrame.setText([message, "Sources:", ...sources.map((s) => `- ${s}`)].filter(Boolean).join("\n"));
}

function styleTable(table, rows, cols, opts = {}) {
  table.borders.assign({ style: "solid", fill: "#D5DEE8", width: 1 });
  table.cells.block({ row: 0, column: 0, rowCount: 1, columnCount: cols }).assign({
    fill: NAVY,
    textStyle: { typeface: BODY, fontSize: px(opts.headerSize ?? 13), bold: true, color: WHITE },
    margins: { top: 8, right: 9, bottom: 8, left: 9 },
    verticalAlignment: "middle",
  });
  for (let r = 1; r < rows; r++) {
    table.cells.block({ row: r, column: 0, rowCount: 1, columnCount: cols }).assign({
      fill: r % 2 ? WHITE : "#F5F8FB",
      textStyle: { typeface: BODY, fontSize: px(opts.bodySize ?? 12.5), color: INK },
      margins: { top: 7, right: 9, bottom: 7, left: 9 },
      verticalAlignment: "middle",
    });
  }
}

// 1. Cover
{
  const slide = presentation.slides.add({ layout: "Cover" });
  addText(slide, "ePTW SYSTEM REBUILD", 88, 310, 620, 54, { size: 29, bold: true, color: WHITE, typeface: HEAD, valign: "middle" });
  addText(slide, "Proposal for a controlled, secure and maintainable Permit-to-Work platform", 88, 372, 610, 76, { size: 19, color: WHITE, typeface: BODY });
  addText(slide, "Prepared for solution alignment and implementation planning\nSeptember 2026", 88, 500, 560, 66, { size: 13.5, color: "#DCEEFF" });
  note(slide, ["OST PPT Template Apr 2026.potx"], "Purpose: present the rebuild direction and obtain approval to proceed into requirements closure and production data profiling.");
}

// 2. Executive proposal
{
  const slide = presentation.slides.add({ layout: "Blank Page" });
  addTitle(slide, "01", "Executive proposal", "Approval requested for the rebuild direction, with policy decisions closed before schema freeze");
  addText(slide, "RECOMMENDATION", 80, 215, 220, 30, { size: 13, bold: true, color: ORANGE, typeface: HEAD });
  addText(slide, "Rebuild ePTW around one controlled permit domain, a server-enforced workflow and a PostgreSQL system of record.", 80, 246, 1100, 94, { size: 28, bold: true, color: NAVY, typeface: HEAD });
  addColumnHeading(slide, "Business outcome", 80, 388, 330, BLUE);
  addText(slide, "A consistent permit journey with clearer responsibilities, stronger access control and reliable audit history.", 80, 442, 330, 112, { size: 17 });
  addColumnHeading(slide, "Technical direction", 472, 388, 330, SKY);
  addText(slide, "React web application, dedicated API and workflow service, PostgreSQL, protected file storage and a transactional notification outbox.", 472, 442, 330, 126, { size: 17 });
  addColumnHeading(slide, "Delivery approach", 864, 388, 330, ORANGE);
  addText(slide, "Freeze policy decisions, profile production data, build in increments, rehearse migration and cut over only after reconciliation gates pass.", 864, 442, 330, 126, { size: 17 });
  addText(slide, "Immediate ask: authorize requirements closure and read-only production data profiling.", 80, 616, 1100, 42, { size: 17, bold: true, color: BLUE, typeface: HEAD, valign: "middle" });
  note(slide, ["database-redesign-proposal.docx, sections 1 and 10", "ePTW-Requirements-Review.pdf, pages 5-7 and 93-95", "README.md"], "The production migration recommendation remains conditional on profiling a recent sanitized production snapshot.");
}

// 3. Evidence and authority
{
  const slide = presentation.slides.add({ layout: "Blank Page" });
  addTitle(slide, "02", "Evidence base and authority order", "Three sources contribute different types of evidence");
  const cols = [80, 462, 844];
  const titles = ["Business requirements", "Backend redesign", "Frontend prototype"];
  const subtitles = ["95-page confirmation deck", "PostgreSQL proposal and mapping", "React and TypeScript functional draft"];
  const bodies = [
    "Defines roles, user journeys, visibility, templates, closure, notifications, reporting and 16 open questions.",
    "Defines the target domain model, 27 application tables, three migration-control tables and a phased cutover approach.",
    "Demonstrates role-aware navigation, sequential approvals, linked Hot Work permits, revisions, lifecycle actions and audit views.",
  ];
  for (let i = 0; i < 3; i++) {
    addText(slide, `0${i + 1}`, cols[i], 216, 58, 42, { size: 17, bold: true, color: i === 0 ? ORANGE : BLUE, typeface: HEAD });
    addText(slide, titles[i], cols[i] + 58, 208, 275, 48, { size: 21, bold: true, color: NAVY, typeface: HEAD, valign: "middle" });
    addText(slide, subtitles[i], cols[i] + 58, 252, 275, 42, { size: 13.5, color: MID });
    addText(slide, bodies[i], cols[i], 322, 320, 136, { size: 17 });
  }
  slide.shapes.add({ geometry: "line", position: { left: 80, top: 501, width: 1100, height: 0 }, fill: "none", line: { style: "solid", fill: "#CCD8E4", width: 1 } });
  addText(slide, "Recommended authority", 80, 526, 220, 34, { size: 14, bold: true, color: ORANGE, typeface: HEAD });
  addText(slide, "Business requirements decide behaviour. The backend proposal decides implementation. The frontend prototype proves interaction patterns and controls, but does not define production architecture.", 300, 515, 880, 86, { size: 18, color: INK, bold: true });
  addText(slide, "Prototype verification: production build succeeded and all 20 automated tests passed on 11 September 2026.", 300, 607, 880, 34, { size: 14.5, color: GREEN });
  note(slide, ["ePTW-Requirements-Review.pdf", "database-redesign-proposal.docx", "old-vs-new-schema.docx", "README.md", "package.json", "tests/app.test.tsx", "tests/policy.test.ts", "tests/repository.test.ts"], "Verification run: npm.cmd run build and npm.cmd test; 3 test files and 20 tests passed.");
}

// 4. Why rebuild
{
  const slide = presentation.slides.add({ layout: "Blank Page" });
  addTitle(slide, "03", "Why the current platform needs a rebuild", "The same defects affect safety control, data integrity and operating effort");
  const issues = [
    ["Four permit shapes", "Parent permits, drafts, embedded children and child permits require duplicated logic and merged reporting."],
    ["Approval state is implicit", "Reviewer arrays and mutable group membership can change the meaning of an in-flight permit."],
    ["Operational data is untyped", "Dates and key fields appear in several formats and template-specific answer keys."],
    ["History is difficult to trust", "String logs and permit-shaped document copies cannot support precise filtering or reconciliation."],
    ["Integrity depends on application code", "Numbering races, weak uniqueness and hard-coded identifiers create avoidable failure modes."],
  ];
  for (let i = 0; i < issues.length; i++) {
    const y = 210 + i * 83;
    addText(slide, String(i + 1).padStart(2, "0"), 84, y, 48, 34, { size: 15, bold: true, color: ORANGE, typeface: HEAD, valign: "middle" });
    addText(slide, issues[i][0], 145, y - 3, 270, 40, { size: 18, bold: true, color: NAVY, typeface: HEAD, valign: "middle" });
    addText(slide, issues[i][1], 430, y - 3, 700, 57, { size: 16.5, color: INK });
    if (i < issues.length - 1) slide.shapes.add({ geometry: "line", position: { left: 145, top: y + 64, width: 985, height: 0 }, fill: "none", line: { style: "solid", fill: "#DFE6ED", width: 1 } });
  }
  addText(slide, "Repository inspection cannot quantify live defects. Production profiling must establish row counts, duplicates, nulls, orphaned references and historical variants.", 80, 625, 1100, 45, { size: 14, color: RED, bold: true });
  note(slide, ["database-redesign-proposal.docx, sections 2-3", "old-vs-new-schema.docx, sections 1-3", "ePTW-Requirements-Review.pdf, pages 5-6"], "The issues shown are code-level findings. Live prevalence remains to be measured against a sanitized production snapshot.");
}

// 5. Target experience
{
  const slide = presentation.slides.add({ layout: "Blank Page" });
  addTitle(slide, "04", "Target user experience", "One traceable permit journey from creation to archive");
  const stages = [
    ["Create", "Template-driven form, reserved fields, files and linked child permits"],
    ["Submit", "Validation completes and the company-specific approval route is fixed"],
    ["Review", "Only the current reviewer can act; reasons and signatures are recorded"],
    ["Operate", "Approved work, readings, controlled amendments and lifecycle actions"],
    ["Close", "Signed request, authorised confirmation and independent child outcomes"],
    ["Report", "Search, PDF generation, dashboards and retained audit history"],
  ];
  const shapes = [];
  for (let i = 0; i < stages.length; i++) {
    const x = 70 + i * 199;
    const s = box(slide, x, 245, 170, 168, i % 2 ? WHITE : PALE_BLUE, "#BBD4E7", 12);
    shapes.push(s);
    addText(slide, String(i + 1).padStart(2, "0"), x + 14, 260, 42, 28, { size: 13, bold: true, color: ORANGE, typeface: HEAD });
    addText(slide, stages[i][0], x + 14, 298, 140, 38, { size: 21, bold: true, color: NAVY, typeface: HEAD });
    addText(slide, stages[i][1], x + 14, 341, 142, 60, { size: 12.5, color: MID });
    if (i > 0) connect(slide, shapes[i - 1], s, "right", "left", "#93A9BC");
  }
  addText(slide, "Cross-cutting controls", 80, 481, 210, 34, { size: 16, bold: true, color: NAVY, typeface: HEAD });
  addText(slide, "Server-side authorization", 80, 526, 250, 38, { size: 16, bold: true, color: BLUE });
  addText(slide, "Versioned templates and revisions", 360, 526, 300, 38, { size: 16, bold: true, color: BLUE });
  addText(slide, "Append-only events", 710, 526, 220, 38, { size: 16, bold: true, color: BLUE });
  addText(slide, "UTC storage with Singapore display time", 940, 526, 270, 54, { size: 16, bold: true, color: BLUE });
  addText(slide, "Administration covers users, companies, sites, maps, disciplines, reviewer groups, templates, announcements and report access.", 80, 603, 1100, 46, { size: 15.5, color: MID });
  note(slide, ["ePTW-Requirements-Review.pdf, sections 5-22", "database-redesign-proposal.docx, sections 6-8", "src/App.tsx"], "This slide consolidates the proposed end-to-end user journey. Specific workflow roles remain subject to the decisions on slide 9.");
}

// 6. Architecture
{
  const slide = presentation.slides.add({ layout: "Blank Page" });
  addTitle(slide, "05", "Target application architecture", "A dedicated service boundary moves security and workflow rules out of the browser");
  const web = box(slide, 80, 268, 250, 184, PALE_BLUE, "#A9CFE8", 12);
  addText(slide, "React web application", 103, 292, 204, 42, { size: 21, bold: true, color: NAVY, typeface: HEAD, align: "center" });
  addText(slide, "Role-aware navigation\nPermit forms and lists\nAdmin and reporting views", 103, 350, 204, 86, { size: 15, color: MID, align: "center" });
  const svc = box(slide, 445, 232, 365, 256, WHITE, BLUE, 12);
  addText(slide, "API and workflow service", 470, 258, 315, 44, { size: 23, bold: true, color: NAVY, typeface: HEAD, align: "center" });
  addText(slide, "Authentication and authorization\nValidation and state transitions\nApproval sequencing and audit events\nSearch, document and report orchestration", 478, 325, 300, 125, { size: 16, color: INK, align: "center" });
  const db = box(slide, 930, 192, 260, 120, NAVY, NAVY, 12);
  addText(slide, "PostgreSQL", 953, 211, 214, 40, { size: 23, bold: true, color: WHITE, typeface: HEAD, align: "center" });
  addText(slide, "System of record", 953, 258, 214, 30, { size: 14, color: "#CFE5F6", align: "center" });
  const files = box(slide, 930, 350, 260, 94, WHITE, "#B8C7D5", 12);
  addText(slide, "Protected file storage", 948, 369, 224, 34, { size: 18, bold: true, color: NAVY, typeface: HEAD, align: "center" });
  addText(slide, "Attachments and generated output", 948, 407, 224, 25, { size: 12.5, color: MID, align: "center" });
  const notify = box(slide, 930, 482, 260, 94, WHITE, "#B8C7D5", 12);
  addText(slide, "Email delivery worker", 948, 501, 224, 34, { size: 18, bold: true, color: NAVY, typeface: HEAD, align: "center" });
  addText(slide, "Transactional outbox and retries", 948, 539, 224, 25, { size: 12.5, color: MID, align: "center" });
  connect(slide, web, svc);
  connect(slide, svc, db);
  connect(slide, svc, files);
  connect(slide, svc, notify);
  addText(slide, "Security boundary", 346, 290, 90, 25, { size: 12, bold: true, color: ORANGE, align: "center" });
  addText(slide, "Read models and scheduled exports use the same canonical data and status rules as the operational API.", 445, 553, 365, 65, { size: 15, color: GREEN, bold: true, align: "center" });
  note(slide, ["database-redesign-proposal.docx, sections 4, 5 and 7", "ePTW-Requirements-Review.pdf, sections 15-21", "README.md"], "The current frontend stores seeded data in the browser and explicitly provides no real authentication, upload, notification or backend security.");
}

// 7. Database redesign table
{
  const slide = presentation.slides.add({ layout: "Blank Page" });
  addTitle(slide, "06", "Database redesign", "The target model reduces duplication and makes workflow and reporting queryable");
  const values = [
    ["Concern", "Current design", "Target design"],
    ["Permit storage", "permits, drafts, embedded children and childpermits", "One permits table; draft is a status and child is a self-reference"],
    ["Workflow", "Reviewer arrays and overlapping state fields", "Ordered approval steps, eligible members and immutable action records"],
    ["Operational fields", "Mixed dates, strings and template-specific keys", "Typed canonical columns; JSONB only for dynamic answers"],
    ["History", "Human-readable strings and permit-shaped PDF copies", "Append-only events, immutable revisions and generated document links"],
    ["Templates and numbering", "Mutable template references and application-side counters", "Pinned template versions and transactional sequences"],
  ];
  const table = slide.tables.add({ rows: values.length, columns: 3, left: 80, top: 218, width: 1120, height: 378, columnWidths: [210, 410, 500], values });
  styleTable(table, values.length, 3, { headerSize: 14, bodySize: 13.5 });
  addText(slide, "Result: predictable filtering, reliable audit reconstruction and a migration path that preserves legacy evidence.", 80, 620, 1120, 42, { size: 16, bold: true, color: BLUE, typeface: HEAD, valign: "middle" });
  note(slide, ["database-redesign-proposal.docx, sections 3-7", "old-vs-new-schema.docx, sections 1-9"], "The proposal specifies 27 application tables and three migration-control tables.");
}

// 8. Workflow controls
{
  const slide = presentation.slides.add({ layout: "Blank Page" });
  addTitle(slide, "07", "Workflow controls proven in the prototype", "The production service should retain the control intent while adopting the confirmed business chain");
  addStep(slide, 1, "Complete permit", "Required permit and safety fields must pass validation before submission.", 85, 225, 340, BLUE);
  addStep(slide, 2, "Enforce current stage", "Only the assigned role can act. Separation of duties blocks self-approval.", 455, 225, 340, SKY);
  addStep(slide, 3, "Record every decision", "Approvals, rejection reasons, status changes and revision events remain traceable.", 825, 225, 340, ORANGE);
  addStep(slide, 4, "Control operational actions", "Activation, suspension, resumption, closure and expiry checks use one policy layer.", 85, 410, 340, ORANGE);
  addStep(slide, 5, "Preserve revisions", "A revised permit returns for approval and prior approved revisions become superseded.", 455, 410, 340, BLUE);
  addStep(slide, 6, "Handle linked permits", "Hot Work selection creates a linked child permit; final parent gating remains a policy decision.", 825, 410, 340, SKY);
  addText(slide, "Current prototype chain: Individual Reviewer, MT Group, Permit Manager. Requirements propose a company-driven chain with Host, Host Manager, optional stages and OPS.", 84, 607, 1095, 48, { size: 15, bold: true, color: RED });
  note(slide, ["src/policy.ts", "src/repository.ts", "src/types.ts", "tests/policy.test.ts", "tests/repository.test.ts", "ePTW-Requirements-Review.pdf, sections 3, 8-10"], "The prototype is a control proof, not the final role model.");
}

// 9. Decisions table
{
  const slide = presentation.slides.add({ layout: "Blank Page" });
  addTitle(slide, "08", "Policy decisions required before schema freeze", "The supplied sources differ on six behaviours that directly affect data structures and workflow code");
  const values = [
    ["Decision", "Requirements review", "Backend or prototype position", "Recommended action"],
    ["Approval roles", "Company-driven Host chain with optional stages", "Prototype uses Individual Reviewer, MT Group and PM", "Confirm one canonical role and stage model"],
    ["Parent-child gating", "Parent and child approval may proceed independently", "Prototype blocks parent final approval until required child approval", "Confirm whether approval or only work start is gated"],
    ["Reviewer group changes", "Changes update every live permit", "Database proposal snapshots eligibility at submission", "Choose audit certainty or live reassignment semantics"],
    ["Template changes", "Labels and ordering may change after publish", "Database proposal makes published versions immutable", "Version every published change and define edit rules"],
    ["PDF history", "Generate on demand from current state", "Schema includes revisions and generated document records", "Confirm retention, evidence and regeneration policy"],
    ["Expiry", "No dedicated Expired status proposed", "Prototype contains EXPIRED and automatic expiry", "Confirm status, flag and reporting behaviour"],
  ];
  const table = slide.tables.add({ rows: values.length, columns: 4, left: 55, top: 211, width: 1170, height: 425, columnWidths: [180, 300, 320, 370], values });
  styleTable(table, values.length, 4, { headerSize: 12, bodySize: 11.4 });
  addText(slide, "Recommendation: close these decisions in a short design authority workshop and record them as testable acceptance rules.", 70, 649, 1140, 32, { size: 14.5, bold: true, color: BLUE, typeface: HEAD });
  note(slide, ["ePTW-Requirements-Review.pdf, pages 21, 35, 37-42, 56, 59, 75-76 and 83", "database-redesign-proposal.docx, sections 4-6 and 12", "src/policy.ts", "src/types.ts"], "These are source conflicts or unresolved questions, not implementation defects in the prototype.");
}

// 10. Migration
{
  const slide = presentation.slides.add({ layout: "Blank Page" });
  addTitle(slide, "09", "Migration and cutover approach", "A restartable, evidence-preserving migration reduces operational and audit risk");
  const phaseData = [
    ["0", "Inventory and freeze", "Profile a sanitized production snapshot. Resolve status, key mapping, numbering, retention and duplicate rules."],
    ["1", "Build and rehearse", "Deploy an empty PostgreSQL schema. Load reference data, users, templates and permits with deterministic mappings."],
    ["2", "Reconstruct permit detail", "Extract canonical fields, migrate children and retain the unmodified legacy submission in the first revision."],
    ["3", "Rebuild workflow history", "Recreate approval steps and events conservatively. Flag ambiguity instead of inventing historical order."],
    ["4", "Synchronize and cut over", "Run change capture or a short freeze, reconcile, switch traffic and retain a rollback window."],
  ];
  const phaseShapes = [];
  for (let i = 0; i < phaseData.length; i++) {
    const x = 65 + i * 241;
    const p = box(slide, x, 242, 210, 225, i === 4 ? PALE_ORANGE : i % 2 ? WHITE : PALE_BLUE, i === 4 ? "#F2B49F" : "#BDD2E2", 12);
    phaseShapes.push(p);
    addText(slide, phaseData[i][0], x + 15, 258, 36, 30, { size: 16, bold: true, color: i === 4 ? ORANGE : BLUE, typeface: HEAD });
    addText(slide, phaseData[i][1], x + 15, 299, 180, 54, { size: 18, bold: true, color: NAVY, typeface: HEAD });
    addText(slide, phaseData[i][2], x + 15, 361, 180, 92, { size: 13, color: MID });
    if (i > 0) connect(slide, phaseShapes[i - 1], p, "right", "left", "#91A6BA");
  }
  addText(slide, "Reconciliation gates", 80, 525, 210, 34, { size: 17, bold: true, color: NAVY, typeface: HEAD });
  addBullet(slide, "Every source record is migrated, explicitly excluded or quarantined with a reason.", 80, 570, 500, { size: 15.5, height: 52 });
  addBullet(slide, "Counts reconcile by status, site, template, parent-child relationship and approval outcome.", 650, 570, 500, { size: 15.5, height: 52 });
  addText(slide, "Cutover proceeds only after critical reconciliation gates pass.", 80, 641, 1100, 30, { size: 15, bold: true, color: RED });
  note(slide, ["database-redesign-proposal.docx, section 10", "old-vs-new-schema.docx, section 10"], "No schedule duration is asserted because the sources do not contain production volumes or resource commitments.");
}

// 11. Delivery sequencing
{
  const slide = presentation.slides.add({ layout: "Blank Page" });
  addTitle(slide, "10", "Delivery sequencing", "The sequence protects domain decisions first and postpones irreversible migration work");
  const tracks = [
    ["A", "Domain alignment", "Close the six policy decisions, acceptance rules and role matrix."],
    ["B", "Platform foundation", "Authentication, authorization, schema, files, event logging and deployment pipeline."],
    ["C", "Permit lifecycle", "Creation, child logic, approvals, operational actions, closure and revisions."],
    ["D", "Administration and reporting", "Configuration screens, search, dashboards, PDF and scheduled exports."],
    ["E", "Migration and launch", "Profiling, ETL rehearsals, reconciliation, training, cutover and hypercare."],
  ];
  for (let i = 0; i < tracks.length; i++) {
    const y = 216 + i * 86;
    addText(slide, tracks[i][0], 83, y, 54, 52, { size: 21, bold: true, color: WHITE, fill: i === 0 ? ORANGE : BLUE, borderRadius: 10, typeface: HEAD, align: "center", valign: "middle" });
    addText(slide, tracks[i][1], 166, y - 2, 280, 40, { size: 19, bold: true, color: NAVY, typeface: HEAD, valign: "middle" });
    addText(slide, tracks[i][2], 460, y - 2, 690, 54, { size: 16, color: INK });
    if (i < tracks.length - 1) slide.shapes.add({ geometry: "line", position: { left: 110, top: y + 58, width: 0, height: 28 }, fill: "none", line: { style: "solid", fill: "#B6C4D1", width: 2 } });
  }
  addText(slide, "Each track ends with working software, automated controls and explicit exit criteria. Time and staffing estimates follow the profiling and domain-alignment work.", 80, 646, 1100, 34, { size: 14, color: MID, bold: true });
  note(slide, ["database-redesign-proposal.docx, sections 10-11", "ePTW-Requirements-Review.pdf, sections 22-24", "README.md"], "This is sequencing rather than a duration estimate.");
}

// 12. Risk matrix
{
  const slide = presentation.slides.add({ layout: "Blank Page" });
  addTitle(slide, "11", "Principal delivery risks and controls", "The main risks can be reduced before production migration begins");
  const values = [
    ["Risk", "Potential impact", "Primary control"],
    ["Unresolved workflow policy", "Schema rework and inconsistent approvals", "Design authority workshop with signed acceptance rules"],
    ["Unknown legacy data variants", "Migration errors or incomplete history", "Sanitized snapshot profiling, quarantine and reconciliation"],
    ["Authorization implemented only in UI", "Approval bypass or cross-company exposure", "Server-side policy checks and negative security tests"],
    ["Mutable configuration changes history", "Past permits become difficult to explain", "Versioned templates and explicit reviewer-change events"],
    ["Reporting logic diverges", "Dashboards disagree and trust falls", "Canonical date/status definitions and shared read models"],
    ["Cutover without rollback evidence", "Extended operational disruption", "Rehearsed cutover, rollback window and post-switch reconciliation"],
  ];
  const table = slide.tables.add({ rows: values.length, columns: 3, left: 70, top: 218, width: 1140, height: 418, columnWidths: [280, 350, 510], values });
  styleTable(table, values.length, 3, { headerSize: 13, bodySize: 12.5 });
  addText(slide, "Risk ownership and thresholds should be assigned during implementation planning.", 80, 649, 1100, 30, { size: 14.5, bold: true, color: BLUE, typeface: HEAD });
  note(slide, ["database-redesign-proposal.docx, sections 3, 10, 12 and 13", "ePTW-Requirements-Review.pdf, sections 19 and 21-24"], "Risks are derived from the supplied design gaps and open questions; no probability scoring is asserted.");
}

// 13. Decision request
{
  const slide = presentation.slides.add({ layout: "Blank Page" });
  addTitle(slide, "12", "Decision requested", "Approval now enables controlled discovery without committing to an unverified migration date");
  addText(slide, "Approve the rebuild direction", 82, 220, 520, 58, { size: 30, bold: true, color: NAVY, typeface: HEAD });
  addBullet(slide, "PostgreSQL becomes the system of record for permits, workflow and audit history.", 82, 305, 535, { size: 18, height: 62 });
  addBullet(slide, "The React frontend continues as the interaction baseline, backed by production services and server-side controls.", 82, 382, 535, { size: 18, height: 76 });
  addBullet(slide, "Migration follows a profiled, restartable and reconciled cutover process.", 82, 478, 535, { size: 18, height: 62 });
  box(slide, 706, 205, 474, 400, PALE_BLUE, "#AFCFE4", 14);
  addText(slide, "Authorize next", 744, 232, 390, 44, { size: 23, bold: true, color: NAVY, typeface: HEAD });
  addStep(slide, 1, "Close policy decisions", "Confirm roles, gating, group changes, templates, PDF history and expiry.", 744, 298, 390, ORANGE);
  addStep(slide, 2, "Profile production data", "Use a recent sanitized snapshot and publish the reconciliation baseline.", 744, 394, 390, BLUE);
  addStep(slide, 3, "Plan implementation", "Assign owners, delivery capacity, environments and measurable exit criteria.", 744, 490, 390, SKY);
  addText(slide, "Production build and migration dates follow these three actions.", 82, 619, 1090, 42, { size: 16, bold: true, color: ORANGE, typeface: HEAD });
  note(slide, ["database-redesign-proposal.docx, sections 1, 10-12", "ePTW-Requirements-Review.pdf, pages 93-95"], "The requested decision is intentionally limited to direction and controlled discovery.");
}

// 14. Appendix: prototype and gaps
{
  const slide = presentation.slides.add({ layout: "Blank Page" });
  addTitle(slide, "A1", "Appendix: frontend prototype coverage", "The codebase demonstrates workflow intent but remains a browser-based functional draft");
  const values = [
    ["Demonstrated now", "Production capability still required"],
    ["Role-aware navigation and permit queues", "Real identity provider integration, sessions and server authorization"],
    ["Template-driven permit creation and validation", "Published template versioning, reserved-field enforcement and file services"],
    ["Sequential review decisions and separation of duties", "Confirmed role chain, delegation policy, concurrency and transactional workflow"],
    ["Linked Hot Work child permit and parent controls", "Full B1-B5/LSS rules, merge semantics and decision on approval gating"],
    ["Activation, suspension, closure, expiry and revisions", "Confirmed status model, notifications, scheduled jobs and immutable history"],
    ["Admin, search, audit and PDF action views", "Persistent master data, server-side search, dashboards, documents, audit and permission checks"],
  ];
  const table = slide.tables.add({ rows: values.length, columns: 2, left: 70, top: 210, width: 1140, height: 390, columnWidths: [530, 610], values });
  styleTable(table, values.length, 2, { headerSize: 13.5, bodySize: 12.2 });
  addText(slide, "Verification: React production build succeeded; 3 test files and 20 tests passed.", 80, 650, 1100, 26, { size: 14, bold: true, color: GREEN, typeface: HEAD });
  note(slide, ["README.md", "src/App.tsx", "src/TemplateBuilderPage.tsx", "src/AdminUsersMaps.tsx", "src/AdminDirectories.tsx", "src/policy.ts", "src/repository.ts", "tests/*.ts and tests/*.tsx"], "The README explicitly states that the draft has no real authentication, file upload, notification or backend security.");
}

const snapshot = await presentation.inspect({ kind: "deck,slide,textbox,shape,table,notes,layout", maxChars: 50000 });
await fs.writeFile(path.join(stagingDir, "eptw-proposal-inspect.ndjson"), snapshot.ndjson, "utf8");
for (let i = 0; i < presentation.slides.count; i++) {
  const slide = presentation.slides.getItem(i);
  const preview = await slide.export({ format: "png", scale: 1.3 });
  await fs.writeFile(path.join(stagingDir, `eptw-slide-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await preview.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(stagingDir, `eptw-slide-${String(i + 1).padStart(2, "0")}.layout.json`), await layout.text());
}
const montage = await presentation.export({ format: "png", montage: { format: "png", slideWidth: 360, columns: 3, padding: 12, gap: 12, background: "#E9EDF2" } });
await fs.writeFile(path.join(stagingDir, "eptw-proposal-montage.png"), new Uint8Array(await montage.arrayBuffer()));

const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, "container_tools", "artifact_tool_utils.mjs")).href);
const candidatePath = path.join(stagingDir, "eptw-proposal-candidate-final.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
const referenceSha256 = crypto.createHash("sha256").update(await fs.readFile(fontReferencePath)).digest("hex");
const requirements = {
  explicitTotalSlideCount: 14,
  requiredNativeTableOwnerSlides: [7, 9, 12, 14],
  requiredNativeChartOwnerSlides: [],
  sourceTemplatePath: templatePath,
};
const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "12192000,6858000",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
    ...requirements.requiredNativeTableOwnerSlides.flatMap((number) => ["--require-native-table-slide", String(number)]),
  ],
  requiredNativeTableOwnerSlides: requirements.requiredNativeTableOwnerSlides,
  fontPolicy: { basis: "reference", families: [HEAD, BODY], referencePath: fontReferencePath, referenceSha256 },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, `${path.basename(finalPath)}.validation.json`),
});
console.log(JSON.stringify({ finalPath, result }, null, 2));
