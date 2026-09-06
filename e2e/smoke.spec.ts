import { expect, type Page, test } from "@playwright/test";

/**
 * Smoke coverage for the shell: the ribbon, the status bar, and the keyboard
 * shortcuts documented in CLAUDE.md. These exercise real state transitions
 * without stubbing anything, so a regression in the route's keyboard handling
 * or the ribbon's tab state fails here rather than in manual testing.
 */

// The Sidebar footer reuses the .status-bar class, so match on the level
// readout, which only the application status bar renders.
const appStatusBar = (page: Page) =>
  page.locator(".status-bar").filter({ hasText: "Level:" });

const ribbonTab = (page: Page, label: string) =>
  page.locator(".ribbon-tabs").getByRole("button", { name: label, exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(appStatusBar(page)).toBeVisible();
});

test("boots with every ribbon tab and an idle status bar", async ({ page }) => {
  for (const tab of ["Modify", "Architecture", "Annotate", "View", "Manage"]) {
    await expect(ribbonTab(page, tab)).toBeVisible();
  }
  await expect(appStatusBar(page)).toContainText("Ready");
});

test("switching ribbon tabs swaps the tool panel", async ({ page }) => {
  const architecture = ribbonTab(page, "Architecture");
  await architecture.click();
  await expect(architecture).toHaveClass(/active/);
  await expect(
    page.locator(".ribbon-panel").getByRole("button", { name: "Wall", exact: true }),
  ).toBeVisible();
});

test("Shift+W activates the wall tool and Escape clears it", async ({ page }) => {
  await page.keyboard.press("Shift+W");
  await expect(appStatusBar(page)).toContainText("Creating: wall");

  await page.keyboard.press("Escape");
  await expect(appStatusBar(page)).toContainText("Ready");
});

test("G toggles snap-to-grid and reports the grid step", async ({ page }) => {
  await expect(appStatusBar(page)).not.toContainText("Snap:");

  await page.keyboard.press("g");
  await expect(appStatusBar(page)).toContainText("Snap: 0.5m");

  await page.keyboard.press("g");
  await expect(appStatusBar(page)).not.toContainText("Snap:");
});

test("the status bar unit toggle switches between metric and imperial", async ({
  page,
}) => {
  const toggle = page.getByTitle("Toggle between metric (m) and imperial (ft)");
  await expect(toggle).toHaveText("m");

  await toggle.click();
  await expect(toggle).toHaveText("ft");

  await toggle.click();
  await expect(toggle).toHaveText("m");
});
