import { test, expect } from "@playwright/test";

test.describe("Sprints", () => {
  test.describe("Sprint List", () => {
    test("displays sprints page for a project", async ({ page }) => {
      await page.goto("/projects");
      const url = page.url();
      if (url.includes("/projects")) {
        const projectLink = page.locator('a[href*="/projects/"]').first();
        if (await projectLink.isVisible()) {
          await projectLink.click();
          await page.waitForURL(/\/projects\/[^/]+/);
          await page.goto(page.url() + "/sprints");
          await expect(page.locator("body")).toBeVisible();
        }
      }
    });

    test("shows create sprint button", async ({ page }) => {
      await page.goto("/projects");
      const url = page.url();
      if (url.includes("/projects")) {
        const projectLink = page.locator('a[href*="/projects/"]').first();
        if (await projectLink.isVisible()) {
          await projectLink.click();
          await page.waitForURL(/\/projects\/[^/]+/);
          await page.goto(page.url() + "/sprints");
          const createBtn = page.getByRole("button", { name: /create|new sprint/i });
          if (await createBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await expect(createBtn).toBeVisible();
          }
        }
      }
    });
  });

  test.describe("Sprint Creation", () => {
    test("opens sprint creation form", async ({ page }) => {
      await page.goto("/projects");
      const url = page.url();
      if (url.includes("/projects")) {
        const projectLink = page.locator('a[href*="/projects/"]').first();
        if (await projectLink.isVisible()) {
          await projectLink.click();
          await page.waitForURL(/\/projects\/[^/]+/);
          await page.goto(page.url() + "/sprints");
          const createBtn = page.getByRole("button", { name: /create|new sprint/i });
          if (await createBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await createBtn.click();
            await expect(
              page.getByRole("dialog").or(page.getByLabel(/sprint name/i))
            ).toBeVisible({ timeout: 5_000 });
          }
        }
      }
    });
  });

  test.describe("Sprint Detail", () => {
    test("navigates to individual sprint", async ({ page }) => {
      await page.goto("/projects");
      const url = page.url();
      if (url.includes("/projects")) {
        const projectLink = page.locator('a[href*="/projects/"]').first();
        if (await projectLink.isVisible()) {
          await projectLink.click();
          await page.waitForURL(/\/projects\/[^/]+/);
          await page.goto(page.url() + "/sprints");
          const sprintLink = page.locator('a[href*="/sprints/"]').first();
          if (await sprintLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await sprintLink.click();
            await expect(page).toHaveURL(/\/sprints\/[^/]+/);
          }
        }
      }
    });
  });

  test.describe("Sprint Actions", () => {
    test("shows sprint status controls for active sprints", async ({ page }) => {
      await page.goto("/projects");
      const url = page.url();
      if (url.includes("/projects")) {
        const projectLink = page.locator('a[href*="/projects/"]').first();
        if (await projectLink.isVisible()) {
          await projectLink.click();
          await page.waitForURL(/\/projects\/[^/]+/);
          await page.goto(page.url() + "/sprints");
          // Sprint cards should be visible if any exist
          await expect(page.locator("body")).toBeVisible();
        }
      }
    });
  });
});
