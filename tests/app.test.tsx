import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/app/App";
import { APPROVAL_ROLE_LABELS, DISCIPLINE_RECORDS, SITES, STATUS_LABELS, USERS } from "../src/domain/constants";
import { createSeedState } from "../src/domain/data";
import { currentRevision } from "../src/domain/types";

describe("application shell", () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem("eptw-demo-user", "req-1"); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("uses the current approval role in every pending permit status label", () => {
    expect(APPROVAL_ROLE_LABELS.INDIVIDUAL_REVIEW).toBe("Vendor PM");
    expect(STATUS_LABELS.INDIVIDUAL_REVIEW).toBe("Pending Vendor PM approval");
    expect(STATUS_LABELS.MT_REVIEW).toBe("Pending Host Supervisor approval");
    expect(STATUS_LABELS.PM_REVIEW).toBe("Pending Host Manager approval");
    expect(STATUS_LABELS.AREA_MANAGER_REVIEW).toBe("Pending Area Manager approval");
    expect(STATUS_LABELS.MT_GROUP_REVIEW).toBe("Pending MT Groups approval");
    expect(STATUS_LABELS.FINAL_MT_REVIEW).toBe("Pending Final Approval MT Group approval");
  });

  it("displays pending approval statuses as a bold heading and role", () => {
    localStorage.setItem("eptw-demo-user", "ir-1");
    render(<MemoryRouter initialEntries={["/permits/permit-review"]}><App /></MemoryRouter>);
    const status = document.querySelector(".permit-decision-status .status-copy")!;
    expect(status.querySelector("strong")?.textContent).toBe("Pending Approval:");
    expect(status.querySelector("small")?.textContent).toBe("Vendor PM");
  });

  it("emphasizes permits awaiting the signed-in user's approval", () => {
    localStorage.setItem("eptw-demo-user", "pm-1");
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);

    const permitLink = screen.getByRole("link", { name: "F10A1-G-AMHS-2026-09-08/0001" });
    const badge = permitLink.closest("tr")!.querySelector<HTMLElement>(".status-pill")!;
    expect(badge.querySelector("strong")?.textContent).toBe("Pending Approval:");
    expect(badge.querySelector("small")?.textContent).toBe("Vendor PM (YOU)");
    expect(badge.querySelector("small b")?.textContent).toBe("YOU");
    expect(badge.classList.contains("your-approval")).toBe(true);
  });

  it("does not let Micron Admin override the assigned Vendor PM approver", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/permits/permit-review"]}><App /></MemoryRouter>);

    const approve = screen.getByRole("button", { name: "Approve permit" }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(document.querySelector(".permit-decision-status .status-copy strong")?.textContent).toBe("Pending Approval:");
    expect(document.querySelector(".permit-decision-status .status-copy small")?.textContent).toBe("Vendor PM");
    expect(document.querySelector(".permit-decision-status .your-approval")).toBeNull();
  });

  it("allows Priya Menon to approve a permit at the Vendor PM stage", () => {
    localStorage.setItem("eptw-demo-user", "pm-1");
    render(<MemoryRouter initialEntries={["/permits/permit-review"]}><App /></MemoryRouter>);
    const approve = screen.getByRole("button", { name: "Approve permit" }) as HTMLButtonElement;
    expect(approve.disabled).toBe(false);
    fireEvent.click(approve);
    expect(document.querySelector(".permit-decision-status .status-copy small")?.textContent).toBe("Host Supervisor");
    const progress = Array.from(document.querySelectorAll<HTMLElement>(".approval-progress > div"));
    expect(progress[1].dataset.approvalState).toBe("approved");
    expect(progress[2].dataset.approvalState).toBe("pending");
    expect(progress[3].dataset.approvalState).toBe("upcoming");
  });

  it("renders the requestor dashboard and role-aware navigation", () => {
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /welcome, aisha/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /awaiting approval/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^submitted permits/i })).toBeNull();
    expect(screen.getByRole("button", { name: /drafted permits/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /pending approval/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /approved permits/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /rejected permits/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /all available permits/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /pending approval/i }).getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector(".nav-section p")?.textContent).toBe("Overview");
    expect(Array.from(document.querySelectorAll(".nav-section p")).some((item) => item.textContent === "Review")).toBe(false);
    expect(Array.from(document.querySelectorAll(".nav-section p")).some((item) => item.textContent === "Help & Resources")).toBe(true);
    expect(screen.queryByRole("link", { name: /^help & resources$/i })).toBeNull();
    expect(screen.getByRole("link", { name: /Parent permits/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /account settings/i })).toBeTruthy();
  });

  it("redirects signed-out users to login and signs in a known Micron user with SSO", () => {
    localStorage.clear();
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /sign in to your account/i })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Micron email address"), { target: { value: "irene@micron.com" } });
    fireEvent.click(screen.getByRole("button", { name: /continue with micron sso/i }));
    expect(screen.getByRole("heading", { name: /welcome, irene/i })).toBeTruthy();
  });

  it("sends an unknown Micron SSO identity to a prefilled registration form", () => {
    localStorage.clear();
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Micron email address"), { target: { value: "new.user@micron.com" } });
    fireEvent.click(screen.getByRole("button", { name: /continue with micron sso/i }));
    expect(screen.getByRole("heading", { name: /register your eptw account/i })).toBeTruthy();
    expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe("new.user@micron.com");
    expect((screen.getByLabelText("Company") as HTMLInputElement).value).toBe("Micron");
  });

  it("registers Micron staff with course evidence and opens the tutorial", () => {
    localStorage.clear();
    render(<MemoryRouter initialEntries={["/register/micron?email=new.user%40micron.com"]}><App /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New User" } });
    fireEvent.change(screen.getByLabelText("Learning course completion"), { target: { files: [new File(["evidence"], "course.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: /register and view tutorial/i }));
    expect(screen.getByRole("heading", { name: /welcome, new/i })).toBeTruthy();
    expect(screen.getByText(/micron staff profile is ready/i)).toBeTruthy();
    expect(localStorage.getItem("eptw-demo-user")).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: /continue to dashboard/i }));
    expect(screen.getByRole("heading", { name: /welcome, new/i })).toBeTruthy();
  });

  it("self-registers a contractor with active companies and all sites selected", () => {
    localStorage.clear();
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole("link", { name: /self-registration/i }));
    expect(screen.getByRole("heading", { name: /self-registration/i })).toBeTruthy();
    expect((screen.getByLabelText("F10A1") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("option", { name: "Acme Engineering" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Chris Contractor" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "chris@example.com" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "CONTRACTOR_PM" } });
    fireEvent.click(screen.getByRole("button", { name: /register and view tutorial/i }));
    expect(screen.getByText(/contractor pm profile is ready/i)).toBeTruthy();
  });

  it("logs out to the public login page", () => {
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(screen.getByRole("heading", { name: /sign in to your account/i })).toBeTruthy();
    expect(localStorage.getItem("eptw-demo-user")).toBeNull();
  });

  it("switches roles only from Account settings", () => {
    render(<MemoryRouter initialEntries={["/account"]}><App /></MemoryRouter>);
    expect(screen.queryByLabelText("Demo identity")).toBeNull();
    fireEvent.change(screen.getByLabelText("User and role"), { target: { value: "admin-1" } });
    expect(screen.getByText("Micron Admin", { selector: ".role-summary strong" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /sites/i })).toBeTruthy();
  });

  it("groups account identities in the configured role order", () => {
    render(<MemoryRouter initialEntries={["/account"]}><App /></MemoryRouter>);

    const select = screen.getByLabelText("User and role") as HTMLSelectElement;
    expect(Array.from(select.querySelectorAll("optgroup")).map((group) => group.label)).toEqual([
      "Micron Admin",
      "Vendor Admin",
      "Micron Staff",
      "Micron Supervisor",
      "Contractor Requestor",
      "Contractor PM",
      "Assessor",
    ]);
  });

  it("shows the current login account in the sidebar and opens Account settings", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);

    const accountLink = screen.getByRole("link", { name: /micron administrator, micronadmin@site.example/i });
    expect(within(accountLink).getByText("Micron Admin")).toBeTruthy();
    expect(within(accountLink).getByText("Micron Administrator")).toBeTruthy();
    expect(within(accountLink).getByText("micronadmin@site.example")).toBeTruthy();
    expect(within(accountLink).queryByText("Current login account")).toBeNull();
    fireEvent.click(accountLink);
    expect(screen.getByRole("heading", { name: "Account settings" })).toBeTruthy();
  });

  it("shows organisation-wide status counts on the Micron Admin dashboard", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /permit overview/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /total permits/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /all pending approval/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /all approved permits/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /all rejected permits/i })).toBeTruthy();
  });

  it("shows a Micron Supervisor all submitted parent permits but hides other users' drafts", () => {
    localStorage.setItem("eptw-demo-user", "supervisor-1");
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);
    expect(screen.getAllByText("F10A1-G-AMHS-2026-09-08/0001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("F10A1-G-Facilities-2026-09-09/0002").length).toBeGreaterThan(0);
    expect(screen.queryByText("F10A2-G-Facilities-2026-09-09/0004")).toBeNull();
    expect(screen.queryByRole("link", { name: /create permit/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^users$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^templates$/i })).toBeNull();
  });

  it("shows every submitted parent permit plus only the signed-in user's drafts", () => {
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);

    expect(screen.getAllByText("F10A1-G-AMHS-2026-09-08/0001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("F10A1-G-Facilities-2026-09-09/0002").length).toBeGreaterThan(0);
    expect(screen.getAllByText("F10A2-G-Facilities-2026-09-09/0004").length).toBeGreaterThan(0);
  });

  it("does not expose another user's parent draft to Micron Admin", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);

    expect(screen.getAllByText("F10A1-G-AMHS-2026-09-08/0001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("F10A1-G-Facilities-2026-09-09/0002").length).toBeGreaterThan(0);
    expect(screen.queryByText("F10A2-G-Facilities-2026-09-09/0004")).toBeNull();
  });

  it("filters dashboard permit results when a status card is selected", () => {
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    const draftCard = screen.getByRole("button", { name: /drafted permits/i });
    expect(draftCard.className).toContain("draft");
    fireEvent.click(draftCard);
    expect(draftCard.className).toContain("selected");
    expect(draftCard.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: /drafted permits/i })).toBeTruthy();
    expect(screen.getAllByText("F10A2-G-Facilities-2026-09-09/0004").length).toBeGreaterThan(0);
    expect(screen.queryByText("F10A1-G-AMHS-2026-09-08/0001")).toBeNull();
    fireEvent.click(draftCard);
    expect(draftCard.className).not.toContain("selected");
    expect(draftCard.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("heading", { name: "All available permits" })).toBeTruthy();
    expect(screen.getAllByText("F10A1-G-AMHS-2026-09-08/0001").length).toBeGreaterThan(0);
  });

  it("returns to the Dashboard when a permit was opened from the Dashboard", () => {
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    const permitLink = document.querySelector<HTMLAnchorElement>(".dashboard-results .permit-table .permit-number")!;
    fireEvent.click(permitLink);

    const backLink = screen.getByRole("link", { name: /Back to Dashboard/ });
    expect(backLink.getAttribute("href")).toBe("/dashboard");
  });

  it("returns to Parent permits when a permit was opened directly", () => {
    render(<MemoryRouter initialEntries={["/permits/permit-review"]}><App /></MemoryRouter>);

    const backLink = screen.getByRole("link", { name: /Back to permits/ });
    expect(backLink.getAttribute("href")).toBe("/permits");
  });

  it("splits the Micron Staff dashboard into approval and submitted-permit sections", () => {
    localStorage.setItem("eptw-demo-user", "ir-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    expect(screen.getAllByRole("heading", { name: "My Approval" })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { name: "Submitted Permit" })).toHaveLength(2);
    const cards = Array.from(document.querySelectorAll<HTMLButtonElement>(".dashboard-metric"));
    expect(cards.map((card) => card.querySelector("span")?.textContent)).toEqual(["Pending My Approval", "Approved By Me", "Rejected By Me", "Drafted Permit", "Pending Approval", "Approved Permits", "Rejected Permits"]);
    expect(Array.from(document.querySelectorAll(".dashboard-section-count")).map((pill) => pill.textContent)).toEqual(["1", "0"]);
    expect(screen.queryByRole("heading", { name: /awaiting approval/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^approved permits/i })).toBeTruthy();
    expect(document.querySelectorAll(".dashboard-grouped-results .dashboard-results")).toHaveLength(2);
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".dashboard-staff-section"));
    expect(sections).toHaveLength(2);
    expect(sections[0].querySelector(".dashboard-metric-group h2 > span")?.textContent).toBe("My Approval");
    expect(sections[0].querySelector(".dashboard-results h2")?.textContent).toBe("My Approval");
    expect(sections[1].querySelector(".dashboard-metric-group h2 > span")?.textContent).toBe("Submitted Permit");
    expect(sections[1].querySelector(".dashboard-results h2")?.textContent).toBe("Submitted Permit");
    expect(screen.queryByRole("heading", { name: /all available permits/i })).toBeNull();
  });

  it("colors My Approval rows by the signed-in user's approval outcome", () => {
    const state = createSeedState();
    const pending = state.permits.find((permit) => permit.id === "permit-review")!;
    const pendingRevision = currentRevision(pending);
    pendingRevision.status = "AREA_MANAGER_REVIEW";
    pendingRevision.data.individualReviewerId = "ir-1";
    pendingRevision.data.individualReviewerIds = ["ir-1"];
    pendingRevision.areaManagerApprovals = [{ userId: "ir-1", status: "PENDING" }];

    const approved = state.permits.find((permit) => permit.id === "permit-hot-parent")!;
    const approvedRevision = currentRevision(approved);
    approvedRevision.status = "PM_REVIEW";
    approvedRevision.approvals[0] = { ...approvedRevision.approvals[0], status: "APPROVED", actorId: "ir-1" };

    const rejected = state.permits.find((permit) => permit.id === "permit-active")!;
    const rejectedRevision = currentRevision(rejected);
    rejectedRevision.status = "REJECTED";
    rejectedRevision.approvals[0] = { ...rejectedRevision.approvals[0], status: "REJECTED", actorId: "ir-1" };

    localStorage.setItem("eptw-functional-draft:v2", JSON.stringify(state));
    localStorage.setItem("eptw-demo-user", "ir-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);

    const approvalTable = document.querySelector<HTMLElement>(".dashboard-staff-section .dashboard-results .permit-table")!;
    const rowFor = (number: string) => Array.from(approvalTable.querySelectorAll("tbody tr")).find((row) => row.textContent?.includes(number))!;
    expect(rowFor(pending.permitNumber).classList.contains("status-warn")).toBe(true);
    expect(rowFor(approved.permitNumber).classList.contains("status-good")).toBe(true);
    expect(rowFor(rejected.permitNumber).classList.contains("status-bad")).toBe(true);
  });

  it("filters each Micron Staff dashboard section independently", () => {
    localStorage.setItem("eptw-demo-user", "ir-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".dashboard-staff-section"));

    fireEvent.click(within(sections[0]).getByRole("button", { name: /^Approved By Me/i }));
    expect(sections[0].querySelector(".dashboard-results h2")?.textContent).toBe("Approved By Me");
    expect(sections[1].querySelector(".dashboard-results h2")?.textContent).toBe("Submitted Permit");

    fireEvent.click(within(sections[1]).getByRole("button", { name: /^Pending Approval/i }));
    expect(sections[0].querySelector(".dashboard-results h2")?.textContent).toBe("Approved By Me");
    expect(sections[1].querySelector(".dashboard-results h2")?.textContent).toBe("Pending Approval");
    expect(within(sections[0]).getByRole("button", { name: /^Approved By Me/i }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(within(sections[1]).getByRole("button", { name: /^Pending Approval/i }));
    expect(sections[1].querySelector(".dashboard-results h2")?.textContent).toBe("Submitted Permit");
    expect(sections[0].querySelector(".dashboard-results h2")?.textContent).toBe("Approved By Me");
  });

  it("shows Contractor PM the My Approval counters and approval table", () => {
    localStorage.setItem("eptw-demo-user", "pm-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);

    const cards = Array.from(document.querySelectorAll<HTMLButtonElement>(".dashboard-metric"));
    expect(cards.map((card) => card.querySelector("span")?.textContent)).toEqual(["Pending My Approval", "Approved By Me", "Rejected By Me"]);
    expect(document.querySelectorAll(".dashboard-results")).toHaveLength(1);
    expect(document.querySelector(".dashboard-results h2")?.textContent).toBe("My Approval");
    expect(screen.queryByRole("heading", { name: "Submitted Permit" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Approved By Me/i }));
    expect(document.querySelector(".dashboard-results h2")?.textContent).toBe("Approved By Me");
    expect(screen.getByRole("button", { name: /^Approved By Me/i }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows Assessors only assigned editable permits in a quarter-width Allow Reading card", () => {
    const state = createSeedState();
    const assignedPermit = state.permits[0];
    const revision = currentRevision(assignedPermit);
    revision.data.assessorIds = ["assessor-1"];
    revision.data.templateId = "assessor-editable-template";
    localStorage.setItem("eptw-functional-draft:v2", JSON.stringify(state));
    localStorage.setItem("eptw-templates:v4", JSON.stringify([{ id: "assessor-editable-template", kind: "PARENT", name: "Assessor editable", code: "G", discipline: "AMHS", description: "", active: true, updatedAt: "2026-10-28T00:00:00.000Z", sections: [{ id: "reading", title: "Reading", fields: [], editAccess: { assessor: true, assessorIds: ["assessor-1"] } }] }]));
    localStorage.setItem("eptw-demo-user", "assessor-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);

    const cards = screen.getAllByRole("button", { name: /Allow Reading/i });
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain("1");
    expect(cards[0].closest(".dashboard-metric-group")?.classList.contains("quarter-width")).toBe(true);
    expect(screen.getAllByText(assignedPermit.permitNumber).length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".dashboard-metric")).toHaveLength(1);
  });

  it("uses the permit status marker for permits raised by the signed-in user", () => {
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);

    const permitLink = screen.getByRole("link", { name: "F10A1-G-AMHS-2026-09-08/0001" });
    const row = permitLink.closest("tr")!;
    expect(row.classList.contains("status-warn")).toBe(true);
  });

  it("provides Dashboard navigation to every user role", () => {
    ["admin-1", "user-admin-1", "ir-1", "pm-1", "req-1", "assessor-1"].forEach((userId) => {
      cleanup();
      localStorage.setItem("eptw-demo-user", userId);
      render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
      expect(screen.getByRole("link", { name: /dashboard/i })).toBeTruthy();
      expect(screen.getByRole("link", { name: /tutorial videos/i })).toBeTruthy();
      expect(screen.getByRole("link", { name: /form downloads/i })).toBeTruthy();
      expect(screen.getByRole("link", { name: /report issue/i })).toBeTruthy();
    });
  });

  it("gives Assessors read-only parent and child permit navigation", () => {
    localStorage.setItem("eptw-demo-user", "assessor-1");
    render(<MemoryRouter initialEntries={["/child-permits"]}><App /></MemoryRouter>);
    expect(Array.from(document.querySelectorAll(".nav-section p")).some((item) => item.textContent === "Readings")).toBe(false);
    expect(screen.queryByRole("link", { name: /reading history/i })).toBeNull();
    expect(screen.getByRole("link", { name: /parent permits/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /child permits/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /child permits/i })).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/actions for f10a1-b1/i));
    expect(screen.getAllByRole("link", { name: /^view$/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /^review$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /export as pdf/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /duplicate/i })).toBeNull();
  });

  it("opens the selected sidebar resource page", () => {
    render(<MemoryRouter initialEntries={["/help?resource=tutorials"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /tutorial videos/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /tutorial videos/i }).className).toContain("active");
    expect(screen.queryByRole("link", { name: /form downloads/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Watch B1 Hot Work permit" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workflow" }));
    expect(screen.getByText("Approval and rejection flow")).toBeTruthy();
    expect(screen.queryByText("B1 Hot Work permit")).toBeNull();
  });

  it("lets the Vendor Admin configure the Report issue destination for other users", () => {
    localStorage.setItem("eptw-demo-user", "user-admin-1");
    render(<MemoryRouter initialEntries={["/help?resource=issue"]}><App /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Report issue" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Report issue URL"), { target: { value: "https://support.example.com/new-ticket" } });
    fireEvent.click(screen.getByRole("button", { name: "Save link" }));
    expect(screen.getByRole("status").textContent).toContain("saved for all users");
    expect(localStorage.getItem("eptw-report-issue-url:v1")).toBe("https://support.example.com/new-ticket");

    cleanup();
    localStorage.setItem("eptw-demo-user", "req-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /report issue/i }).getAttribute("href")).toBe("https://support.example.com/new-ticket");
    expect(screen.queryByLabelText("Report issue URL")).toBeNull();
  });

  it("uses the Dashboard for assigned reviews without a separate Approval queue menu", () => {
    localStorage.setItem("eptw-demo-user", "pm-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: /approval queue/i })).toBeNull();
    expect(screen.getByRole("heading", { name: /pending my approval/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /pending approval/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /approved permits/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /active permits/i })).toBeNull();
    expect(screen.getByRole("link", { name: /view all/i }).getAttribute("href")).toBe("/permits");
  });

  it("does not show review queues or closure and cancellation in the Micron Staff sidebar", () => {
    localStorage.setItem("eptw-demo-user", "ir-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: /approval queue/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /closure & cancellation/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /approval history/i })).toBeNull();
  });

  it("renders and filters the LSS/FAS impairment register", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T04:00:00+08:00"));
    render(<MemoryRouter initialEntries={["/lss-fas-permits"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /lss \/ fas impairment requests/i })).toBeTruthy();
    expect((screen.getByLabelText("LSS/FAS start date") as HTMLInputElement).value).toBe("2026-09-14");
    expect((screen.getByLabelText("LSS/FAS end date") as HTMLInputElement).value).toBe("2026-09-28");
    expect(screen.getByText("F10A1-LSS-2026-09/0012")).toBeTruthy();
    expect(document.querySelectorAll(".lss-date-group")).toHaveLength(15);
    expect(Array.from(document.querySelectorAll<HTMLDetailsElement>(".lss-date-group")).every((group) => !group.open)).toBe(true);
    expect(document.querySelectorAll(".lss-date-group.date-after")).toHaveLength(7);
    expect(document.querySelectorAll(".lss-date-group.date-today")).toHaveLength(1);
    expect(document.querySelectorAll(".lss-date-group.date-before")).toHaveLength(7);
    expect(screen.getByText("Today")).toBeTruthy();
    expect(document.querySelectorAll(".date-period-group")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Future Date 7/i }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: /Past Date 7/i }).getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelectorAll(".lss-status-group")).toHaveLength(60);
    expect(screen.queryByLabelText("Show empty statuses")).toBeNull();
    fireEvent.change(screen.getByLabelText("Filter LSS/FAS by site"), { target: { value: "F10N" } });
    expect(screen.queryByText("F10A1-LSS-2026-09/0012")).toBeNull();
    expect(screen.getByText("F10N-FAS-2026-09/0011")).toBeTruthy();
  });

  it("groups SIPP reports by date and filters by year and month", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/sipp-daily-report"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "SIPP daily reports" })).toBeTruthy();
    expect(screen.getByText("SIPP-2026-02/0018")).toBeTruthy();
    expect(screen.getAllByText("Pending Approval").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Filter SIPP reports by month"), { target: { value: "03" } });
    expect(screen.queryByText("SIPP-2026-02/0018")).toBeNull();
    expect(screen.getByText("SIPP-2026-03/0001")).toBeTruthy();
  });

  it("lets Micron Staff open the permit register and create a permit", () => {
    localStorage.setItem("eptw-demo-user", "ir-1");
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /parent permits/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /create permit/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /lss \/ fas permits/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /other permits/i })).toBeNull();
  });

  it("does not allow a permit creator to select themselves as an approver", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/permits/new"]}><App /></MemoryRouter>);

    const hostManager = screen.getByLabelText("Host manager *");
    fireEvent.click(hostManager);
    expect(within(hostManager.closest("details")!).queryByText("Micron Administrator", { selector: ".multi-select-options strong" })).toBeNull();
    expect(screen.getByText(/you cannot assign yourself/i)).toBeTruthy();
  });

  it("searches only Micron Staff for host supervisor and host manager", () => {
    render(<MemoryRouter initialEntries={["/permits/new"]}><App /></MemoryRouter>);

    const hostSupervisor = screen.getByLabelText("Host supervisor *");
    fireEvent.click(hostSupervisor);
    const hostSupervisorControl = within(hostSupervisor.closest("details")!);
    const search = screen.getByLabelText("Search host supervisors");
    expect(hostSupervisorControl.queryByText("Micron Supervisor", { selector: ".multi-select-options strong" })).toBeNull();
    expect(hostSupervisorControl.queryByText("Micron Administrator", { selector: ".multi-select-options strong" })).toBeNull();
    fireEvent.change(search, { target: { value: "Marcus" } });
    expect(hostSupervisorControl.getByText("Marcus Teo", { selector: ".multi-select-options strong" })).toBeTruthy();
    expect(hostSupervisorControl.queryByText("Irene Lim", { selector: ".multi-select-options strong" })).toBeNull();
  });

  it("orders the permit register by operational status priority", () => {
    localStorage.setItem("eptw-demo-user", "req-1");
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);
    const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>(".permit-table tbody tr"));
    expect(rows[0].textContent).toContain("Draft permit");
    expect(rows[0].classList.contains("status-neutral")).toBe(true);
    expect(rows[1].textContent).toContain("Pending");
    expect(rows[1].classList.contains("status-warn")).toBe(true);
    expect(rows[2].textContent).toContain("Active");
    expect(rows[2].classList.contains("status-good")).toBe(true);
    expect(document.querySelectorAll(".permit-mobile-card.permit-status-row")).toHaveLength(rows.length);
  });

  it("shows completed permit approval stages with checked markers", () => {
    localStorage.setItem("eptw-demo-user", "pm-1");
    render(<MemoryRouter initialEntries={["/permits/permit-hot-parent"]}><App /></MemoryRouter>);
    const completedStages = Array.from(document.querySelectorAll<HTMLElement>('.approval-progress [data-approval-state="approved"]'));
    expect(completedStages.length).toBeGreaterThan(0);
    completedStages.forEach((stage) => expect(stage.querySelector("b")?.textContent).toBe("✓"));
    expect(document.querySelector('.approval-progress [data-approval-state="pending"] b')?.textContent).not.toBe("✓");
  });

  it("shows selected Area Managers one user per row in approval order", () => {
    const state = createSeedState(); const permit = state.permits.find((item) => item.id === "permit-review")!; const revision = currentRevision(permit);
    revision.status = "AREA_MANAGER_REVIEW";
    revision.data.individualReviewerId = "ir-1";
    revision.data.individualReviewerIds = ["ir-1", "mt-1", "ms-2"];
    revision.areaManagerApprovals = [{ userId: "ir-1", status: "APPROVED" }, { userId: "mt-1", status: "PENDING" }, { userId: "ms-2", status: "PENDING" }];
    localStorage.setItem("eptw-functional-draft:v2", JSON.stringify(state));
    localStorage.setItem("eptw-demo-user", "mt-1");
    render(<MemoryRouter initialEntries={["/permits/permit-review"]}><App /></MemoryRouter>);

    const rows = Array.from(document.querySelectorAll<HTMLElement>(".area-manager-approval-list > span"));
    expect(rows.map((row) => row.textContent)).toEqual(["1. Irene Lim ✓", "2. Marcus Teo (current)", "3. Nur Aisyah"]);
  });

  it("requires a reason before rejecting a permit", () => {
    localStorage.setItem("eptw-demo-user", "pm-1");
    render(<MemoryRouter initialEntries={["/permits/permit-review"]}><App /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "Reject permit" }));
    const dialog = screen.getByRole("dialog", { name: "Reject permit?" });
    const confirm = within(dialog).getByRole("button", { name: "Confirm rejection" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Reject reason *"), { target: { value: "The isolation plan is incomplete." } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);

    expect(screen.queryByRole("dialog", { name: "Reject permit?" })).toBeNull();
    expect(screen.getByText("Rejected", { selector: ".status-pill" })).toBeTruthy();
    const rejectedStage = document.querySelector<HTMLElement>('.approval-progress [data-approval-state="rejected"]');
    expect(rejectedStage?.textContent).toContain("Vendor PM");
    expect(rejectedStage?.querySelector("b")?.textContent).toBe("×");
    const approvedStages = Array.from(document.querySelectorAll<HTMLElement>('.approval-progress [data-approval-state="approved"]'));
    expect(approvedStages.length).toBeGreaterThan(0);
    approvedStages.forEach((stage) => expect(stage.querySelector("b")?.textContent).toBe("✓"));
  });

  it("shows the template code badge and template name in the permit register", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);
    expect(screen.getByRole("columnheader", { name: /template code · template name/i })).toBeTruthy();
    const firstTemplate = document.querySelector(".permit-table tbody .permit-template");
    expect(firstTemplate?.querySelector(".permit-template-code")?.textContent).toBe("G");
    expect(firstTemplate?.querySelector(".permit-template-code")?.classList.contains("parent")).toBe(true);
    expect(firstTemplate?.textContent).toContain("General");
  });

  it("lists B1-B4 permits attached by parentId and opens the child permit", () => {
    const state = createSeedState();
    const parent = state.permits.find((permit) => permit.id === "permit-hot-parent")!;
    parent.childIds = parent.childIds.filter((id) => id !== "permit-hot-child");
    localStorage.setItem("eptw-functional-draft:v2", JSON.stringify(state));

    render(<MemoryRouter initialEntries={["/permits/permit-hot-parent"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: /B1.B4 permits/i }));

    expect(screen.getAllByText("F10A1-B1-Facilities-2026-09-09/0002-1").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("link", { name: "View child permit" })[0]);
    expect(screen.getByRole("heading", { name: "F10A1-B1-Facilities-2026-09-09/0002-1" })).toBeTruthy();
  });

  it("shows child information and its attached parent without permit tabs", () => {
    render(<MemoryRouter initialEntries={["/permits/permit-a01-child"]}><App /></MemoryRouter>);

    expect(screen.queryByRole("tablist", { name: "Permit information" })).toBeNull();
    expect(screen.getByRole("heading", { name: "F10A1-G-Facilities-2026-09-09/0002" })).toBeTruthy();
    expect(screen.getByText("Attached parent permit")).toBeTruthy();
    const parentCard = screen.getByRole("heading", { name: "F10A1-G-Facilities-2026-09-09/0002" }).closest("section")!;
    expect(within(parentCard).getByText("Host supervisor", { selector: "dt" })).toBeTruthy();
    expect(within(parentCard).getByText("Final approval MT group", { selector: "dt" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View parent permit" }).getAttribute("href")).toBe("/permits/permit-hot-parent");
    expect(screen.getByRole("heading", { name: "Child permit information" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Parent permit sections" })).toBeNull();
  });

  it("creates a child permit from a child template and attaches it to the selected parent", () => {
    render(<MemoryRouter initialEntries={["/child-permits"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole("link", { name: /create child permit/i }));

    expect(screen.getByRole("heading", { name: "Create Child Permit" })).toBeTruthy();
    expect(screen.getByText("Host & approval route")).toBeTruthy();
    expect(screen.getByText("Site", { selector: "label > span" })).toBeTruthy();
    expect(screen.getByText("Discipline", { selector: "label > span" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Permit template type"), { target: { value: "tpl-child-b1" } });
    fireEvent.change(screen.getByLabelText("Parent permit"), { target: { value: "permit-review" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Permit" }));

    const state = JSON.parse(localStorage.getItem("eptw-functional-draft:v2")!);
    const child = state.permits.find((permit: { parentId?: string; revisions: { data: { templateId?: string } }[] }) => permit.parentId === "permit-review" && permit.revisions[0].data.templateId === "tpl-child-b1");
    expect(child.type).toBe("HOT_WORK");
    expect(state.permits.find((permit: { id: string }) => permit.id === "permit-review").childIds).toContain(child.id);
  });

  it("creates selected B1-B4 template options as navigable child permits", () => {
    localStorage.setItem("eptw-templates:v4", JSON.stringify([
      { id: "parent", kind: "PARENT", name: "General", code: "G", discipline: "Facilities", description: "General work", active: true, updatedAt: "2026-10-09T00:00:00.000Z", sections: [{ id: "safety", title: "Safety Checklist", description: "Select sub permits", fields: [{ id: "sub-permits", label: "Select Sub Permit", type: "MULTI_CHECKBOX", required: false, options: ["HOT WORK PERMIT"], childTemplateIds: ["b1"] }] }] },
      { id: "b1", kind: "CHILD", name: "HOT WORKS", code: "B1", discipline: "Facilities", description: "Hot work controls", active: true, updatedAt: "2026-10-09T00:00:00.000Z" },
    ]));
    render(<MemoryRouter initialEntries={["/permits/new"]}><App /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Permit template type"), { target: { value: "parent" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /HOT WORK PERMIT/i }));
    fireEvent.click(screen.getByRole("button", { name: "Create Permit" }));
    fireEvent.click(screen.getByRole("tab", { name: /B1.B4 permits/i }));

    expect(screen.getByText("HOT WORKS")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View child permit" })).toBeTruthy();
  });

  it("backfills B1-B4 child permits for previously saved selections", () => {
    const state = createSeedState();
    const parent = state.permits.find((permit) => permit.id === "permit-review")!;
    const revision = parent.revisions.find((item) => item.id === parent.currentRevisionId)!;
    revision.data.templateId = "parent-with-b1";
    revision.data.customFields = { "sub-permits": ["0"] };
    localStorage.setItem("eptw-functional-draft:v2", JSON.stringify(state));
    localStorage.setItem("eptw-templates:v4", JSON.stringify([
      { id: "parent-with-b1", kind: "PARENT", name: "General", code: "G", sections: [{ fields: [{ id: "sub-permits", type: "MULTI_CHECKBOX", childTemplateIds: ["b1"] }] }] },
      { id: "b1", kind: "CHILD", name: "HOT WORKS", code: "B1" },
    ]));

    render(<MemoryRouter initialEntries={["/permits/permit-review"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: /B1.B4 permits/i }));

    expect(screen.getByText("HOT WORKS")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View child permit" })).toBeTruthy();
  });

  it("shows navigation for embedded attached child permits", () => {
    const state = createSeedState();
    const parent = state.permits.find((permit) => permit.id === "permit-review")!;
    const revision = parent.revisions.find((item) => item.id === parent.currentRevisionId)!;
    revision.data.templateId = "parent-with-children";
    revision.data.customFields = { attachments: ["0", "1"] };
    localStorage.setItem("eptw-functional-draft:v2", JSON.stringify(state));
    localStorage.setItem("eptw-templates:v4", JSON.stringify([
      { id: "parent-with-children", kind: "PARENT", name: "General", code: "G", sections: [{ fields: [{ id: "attachments", type: "MULTI_CHECKBOX", options: ["Risk assessment", "Work plan"], childTemplateIds: ["a04", "a05"] }] }] },
      { id: "a04", kind: "CHILD", name: "Risk Assessment", code: "A04" },
      { id: "a05", kind: "CHILD", name: "Work Plan", code: "A05" },
    ]));
    render(<MemoryRouter initialEntries={["/permits/permit-review"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: /Child permits/i }));

    const navigation = screen.getByRole("navigation", { name: "Attached child permit forms" });
    expect(within(navigation).getByRole("button", { name: "Go to A04 Risk Assessment form" })).toBeTruthy();
    expect(within(navigation).getByRole("button", { name: "Go to A05 Work Plan form" })).toBeTruthy();
  });

  it("shows navigation for parent permit sections", () => {
    const state = createSeedState();
    const parent = state.permits.find((permit) => permit.id === "permit-review")!;
    const revision = parent.revisions.find((item) => item.id === parent.currentRevisionId)!;
    revision.data.templateId = "sectioned-parent";
    localStorage.setItem("eptw-functional-draft:v2", JSON.stringify(state));
    localStorage.setItem("eptw-templates:v4", JSON.stringify([{ id: "sectioned-parent", kind: "PARENT", name: "General", code: "G", sections: [{ id: "general", title: "General information", description: "Work details", fields: [] }, { id: "safety", title: "Safety Checklist", description: "Safety details", fields: [] }] }]));
    render(<MemoryRouter initialEntries={["/permits/permit-review"]}><App /></MemoryRouter>);

    const navigation = screen.getByRole("navigation", { name: "Parent permit sections" });
    expect(within(navigation).getByRole("button", { name: "Go to parent section 1 General information" })).toBeTruthy();
    expect(within(navigation).getByRole("button", { name: "Go to parent section 2 Safety Checklist" })).toBeTruthy();
    expect(document.getElementById("parent-section-general")).toBeTruthy();
    expect(document.getElementById("parent-section-safety")).toBeTruthy();
  });

  it("shows a floating back-to-top button after scrolling a permit", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    Object.defineProperty(window, "scrollY", { value: 500, configurable: true });
    render(<MemoryRouter initialEntries={["/permits/permit-hot-parent"]}><App /></MemoryRouter>);
    fireEvent.scroll(window);

    const button = screen.getByRole("button", { name: "Back to top" });
    expect(button.classList.contains("visible")).toBe(true);
    fireEvent.click(button);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    scrollTo.mockRestore();
  });

  it("switches configured section tabs while the permit remains read only", () => {
    const state = createSeedState();
    const permit = state.permits.find((item) => item.id === "permit-hot-parent")!;
    const revision = permit.revisions.find((item) => item.id === permit.currentRevisionId)!;
    revision.data.templateId = "tabbed-readonly";
    revision.data.templateName = "Tabbed read-only permit";
    revision.data.customFields = { health: "Recorded health value", environmental: "Recorded environmental value" };
    localStorage.setItem("eptw-functional-draft:v2", JSON.stringify(state));
    localStorage.setItem("eptw-templates:v4", JSON.stringify([{ id: "tabbed-readonly", kind: "PARENT", name: "Tabbed read-only permit", code: "TR", discipline: "Facilities", description: "Read-only tab test.", active: true, updatedAt: "2026-10-09T00:00:00.000Z", sections: [{ id: "safety", title: "Safety Checklist", description: "", tabs: [{ id: "health-tab", label: "Health & Safety Impact" }, { id: "environment-tab", label: "Environmental Impact" }], fields: [{ id: "health", tabId: "health-tab", label: "Health value", type: "TEXT", required: false }, { id: "environmental", tabId: "environment-tab", label: "Environmental value", type: "TEXT", required: false }] }] }]));
    localStorage.setItem("eptw-demo-user", "admin-1");

    render(<MemoryRouter initialEntries={["/permits/permit-hot-parent"]}><App /></MemoryRouter>);
    expect(screen.getByLabelText("Health value")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /environmental impact/i }));
    expect(screen.getByLabelText("Environmental value")).toBeTruthy();
    expect((screen.getByLabelText("Environmental value") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByLabelText("Health value")).toBeNull();
  });

  it("shows separate start and end dates in the permit register", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);
    expect(screen.getByRole("columnheader", { name: "Start date" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "End date" })).toBeTruthy();
    const firstRow = document.querySelector(".permit-table tbody tr");
    expect(firstRow?.querySelector("td:nth-child(7)")?.textContent).toBeTruthy();
    expect(firstRow?.querySelector("td:nth-child(8)")?.textContent).toBeTruthy();
  });

  it("selects multiple individual reviewers and MT Groups when creating a permit", () => {
    render(<MemoryRouter initialEntries={["/permits/new"]}><App /></MemoryRouter>);
    const selectors = document.querySelectorAll(".search-multi-select:not(.search-single-select)");
    fireEvent.click(selectors[0].querySelector("summary")!);
    fireEvent.click(screen.getByRole("checkbox", { name: /Marcus Teo/i }));
    expect(selectors[0].querySelector("summary")?.textContent).toContain("Irene Lim");
    expect(selectors[0].querySelector("summary")?.textContent).toContain("Marcus Teo");
    fireEvent.click(selectors[1].querySelector("summary")!);
    fireEvent.click(screen.getByRole("checkbox", { name: /F10A1 AMHS Engineer/i }));
    expect(selectors[1].querySelector("summary")?.textContent).toContain("Facilities MT");
    expect(selectors[1].querySelector("summary")?.textContent).toContain("F10A1 AMHS Engineer");
  });

  it("turns every selected template section into its own permit step", () => {
    localStorage.setItem("eptw-templates:v4", JSON.stringify([{ id: "custom-parent", kind: "PARENT", name: "Custom Installation", code: "CI", discipline: "AMHS", description: "Custom installation permit.", active: true, updatedAt: "2026-10-02T00:00:00.000Z", sections: [{ id: "section-work", title: "Installation details", description: "Enter the installation information.", fields: [{ id: "equipment-id", label: "Equipment ID", type: "TEXT", required: true }] }, { id: "section-access", title: "Access planning", description: "Confirm the access plan.", fields: [{ id: "access-route", label: "Access route", type: "TEXTAREA", required: false }] }] }]));
    render(<MemoryRouter initialEntries={["/permits/new"]}><App /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Permit template type"), { target: { value: "custom-parent" } });
    expect(screen.getByRole("button", { name: /installation details/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /access planning/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /installation details/i }));
    expect(screen.getByRole("heading", { name: "Installation details" })).toBeTruthy();
    expect(screen.getByLabelText("Equipment ID *")).toBeTruthy();
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /access planning/i }));
    expect(screen.getByRole("heading", { name: "Access planning" })).toBeTruthy();
    expect(screen.getByLabelText("Access route")).toBeTruthy();
  });

  it("uploads and removes documents from template file fields", async () => {
    localStorage.setItem("eptw-demo-user", "req-1");
    localStorage.setItem("eptw-templates:v4", JSON.stringify([{ id: "file-parent", kind: "PARENT", name: "Document permit", code: "DOC", discipline: "Facilities", description: "Permit with attachments.", active: true, updatedAt: "2026-10-09T00:00:00.000Z", sections: [{ id: "documents", title: "Documents", description: "Upload supporting files.", fields: [{ id: "supporting-file", label: "Supporting document", type: "FILE", required: true, width: 3 }] }] }]));
    render(<MemoryRouter initialEntries={["/permits/new"]}><App /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Permit template type"), { target: { value: "file-parent" } });
    const file = new File(["document contents"], "risk-assessment.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Supporting document *"), { target: { files: [file] } });

    expect(await screen.findByText("risk-assessment.pdf")).toBeTruthy();
    expect(screen.queryByText("Choose document")).toBeNull();
    expect(screen.getByRole("link", { name: "Download" }).getAttribute("download")).toBe("risk-assessment.pdf");
    fireEvent.click(screen.getByRole("button", { name: "Remove risk-assessment.pdf" }));
    expect(screen.queryByText("risk-assessment.pdf")).toBeNull();
    expect(screen.getByText("Choose document")).toBeTruthy();
  });

  it("opens the permit row menu with icon-labelled actions", () => {
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);
    const menu = screen.getByLabelText("Actions for F10A1-G-AMHS-2026-09-08/0001");
    fireEvent.click(menu);
    expect(within(menu.closest("details")!).getByRole("link", { name: "View" })).toBeTruthy();
    expect(within(menu.closest("details")!).getByRole("button", { name: "Export as PDF" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Review" })).toBeNull();
    expect(within(menu.closest("details")!).getByRole("button", { name: "Duplicate" })).toBeTruthy();
  });

  it("shows only Edit, Duplicate, and Delete actions for an owned draft permit", () => {
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);
    const menu = screen.getByLabelText("Actions for F10A2-G-Facilities-2026-09-09/0004");
    fireEvent.click(menu);
    const actions = within(menu.closest("details")!);
    expect(actions.getByRole("link", { name: "Edit" })).toBeTruthy();
    expect(actions.getByRole("button", { name: "Duplicate" })).toBeTruthy();
    expect(actions.getByRole("button", { name: "Delete draft" })).toBeTruthy();
    expect(actions.queryByRole("link", { name: "View" })).toBeNull();
    expect(actions.queryByRole("button", { name: "Export as PDF" })).toBeNull();
  });

  it("lets the owner edit and save the draft permit setup and approval route", () => {
    render(<MemoryRouter initialEntries={["/permits/permit-draft/edit"]}><App /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Permit setup & approval route" })).toBeTruthy();
    expect(screen.getByText("Host & approval route")).toBeTruthy();
    fireEvent.change(screen.getByText("Site", { selector: "label > span" }).closest("label")!.querySelector("select")!, { target: { value: "F10N" } });
    const hostSupervisor = screen.getByLabelText("Host supervisor *");
    fireEvent.click(hostSupervisor);
    fireEvent.click(within(hostSupervisor.closest("details")!).getByRole("radio", { name: /Marcus Teo/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    const state = JSON.parse(localStorage.getItem("eptw-functional-draft:v2")!);
    const draft = state.permits.find((permit: { id: string }) => permit.id === "permit-draft");
    const revision = draft.revisions.find((item: { id: string }) => item.id === draft.currentRevisionId);
    expect(revision.data.site).toBe("F10N");
    expect(revision.data.hostSupervisorId).toBe("mt-1");
  });

  it("opens action menus upward for the bottom permit rows", () => {
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);
    const menus = screen.getAllByLabelText(/actions for/i);
    const bottomMenu = menus.at(-1)!;
    expect(bottomMenu.closest("details")?.classList.contains("open-up")).toBe(true);
    fireEvent.click(bottomMenu);
    expect(bottomMenu.closest("details")?.hasAttribute("open")).toBe(true);
  });

  it("moves action menus in grouped dashboard tables to the front layer", () => {
    localStorage.setItem("eptw-demo-user", "ir-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);

    const groupedTable = document.querySelector(".dashboard-grouped-results .dashboard-results")!;
    const menu = within(groupedTable as HTMLElement).getAllByLabelText(/actions for/i)[0];
    fireEvent.click(menu);
    expect(menu.closest("details")?.hasAttribute("open")).toBe(true);
    expect(within(menu.closest("details")!).getByRole("link", { name: "View" })).toBeTruthy();
  });

  it("shows a create permit action instead of view-all links on dashboards for permitted users", () => {
    localStorage.setItem("eptw-demo-user", "ir-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);

    const submittedResults = Array.from(document.querySelectorAll<HTMLElement>(".dashboard-results")).find((section) => section.querySelector("h2")?.textContent === "Submitted Permit")!;
    expect(within(submittedResults).getByRole("link", { name: /Create permit/i }).getAttribute("href")).toBe("/permits/new");
    expect(document.querySelector(".page-header a[href='/permits/new']")).toBeNull();
    expect(screen.queryByRole("link", { name: /View all/i })).toBeNull();
  });

  it("hides the create permit action from dashboard users without create permission", () => {
    localStorage.setItem("eptw-demo-user", "pm-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);

    expect(screen.queryByRole("link", { name: /Create permit/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /View all/i })).toBeNull();
  });

  it("keeps only one permit action menu open at a time", () => {
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);
    const menus = screen.getAllByLabelText(/actions for/i);
    fireEvent.click(menus[0]);
    expect(menus[0].closest("details")?.hasAttribute("open")).toBe(true);
    fireEvent.click(menus[1]);
    expect(menus[0].closest("details")?.hasAttribute("open")).toBe(false);
    expect(menus[1].closest("details")?.hasAttribute("open")).toBe(true);
    expect(document.querySelectorAll(".row-menu[open]")).toHaveLength(1);
  });

  it("duplicates a permit into an owned editable draft with the same form information", () => {
    const state = createSeedState(); const source = state.permits.find((permit) => permit.id === "permit-review")!; const sourceRevision = currentRevision(source);
    sourceRevision.data.templateId = "duplicate-template";
    sourceRevision.data.templateName = "Duplicate test";
    sourceRevision.data.customFields = {
      equipment: "Original equipment information",
      attachment: JSON.stringify({ name: "large-plan.pdf", type: "application/pdf", size: 1_900_000, dataUrl: `data:application/pdf;base64,${"A".repeat(2_550_000)}` }),
      signature: "data:image/png;base64,AAAA",
    };
    sourceRevision.data.startAt = "27/10/2026";
    sourceRevision.data.endAt = "30/10/2026";
    localStorage.setItem("eptw-functional-draft:v2", JSON.stringify(state));
    localStorage.setItem("eptw-templates:v4", JSON.stringify([{ id: "duplicate-template", kind: "PARENT", name: "Duplicate test", code: "G", discipline: "AMHS", description: "Duplicate workflow", active: true, updatedAt: "2026-10-28T00:00:00.000Z", sections: [{ id: "general", title: "General information", description: "", fields: [{ id: "equipment", label: "Equipment reference", type: "TEXT", required: true }, { id: "attachment", label: "Plan", type: "FILE", required: false }, { id: "signature", label: "Signature", type: "SIGNATURE", required: false }] }] }]));
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);

    const menuButton = screen.getByLabelText(`Actions for ${source.permitNumber}`);
    fireEvent.click(menuButton);
    fireEvent.click(within(menuButton.closest("details")!).getByRole("button", { name: "Duplicate" }));

    expect(screen.getByRole("heading", { name: "Edit permit revision" })).toBeTruthy();
    const field = screen.getByLabelText("Equipment reference *") as HTMLInputElement;
    expect(field.value).toBe("Original equipment information");
    fireEvent.change(field, { target: { value: "Updated duplicate information" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    const savedState = JSON.parse(localStorage.getItem("eptw-functional-draft:v2")!);
    const duplicate = savedState.permits.find((permit: { audit: { action: string }[] }) => permit.audit.some((event) => event.action === "DUPLICATED_FROM"));
    expect(duplicate.requestorId).toBe("req-1");
    expect(duplicate.revisions[0].status).toBe("DRAFT");
    expect(duplicate.revisions[0].data.customFields.equipment).toBe("Updated duplicate information");
    expect(duplicate.revisions[0].data.customFields.attachment).toBe("");
    expect(duplicate.revisions[0].data.customFields.signature).toBe("");
    const singaporeDay = (value: string) => Object.fromEntries(new Intl.DateTimeFormat("en", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Singapore" }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
    expect(singaporeDay(duplicate.revisions[0].data.startAt)).toMatchObject({ year: "2026", month: "10", day: "27" });
    expect(singaporeDay(duplicate.revisions[0].data.endAt)).toMatchObject({ year: "2026", month: "10", day: "30" });
  });

  it("lets a user delete their own draft from the permit menu", () => {
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);
    const permitNumber = "F10A2-G-Facilities-2026-09-09/0004";
    fireEvent.click(screen.getByLabelText(`Actions for ${permitNumber}`));
    fireEvent.click(screen.getByRole("button", { name: "Delete draft" }));
    const dialog = screen.getByRole("dialog", { name: "Delete draft?" });
    expect(within(dialog).getByText(permitNumber)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete draft" }));

    expect(screen.queryAllByText(permitNumber)).toHaveLength(0);
  });

  it("hides drafts owned by another user from the permit register", () => {
    localStorage.setItem("eptw-demo-user", "pm-1");
    render(<MemoryRouter initialEntries={["/child-permits"]}><App /></MemoryRouter>);

    expect(screen.getAllByText("F10A1-B1-Facilities-2026-09-09/0002-1").length).toBeGreaterThan(0);
    expect(screen.queryByText("F10A1-B2-Facilities-2026-09-09/0002-2")).toBeNull();
    expect(screen.queryByText("F10A1-B3-Facilities-2026-09-09/0002-3")).toBeNull();
    expect(screen.queryByText("F10A1-B4-Facilities-2026-09-09/0002-4")).toBeNull();
    expect(screen.queryByText("F10A1-A01-Facilities-2026-09-09/0002-5")).toBeNull();
  });

  it("keeps parent and child templates in separate tabs and adds a child template", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/templates"]}><App /></MemoryRouter>);
    expect(screen.getByRole("tab", { name: /parent template/i }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("columnheader", { name: /permit code/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /parent template 3/i })).toBeTruthy();
    expect(screen.getByText("General")).toBeTruthy();
    expect(screen.getByText("Tool Install")).toBeTruthy();
    expect(screen.getByText("SIPP")).toBeTruthy();
    expect(Array.from(document.querySelectorAll(".template-kind-icon")).map((item) => item.textContent)).toEqual(["G", "TI", "GS"]);
    fireEvent.click(screen.getByRole("tab", { name: /child template/i }));
    expect(screen.getByRole("tab", { name: /child template 29/i })).toBeTruthy();
    expect(screen.getByText("Upload Risk Assessment Form")).toBeTruthy();
    expect(screen.getByText("HOT WORKS")).toBeTruthy();
    expect(screen.getByText("LIVE ELECTRICAL PERMIT")).toBeTruthy();
    expect(screen.getByText("FAB 10 Environmental Aspect/Impact Assessment")).toBeTruthy();
    expect(screen.getByText("A Frame Ladder Inspection")).toBeTruthy();
    expect(screen.getByText("Proposed use of Personnel Lift/MEWP")).toBeTruthy();
    expect(screen.getByText("Dirty Permit")).toBeTruthy();
    expect(screen.getByText("Scaffold Dismantle Checklist")).toBeTruthy();
    expect(screen.queryByText(/GENERAL PERMIT TO WORK/i)).toBeNull();
    expect(screen.queryByText(/SIPP PERMIT/i)).toBeNull();
    expect(screen.getByText("Ladder Certification99").closest("tr")?.textContent).toContain("Inactive");
    expect(screen.getByRole("button", { name: /add child template/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /add child template/i }));
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Confined Space Checklist" } });
    fireEvent.change(screen.getByLabelText("Template code"), { target: { value: "CS" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Required controls for confined-space entry." } });
    fireEvent.click(screen.getByRole("button", { name: /create child template/i }));
    expect(screen.getAllByText("Confined Space Checklist").length).toBeGreaterThan(0);
    const createdRow = screen.getByText("Confined Space Checklist").closest("tr")!;
    fireEvent.click(within(createdRow).getByRole("button", { name: "View" }));
    const viewDialog = within(screen.getByRole("dialog", { name: /view confined space checklist/i }));
    expect(viewDialog.getByText("Template preview")).toBeTruthy();
    expect(viewDialog.getByText("General information")).toBeTruthy();
    expect(viewDialog.getByLabelText("Equipment / system reference preview")).toBeTruthy();
    expect(viewDialog.getByLabelText("Required")).toBeTruthy();
  });

  it("creates templates on a dedicated page and saves drafts", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/templates"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /add parent template/i }));
    expect(screen.getByRole("heading", { name: /create parent template/i })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Draft Parent" } });
    fireEvent.change(screen.getByLabelText("Template code"), { target: { value: "DP" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Draft parent template description." } });
    fireEvent.click(screen.getByRole("button", { name: /save as draft/i }));
    expect(screen.getByText("Draft Parent")).toBeTruthy();
    expect(screen.getByText("Draft", { selector: ".template-status" })).toBeTruthy();
  });

  it("adds and edits individual labels in a checkbox element", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/templates/new?kind=PARENT"]}><App /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Field type"), { target: { value: "MULTI_CHECKBOX" } });
    const firstLabel = screen.getByLabelText("Checkbox option 1") as HTMLInputElement;
    fireEvent.change(firstLabel, { target: { value: "Isolation confirmed" } });
    expect(firstLabel.value).toBe("Isolation confirmed");
    fireEvent.click(screen.getByRole("button", { name: /add option/i }));
    expect(screen.getByLabelText("Checkbox option 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove option 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Attach child template to checkbox option 1" }));
    const childTemplate = screen.getByLabelText("Child template for checkbox option 1") as HTMLSelectElement;
    expect(Array.from(childTemplate.options).some((option) => option.text.includes("A01 · Upload Risk Assessment Form"))).toBe(true);
    fireEvent.change(childTemplate, { target: { value: "tpl-child-a01" } });
    expect(childTemplate.value).toBe("tpl-child-a01");
    expect(firstLabel.value).toBe("Isolation confirmed");
  });

  it("opens the child template attached to a selected multiple-checkbox option", () => {
    localStorage.setItem("eptw-templates:v4", JSON.stringify([
      { id: "parent", kind: "PARENT", name: "Linked checklist", code: "LC", discipline: "Facilities", description: "Parent with linked child forms.", active: true, updatedAt: "2026-10-05T00:00:00.000Z", sections: [{ id: "section", title: "Checklist", description: "Select applicable work.", fields: [{ id: "choices", label: "Applicable work", type: "MULTI_CHECKBOX", required: false, options: ["Hot work", "Lifting"], childTemplateIds: ["child", null], width: 6 }] }] },
      { id: "child", kind: "CHILD", name: "Hot work controls", code: "HW", discipline: "Facilities", description: "Hot work child form.", active: true, updatedAt: "2026-10-05T00:00:00.000Z", sections: [{ id: "child-section", title: "Fire controls", description: "Confirm the controls.", fields: [{ id: "fire-watch", label: "Fire watch name", type: "TEXT", required: true, width: 3 }] }] }
    ]));
    render(<MemoryRouter initialEntries={["/permits/new"]}><App /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Permit template type"), { target: { value: "parent" } });
    fireEvent.click(screen.getByRole("button", { name: /checklist/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /hot work/i }));
    expect(screen.getByText("#HW")).toBeTruthy();
    expect(screen.getByText("Hot work controls")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Attached child template forms" })).toBeTruthy();
    expect(screen.getByLabelText("Fire watch name *")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to HW form" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add another HW form" }));
    expect(screen.getAllByLabelText("Fire watch name *")).toHaveLength(2);
    expect(screen.getByText("Record 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove HW record 2" }));
    expect(screen.getAllByLabelText("Fire watch name *")).toHaveLength(1);
    fireEvent.click(screen.getByRole("checkbox", { name: /hot work/i }));
    expect(screen.queryByLabelText("Fire watch name *")).toBeNull();
  });

  it("adds and edits dropdown options without comma-separated input", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/templates/new?kind=PARENT"]}><App /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Field type"), { target: { value: "SELECT" } });
    fireEvent.change(screen.getByLabelText("Dropdown option 1"), { target: { value: "Approved" } });
    fireEvent.click(screen.getByRole("button", { name: /add option/i }));
    fireEvent.change(screen.getByLabelText("Dropdown option 2"), { target: { value: "Rejected" } });
    expect((screen.getByLabelText("Dropdown option 1") as HTMLInputElement).value).toBe("Approved");
    expect((screen.getByLabelText("Dropdown option 2") as HTMLInputElement).value).toBe("Rejected");
    expect(screen.queryByPlaceholderText("Choices separated by commas")).toBeNull();
  });

  it("closes field settings when clicking away or opening another field", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/templates/new?kind=PARENT"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /add form element/i }));
    const firstSettings = screen.getByLabelText("Edit Equipment / system reference").closest("details") as HTMLDetailsElement;
    const secondSettings = screen.getByLabelText("Edit Field 2").closest("details") as HTMLDetailsElement;

    fireEvent.click(firstSettings.querySelector("summary")!);
    expect(firstSettings.open).toBe(true);
    fireEvent.pointerDown(screen.getByLabelText("Section 1 title"));
    expect(firstSettings.open).toBe(false);

    fireEvent.click(firstSettings.querySelector("summary")!);
    fireEvent.pointerDown(secondSettings.querySelector("summary")!);
    fireEvent.click(secondSettings.querySelector("summary")!);
    expect(firstSettings.open).toBe(false);
    expect(secondSettings.open).toBe(true);
  });

  it("adds configurable tabs to a template section and renders them on a permit", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/templates/new?kind=PARENT"]}><App /></MemoryRouter>);
    expect(screen.queryByLabelText("Section 1 instructions")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /instructions/i }));
    fireEvent.change(screen.getByLabelText("Section 1 instructions"), { target: { value: "Only shown when needed." } });
    fireEvent.click(screen.getByRole("button", { name: /hide instructions/i }));
    expect(screen.queryByLabelText("Section 1 instructions")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /add tab/i }));
    expect(screen.getByRole("tab", { name: /tab 1/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /tab 2/i })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tab 1 name"), { target: { value: "Health & Safety" } });
    fireEvent.change(screen.getByLabelText("Tab 2 name"), { target: { value: "EHS Permit" } });
    expect(screen.getByRole("tab", { name: /health & safety/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /ehs permit/i })).toBeTruthy();
    cleanup();

    localStorage.setItem("eptw-demo-user", "req-1");
    localStorage.setItem("eptw-templates:v4", JSON.stringify([{ id: "tabbed-parent", kind: "PARENT", name: "Tabbed permit", code: "TP", discipline: "Facilities", description: "Tabbed form.", active: true, updatedAt: "2026-10-05T00:00:00.000Z", sections: [{ id: "section", title: "Safety confirmation", description: "Choose a tab.", tabs: [{ id: "health", label: "Health & Safety" }, { id: "ehs", label: "EHS Permit" }], fields: [{ id: "impact", tabId: "health", label: "Impact details", type: "TEXT", required: false }, { id: "permit", tabId: "ehs", label: "Permit reference", type: "TEXT", required: false }] }] }]));
    render(<MemoryRouter initialEntries={["/permits/new"]}><App /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Permit template type"), { target: { value: "tabbed-parent" } });
    fireEvent.click(screen.getByRole("button", { name: /safety confirmation/i }));
    expect(screen.getByRole("tab", { name: /health & safety/i })).toBeTruthy();
    expect(screen.getByLabelText("Impact details")).toBeTruthy();
    expect(screen.queryByLabelText("Permit reference")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /ehs permit/i }));
    expect(screen.getByLabelText("Permit reference")).toBeTruthy();
    expect(screen.queryByLabelText("Impact details")).toBeNull();
  });

  it("reorders template sections with move up and down controls", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/templates/new?kind=PARENT"]}><App /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Section 1 title"), { target: { value: "First section" } });
    fireEvent.click(screen.getByRole("button", { name: /add section/i }));
    fireEvent.change(screen.getByLabelText("Section 2 title"), { target: { value: "Second section" } });

    expect((screen.getByRole("button", { name: "Move section 1 up" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Move section 2 down" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Move section 2 up" }));
    expect((screen.getByLabelText("Section 1 title") as HTMLInputElement).value).toBe("Second section");
    expect((screen.getByLabelText("Section 2 title") as HTMLInputElement).value).toBe("First section");

    fireEvent.click(screen.getByRole("button", { name: "Move section 1 down" }));
    expect((screen.getByLabelText("Section 1 title") as HTMLInputElement).value).toBe("First section");
    expect((screen.getByLabelText("Section 2 title") as HTMLInputElement).value).toBe("Second section");
  });

  it("only shows the section permission summary when edit access is assigned", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/templates/new?kind=PARENT"]}><App /></MemoryRouter>);
    expect(screen.queryByLabelText("Section edit permissions")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Edit permissions" }));
    const assessorAccess = screen.getByRole("checkbox", { name: /permit assessor/i });
    fireEvent.click(assessorAccess);
    expect(screen.getByLabelText("Section edit permissions").textContent).toContain("Permit Assessor");

    fireEvent.click(assessorAccess);
    expect(screen.queryByLabelText("Section edit permissions")).toBeNull();
  });

  it("toggles template status and supports view, edit, and delete actions", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/templates"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: /child template/i }));
    let row = screen.getByText("A Frame Ladder Inspection").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: /set a frame ladder inspection inactive/i }));
    expect(within(row).getByRole("button", { name: /set a frame ladder inspection active/i }).textContent).toBe("Inactive");

    fireEvent.click(within(row).getByRole("button", { name: "View" }));
    expect(screen.getByRole("dialog", { name: /view a frame ladder inspection/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: "Edit child template" })).toBeTruthy();
    expect((screen.getByLabelText("Template name") as HTMLInputElement).value).toBe("A Frame Ladder Inspection");
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "A Frame Ladder Safety Inspection" } });
    fireEvent.change(screen.getByLabelText("Section 1 title"), { target: { value: "Ladder details" } });
    fireEvent.change(screen.getByLabelText("Field label"), { target: { value: "Ladder asset number" } });
    expect(screen.getByRole("button", { name: "Drag Ladder asset number to reposition" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Drag to resize Ladder asset number width" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Drag to resize Ladder asset number height" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    row = screen.getByText("A Frame Ladder Safety Inspection").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "View" }));
    expect(screen.getByText("Ladder details")).toBeTruthy();
    expect(screen.getByText("Ladder asset number")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const confirmDelete = vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
    expect(screen.queryByText("A Frame Ladder Safety Inspection")).toBeNull();
    confirmDelete.mockRestore();
  });

  it("renders the staging site register and adds a site", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/sites"]}><App /></MemoryRouter>);
    expect(screen.getByText("Micron Semiconductor Asia Pte Ltd")).toBeTruthy();
    expect(screen.getByText("Fab 10A1")).toBeTruthy();
    expect(screen.getByText("1 Woodlands Industrial Park D Street 1, Singapore 738799")).toBeTruthy();
    expect(screen.queryByText("Primary address")).toBeNull();
    expect(screen.queryByText("Alternate address")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add site to 1 N Coast Dr, Singapore 757432" }));
    expect((screen.getByLabelText("Site address") as HTMLInputElement).value).toBe("1 N Coast Dr, Singapore 757432");
    fireEvent.change(screen.getByLabelText("Site name"), { target: { value: "Micron Test Fab" } });
    fireEvent.change(screen.getByLabelText("Site code"), { target: { value: "MTF" } });
    fireEvent.change(screen.getByLabelText("Site address"), { target: { value: "2 Test Avenue, Singapore 123456" } });
    fireEvent.click(screen.getByRole("button", { name: /save site/i }));
    expect(screen.getByText("Micron Test Fab")).toBeTruthy();
  });

  it("lets only the Micron Admin add a company", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/companies"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Company List" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /company list/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /add company/i }));
    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "Northstar Engineering Pte Ltd" } });
    fireEvent.change(screen.getByLabelText("Registration number"), { target: { value: "202612345A" } });
    fireEvent.change(screen.getByLabelText("Primary contact"), { target: { value: "Jamie Lee" } });
    fireEvent.change(screen.getByLabelText("Contact email"), { target: { value: "jamie@northstar.example" } });
    fireEvent.click(screen.getByRole("button", { name: /save company/i }));
    expect(screen.getByText("Northstar Engineering Pte Ltd")).toBeTruthy();
    expect(localStorage.getItem("eptw-companies:v1")).toContain("202612345A");
  });

  it("does not expose Company List to a Vendor Admin", () => {
    localStorage.setItem("eptw-demo-user", "user-admin-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: /company list/i })).toBeNull();
  });

  it("shows Analytics and SIPP Daily Report only to administrators", () => {
    ["admin-1", "user-admin-1"].forEach((userId) => {
      cleanup();
      localStorage.setItem("eptw-demo-user", userId);
      render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
      expect(screen.getByRole("link", { name: /analytics/i })).toBeTruthy();
      expect(screen.getByRole("link", { name: /sipp daily report/i })).toBeTruthy();
    });
    cleanup();
    localStorage.setItem("eptw-demo-user", "req-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: /analytics/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /sipp daily report/i })).toBeNull();
  });

  it("renders all six analytics reports with selectable date bases", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/analytics"]}><App /></MemoryRouter>);
    [
      "Monthly Approved Permit Count",
      "Permit Submission Count by Type and Status",
      "Permit Count by Contractor",
      "Permit Count by Discipline",
      "Permit Count by Level",
      "ePTW Initiatives",
    ].forEach((name) => expect(screen.getByRole("heading", { name })).toBeTruthy());
    const dateSelectors = screen.getAllByLabelText("Date used");
    fireEvent.change(dateSelectors[1], { target: { value: "approval" } });
    expect((dateSelectors[1] as HTMLSelectElement).value).toBe("approval");
    expect(screen.getAllByRole("img").filter((item) => item.classList.contains("bar-chart"))).toHaveLength(6);
    expect(screen.getByText("Facilities", { selector: "strong" })).toBeTruthy();
  });

  it("exports the currently filtered user list as CSV", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    let downloadedHref = "";
    let downloadedName = "";
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadedHref = this.href;
      downloadedName = this.download;
    });

    render(<MemoryRouter initialEntries={["/settings/users"]}><App /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /export user list/i })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "Irene" } });
    fireEvent.click(screen.getByRole("button", { name: /export user list/i }));

    expect(downloadedName).toMatch(/^eptw-user-list-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(decodeURIComponent(downloadedHref)).toContain("Irene Lim");
    expect(decodeURIComponent(downloadedHref)).not.toContain("priya@contractor.example");
    click.mockRestore();
  });

  it("uses the available account directory on the Users page", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    localStorage.setItem("eptw-user-directory:v1", JSON.stringify([{ id: "directory-user-1", name: "Legacy Demo User", email: "legacy@example.com", sites: ["F10A1"], role: "Micron Staff", groups: [], status: "Approved" }]));
    render(<MemoryRouter initialEntries={["/settings/users"]}><App /></MemoryRouter>);

    expect(screen.getByText("Aisha Rahman")).toBeTruthy();
    expect(screen.getAllByText("Micron Administrator").length).toBeGreaterThan(0);
    expect(screen.getByText("Permit Assessor")).toBeTruthy();
    expect(screen.queryByText("Legacy Demo User")).toBeNull();
    expect(screen.getByText(`${USERS.length} users`)).toBeTruthy();
  });

  it("shows the configured 53 discipline records in the required order", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    localStorage.setItem("eptw-disciplines:v1", JSON.stringify([{ id: "discipline-21", number: 21, code: "LEGACY", description: "Legacy seed" }]));
    render(<MemoryRouter initialEntries={["/settings/disciplines"]}><App /></MemoryRouter>);

    const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>(".disciplines-table tbody tr"));
    expect(rows).toHaveLength(53);
    expect(rows.map((row) => row.cells[1].textContent)).toEqual(DISCIPLINE_RECORDS.map(([code]) => code));
    expect(rows[33].cells[2].textContent).toBe("Global Supply Chain");
    expect(screen.queryByText("LEGACY")).toBeNull();
  });

  it("shows every available site when creating a permit", () => {
    render(<MemoryRouter initialEntries={["/permits/new"]}><App /></MemoryRouter>);

    const siteLabel = screen.getByText("Site", { selector: "label > span" });
    const siteSelect = siteLabel.closest("label")!.querySelector("select")!;
    expect(Array.from(siteSelect.options).map((option) => option.value)).toEqual(SITES);
    expect(SITES).toEqual(["F10A1", "F10A2", "F10N", "F10NX", "F10W", "F10X", "MSH", "TC"]);
  });

  it("shows all users in the MT Groups user directory", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/mt-groups"]}><App /></MemoryRouter>);
    expect(screen.getByRole("columnheader", { name: "User" })).toBeTruthy();
    expect(screen.getByText("Aisha Rahman")).toBeTruthy();
    expect(screen.getAllByText("Micron Administrator").length).toBeGreaterThan(0);
    expect(screen.getByText("Showing 13 of 13 users")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /add mt group/i }));
    expect(screen.getByText("Can edit permit information", { selector: "label" })).toBeTruthy();
  });

  it("lets an admin edit MT groups for an individual user", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/mt-groups"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Edit Aisha Rahman" }));
    const dialog = within(screen.getByRole("dialog", { name: "Aisha Rahman" }));
    fireEvent.click(dialog.getByRole("checkbox", { name: /Facilities MT/i }));
    expect(dialog.getByText("1 of 4 groups assigned")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Done" }));
    expect(localStorage.getItem("eptw-mt-groups:v2")).toContain('"req-1"');
  });

  it("searches and bulk-selects visible MT Group members", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/mt-groups"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getAllByRole("button", { name: /manage members/i })[1]);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("1 selected")).toBeTruthy();
    fireEvent.change(dialog.getByLabelText("Search users for group"), { target: { value: "Marcus" } });
    expect(dialog.getByText("Marcus Teo")).toBeTruthy();
    expect(dialog.queryByText("Irene Lim")).toBeNull();
    fireEvent.click(dialog.getByRole("button", { name: "Select visible" }));
    expect(dialog.getByText("2 selected")).toBeTruthy();
  });

  it("opens an assigned-only member view from the MT Group count", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/mt-groups"]}><App /></MemoryRouter>);
    expect(document.querySelectorAll(".member-avatars")[0].querySelectorAll(".member-avatar")).toHaveLength(6);
    fireEvent.click(screen.getAllByRole("button", { name: /view all 6 assigned members for facilities mt/i })[0]);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("button", { name: /assigned only \(6\)/i }).className).toContain("active");
    expect(dialog.getByText("Marcus Teo")).toBeTruthy();
    expect(dialog.getByText("Irene Lim")).toBeTruthy();
    expect(dialog.getByText("Ravi Kumar")).toBeTruthy();
  });

  it("uses only template sections as permit steps", () => {
    render(<MemoryRouter initialEntries={["/permits/new"]}><App /></MemoryRouter>);
    const template = screen.getByLabelText("Permit template type") as HTMLSelectElement;
    fireEvent.change(template, { target: { value: template.options[1].value } });
    expect(screen.queryByRole("button", { name: /^\d*\s*Hazards$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^\d*\s*Safety$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /work details/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^\d*\s*Review$/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Work scope and schedule" })).toBeNull();
  });
});
