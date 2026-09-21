import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";

describe("application shell", () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem("eptw-demo-user", "req-1"); });
  afterEach(cleanup);

  it("renders the requestor dashboard and role-aware navigation", () => {
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /welcome, aisha/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /awaiting approval/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /raised/i })).toBeTruthy();
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

  it("shows organisation-wide status counts on the Micron Admin dashboard", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /permit overview/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /total permits/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /all pending approval/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /all approved permits/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /all rejected permits/i })).toBeTruthy();
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
  });

  it("separates Micron Staff assigned approvals from their own permits", () => {
    localStorage.setItem("eptw-demo-user", "ir-1");
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /pending my approval/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /awaiting approval/i })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /pending approval/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /approved permits/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /active permits/i })).toBeNull();
    expect(screen.getByRole("heading", { name: /all available permits/i })).toBeTruthy();
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
    fireEvent.click(screen.getByLabelText(/actions for f10a1-hw/i));
    expect(screen.getByRole("link", { name: /^view$/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^review$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /export as pdf/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /duplicate/i })).toBeNull();
  });

  it("opens the selected sidebar resource page", () => {
    render(<MemoryRouter initialEntries={["/help?resource=tutorials"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /tutorial videos/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /tutorial videos/i }).className).toContain("active");
    expect(screen.getByRole("link", { name: "Watch B1 Hot Work permit" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workflow" }));
    expect(screen.getByText("Approval and rejection flow")).toBeTruthy();
    expect(screen.queryByText("B1 Hot Work permit")).toBeNull();
  });

  it("shows and searches the form download library", () => {
    render(<MemoryRouter initialEntries={["/help?resource=forms"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Form downloads" })).toBeTruthy();
    expect(screen.getByText("Risk Assessment")).toBeTruthy();
    expect(screen.getByText("ePTW User Guide v3.0")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download Hot Work Signage" }).hasAttribute("download")).toBe(true);
    fireEvent.change(screen.getByLabelText("Search downloadable forms"), { target: { value: "confined" } });
    expect(screen.getByText("Confined Space Signage")).toBeTruthy();
    expect(screen.queryByText("Risk Assessment")).toBeNull();
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
    render(<MemoryRouter initialEntries={["/lss-fas-permits"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /lss \/ fas impairment requests/i })).toBeTruthy();
    expect(screen.getByText("F10A1-LSS-2026-09/0012")).toBeTruthy();
    expect(document.querySelectorAll(".lss-date-group")).toHaveLength(4);
    expect(document.querySelectorAll(".lss-status-group")).toHaveLength(7);
    fireEvent.click(screen.getByLabelText("Show empty statuses"));
    expect(document.querySelectorAll(".lss-status-group")).toHaveLength(16);
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

  it("orders the permit register by operational status priority", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);
    const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>(".permit-table tbody tr"));
    expect(rows[0].textContent).toContain("Draft permit");
    expect(rows[1].textContent).toContain("Pending");
    expect(rows[2].textContent).toContain("Pending");
    expect(rows[3].textContent).toContain("Active");
  });

  it("selects multiple individual reviewers and MT Groups when creating a permit", () => {
    render(<MemoryRouter initialEntries={["/permits/new"]}><App /></MemoryRouter>);
    const selectors = document.querySelectorAll(".search-multi-select");
    fireEvent.click(selectors[0].querySelector("summary")!);
    fireEvent.click(screen.getByRole("checkbox", { name: /Marcus Teo/i }));
    expect(selectors[0].querySelector("summary")?.textContent).toContain("2 selected");
    fireEvent.click(selectors[1].querySelector("summary")!);
    fireEvent.click(screen.getByRole("checkbox", { name: /F10A1 AMHS Engineer/i }));
    expect(selectors[1].querySelector("summary")?.textContent).toContain("2 selected");
  });

  it("opens the permit row menu with icon-labelled actions", () => {
    render(<MemoryRouter initialEntries={["/permits"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getAllByLabelText(/actions for/i)[0]);
    expect(screen.getAllByRole("link", { name: "View" })[0]).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Export as PDF" })[0]).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Review" })[0]).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Duplicate" })[0]).toBeTruthy();
  });

  it("keeps parent and child templates in separate tabs and adds a child template", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/templates"]}><App /></MemoryRouter>);
    expect(screen.getByRole("tab", { name: /parent template/i }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: /child template/i }));
    expect(screen.getByRole("button", { name: /add child template/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /add child template/i }));
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Confined Space Checklist" } });
    fireEvent.change(screen.getByLabelText("Template code"), { target: { value: "CS" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Required controls for confined-space entry." } });
    fireEvent.click(screen.getByRole("button", { name: /create child template/i }));
    expect(screen.getAllByText("Confined Space Checklist").length).toBeGreaterThan(0);
  });

  it("renders the staging site register and adds a site", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/sites"]}><App /></MemoryRouter>);
    expect(screen.getByText("Micron Semiconductor Asia Pte Ltd")).toBeTruthy();
    expect(screen.getByText("Fab 10A1")).toBeTruthy();
    expect(screen.getByText("1 Woodlands Industrial Park D Street 1, Singapore 738799")).toBeTruthy();
    expect(screen.getByText("Alternate address")).toBeTruthy();
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

  it("renders all six analytics reports with interactive breakdown tabs", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/analytics"]}><App /></MemoryRouter>);
    [
      "Monthly approved permit count",
      "Child permits by date range",
      "General vs tool install permits",
      "Permit count by date range and site",
      "General and tool install count by child permit",
      "ePTW initiatives and carbon savings",
    ].forEach((name) => expect(screen.getByRole("heading", { name })).toBeTruthy());
    fireEvent.click(screen.getByRole("tab", { name: /by discipline/i }));
    expect(screen.getByRole("tab", { name: /by discipline/i }).getAttribute("aria-selected")).toBe("true");
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
    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "Sean" } });
    fireEvent.click(screen.getByRole("button", { name: /export user list/i }));

    expect(downloadedName).toMatch(/^eptw-user-list-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(decodeURIComponent(downloadedHref)).toContain("Sean Wei Tat Justin");
    expect(decodeURIComponent(downloadedHref)).not.toContain("pm2@abc.com");
    click.mockRestore();
  });

  it("shows all users in the MT Groups user directory", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/mt-groups"]}><App /></MemoryRouter>);
    expect(screen.getByRole("columnheader", { name: "User" })).toBeTruthy();
    expect(screen.getByText("Aisha Rahman")).toBeTruthy();
    expect(screen.getByText("Micron Administrator")).toBeTruthy();
    expect(screen.getByText("Showing 12 of 12 users")).toBeTruthy();
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

  it("adds independent embedded Safety checklist forms and removes them when unchecked", () => {
    render(<MemoryRouter initialEntries={["/permits/new"]}><App /></MemoryRouter>);
    const template = screen.getByLabelText("Permit template type") as HTMLSelectElement;
    fireEvent.change(template, { target: { value: template.options[1].value } });
    fireEvent.click(screen.getByRole("button", { name: /safety/i }));

    fireEvent.click(screen.getByRole("checkbox", { name: /portable water/i }));
    fireEvent.change(screen.getByLabelText("Work impact details *"), { target: { value: "Isolation can interrupt utility supply." } });
    fireEvent.change(screen.getByLabelText("Controls and prerequisites *"), { target: { value: "Notify operations and isolate the line." } });

    fireEvent.click(screen.getByRole("tab", { name: /environmental/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /noise nuisance/i }));
    expect(screen.getByLabelText("Assessment and control plan *")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /health & safety/i }));
    expect((screen.getByLabelText("Work impact details *") as HTMLTextAreaElement).value).toContain("Isolation can interrupt");

    fireEvent.click(screen.getByRole("checkbox", { name: /portable water/i }));
    expect(screen.queryByLabelText("Work impact details *")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /ehs permit/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /hot work permit/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /non-micron sub-permit/i }));
    expect(screen.getByLabelText("Non-Micron permit number *")).toBeTruthy();
  });
});
