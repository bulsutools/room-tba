import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, test } from "vitest";
import Sidebar from "./Sidebar.svelte";
import { sidebarStore } from "@lib/store.svelte";
import { mountAtWidth } from "@test/layout-assertions";

describe("Sidebar", () => {
  test("shows the Events and Jeepney routes browse entries at 320px", () => {
    sidebarStore.changeOpened("map");
    mountAtWidth(320);
    render(Sidebar);

    // NavLink renders each label as tooltip text in the DOM.
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Jeepney routes")).toBeInTheDocument();
  });

  test("groups the bottom rail under Contributors and Help toggles", async () => {
    render(Sidebar);

    const help = screen.getByText("Help & settings");
    expect(help).toBeInTheDocument();
    expect(screen.getByText("Contributors")).toBeInTheDocument();

    // Help section is collapsed until its toggle is pressed.
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    await fireEvent.click(help.closest("button")!);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  test("keeps the rail toggle in the header row, not the destination list", () => {
    render(Sidebar);

    const toggle = screen.getByRole("button", { name: "Expand menu" });
    // Sits beside the wordmark; it is chrome, not a place you can go.
    expect(toggle.closest(".sidebar-header")).not.toBeNull();
    expect(toggle.closest(".categories")).toBeNull();
    // Icon-only: it must never render its label as an inline nav row again.
    expect(toggle).not.toHaveClass("nav-link--expanded");
  });

  test("links to the dedicated Wiki without expanding the rail", () => {
    render(Sidebar);

    const wiki = screen.getByText("Wiki").closest("a");
    expect(wiki).toHaveAttribute("href", "/wiki");
    expect(wiki).not.toHaveAttribute("target");
  });
});
