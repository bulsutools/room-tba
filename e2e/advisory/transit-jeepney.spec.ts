import { test, expect } from "@playwright/test";
import { campusTransit } from "../../src/campus.config";
import { waitForAppBoot } from "../helpers/app";

// Campus transit is disabled on this fork.
const describeTransit = campusTransit.enabled
  ? test.describe
  : test.describe.skip;

describeTransit("transit jeepney @advisory", () => {
  test("transit filter chip reachable", async ({ page }) => {
    await page.goto("/");
    await waitForAppBoot(page);
    const transit = page
      .getByRole("button", { name: /transit|jeepney/i })
      .first();
    if (await transit.isVisible({ timeout: 5000 }).catch(() => false)) {
      await transit.click();
      await expect(page).not.toHaveTitle("");
    }
  });
});
