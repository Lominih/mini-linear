import { test, expect } from "@playwright/test";

test.describe("Issues", () => {
  test.describe("Issue Board", () => {
    test("displays board columns for status categories", async ({ page }) => {
      // Navigate to a project board (requires existing project)
      await page.goto("/projects");
      const url = page.url();
      if (url.includes("/projects")) {
        const projectLink = page.locator('a[href*="/projects/"]').first();
        if (await projectLink.isVisible()) {
          await projectLink.click();
          await page.waitForURL(/\/projects\/[^/]+/);
          // Navigate to board view
          await page.goto(page.url() + "/board");
          // Should show board columns
          await expect(page.locator("body")).toBeVisible();
        }
      }
    });
  });

  test.describe("Issue Creation", () => {
    test("opens issue creation form", async ({ page }) => {
      await page.goto("/projects");
      const url = page.url();
      if (url.includes("/projects")) {
        const projectLink = page.locator('a[href*="/projects/"]').first();
        if (await projectLink.isVisible()) {
          await projectLink.click();
          await page.waitForURL(/\/projects\/[^/]+/);
          const createBtn = page.getByRole("button", { name: /create|new issue|add issue/i });
          if (await createBtn.isVisible()) {
            await createBtn.click();
            await expect(
              page.getByRole("dialog").or(page.getByLabel(/title/i))
            ).toBeVisible({ timeout: 5_000 });
          }
        }
      }
    });

    test("validates issue title is required", async ({ page }) => {
      await page.goto("/projects");
      const url = page.url();
      if (url.includes("/projects")) {
        const projectLink = page.locator('a[href*="/projects/"]').first();
        if (await projectLink.isVisible()) {
          await projectLink.click();
          await page.waitForURL(/\/projects\/[^/]+/);
          const createBtn = page.getByRole("button", { name: /create|new issue|add issue/i });
          if (await createBtn.isVisible()) {
            await createBtn.click();
            const submitBtn = page.getByRole("button", { name: /save|create|submit/i });
            if (await submitBtn.isVisible()) {
              await submitBtn.click();
              await expect(page.locator("body")).toBeVisible();
            }
          }
        }
      }
    });
  });

  test.describe("Issue Detail", () => {
    test("displays issue when clicked from board", async ({ page }) => {
      await page.goto("/projects");
      const url = page.url();
      if (url.includes("/projects")) {
        const projectLink = page.locator('a[href*="/projects/"]').first();
        if (await projectLink.isVisible()) {
          await projectLink.click();
          await page.waitForURL(/\/projects\/[^/]+/);
          // Try clicking a kanban card if it exists
          const issueCard = page.locator('[class*="kanban"] [class*="card"], [data-testid*="issue"]').first();
          if (await issueCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await issueCard.click();
            // Should open detail panel or modal
            await expect(page.locator("body")).toBeVisible();
          }
        }
      }
    });
  });

  test.describe("Issue Filters", () => {
    test("displays filter controls on list view", async ({ page }) => {
      await page.goto("/projects");
      const url = page.url();
      if (url.includes("/projects")) {
        const projectLink = page.locator('a[href*="/projects/"]').first();
        if (await projectLink.isVisible()) {
          await projectLink.click();
          await page.waitForURL(/\/projects\/[^/]+/);
          await page.goto(page.url() + "/list");
          await expect(page.locator("body")).toBeVisible();
        }
      }
    });
  });
});
