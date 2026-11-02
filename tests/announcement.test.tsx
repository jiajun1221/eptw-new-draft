import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/app/App";
import { LOGIN_ANNOUNCEMENT_KEY } from "../src/domain/announcementStore";

describe("pre-login announcement", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  afterEach(cleanup);

  it.each(["admin-1", "user-admin-1"])("allows admin %s to edit the announcement", (userId) => {
    localStorage.setItem("eptw-demo-user", userId);
    render(<MemoryRouter initialEntries={["/settings/announcement"]}><App /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Announcement title"), { target: { value: "Planned maintenance" } });
    const editor = screen.getByRole("textbox", { name: "Announcement description" });
    editor.innerHTML = "The service will be unavailable tonight.";
    fireEvent.input(editor);
    fireEvent.click(screen.getByRole("button", { name: "Save announcement" }));

    expect(screen.getByText("Announcement saved and published.")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(LOGIN_ANNOUNCEMENT_KEY) ?? "null")).toMatchObject({
      title: "Planned maintenance",
      description: "The service will be unavailable tonight.",
    });
  });

  it("supports and safely renders formatted announcement text", () => {
    localStorage.setItem("eptw-demo-user", "admin-1");
    render(<MemoryRouter initialEntries={["/settings/announcement"]}><App /></MemoryRouter>);

    expect(screen.getByRole("toolbar", { name: "Description formatting" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bulleted list" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add link" })).toBeTruthy();
    const editor = screen.getByRole("textbox", { name: "Announcement description" });
    editor.innerHTML = '<strong>Important</strong><ul><li>Read the update</li></ul><script>alert("no")</script>';
    fireEvent.input(editor);
    fireEvent.change(screen.getByLabelText("Announcement title"), { target: { value: "Formatted notice" } });
    fireEvent.click(screen.getByRole("button", { name: "Save announcement" }));

    const stored = JSON.parse(localStorage.getItem(LOGIN_ANNOUNCEMENT_KEY) ?? "null");
    expect(stored.description).toContain("<strong>Important</strong>");
    expect(stored.description).toContain("<li>Read the update</li>");
    expect(stored.description).not.toContain("<script>");
    expect(document.querySelector(".announcement-preview strong")?.textContent).toBe("Important");
    expect(document.querySelector(".announcement-preview li")?.textContent).toBe("Read the update");
  });

  it("blocks the login page until the announcement is acknowledged", () => {
    localStorage.setItem(LOGIN_ANNOUNCEMENT_KEY, JSON.stringify({ title: "Safety notice", description: "Read this message before signing in.", updatedAt: "2026-10-29T00:00:00.000Z" }));
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);

    expect(screen.getByRole("dialog", { name: "Safety notice" })).toBeTruthy();
    const continueButton = screen.getByRole("button", { name: "Continue to login" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /acknowledge this announcement/i }));
    expect(continueButton.disabled).toBe(false);
    fireEvent.click(continueButton);
    expect(screen.queryByRole("dialog", { name: "Safety notice" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Sign in to your account" })).toBeTruthy();
  });
});
