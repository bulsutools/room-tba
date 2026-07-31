import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, test } from "vitest";
import JeepneyRouteModal from "./JeepneyRouteModal.svelte";
import { jeepneyStore } from "@lib/store.svelte";

afterEach(() => {
  jeepneyStore.modalRouteId = null;
});

describe("JeepneyRouteModal", () => {
  test("shows an empty state when the route id is unknown", () => {
    jeepneyStore.modalRouteId = "does-not-exist";
    render(JeepneyRouteModal);
    expect(screen.getByText(/no longer available/i)).toBeVisible();
  });
});
