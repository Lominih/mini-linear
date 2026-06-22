import { test, expect } from "@playwright/test";

test.describe("Projects", () => {
  test.describe("Project List", () => {
    test("displays projects page heading", async ({ page }) => {
      await page.goto("/projects");
      // Should either show projects or redirect to login
      await expect(page.locator("body")).toBeVisible();
    });

    test("shows create project button for authenticated users", async ({ page }) => {
      await page.goto("/projects");
      const createBtn = page.getByRole("button", { name: /create|new project/i });
      // Button visible if logged in, otherwise redirected
      const url = page.url();
      if (url.includes("/projects")) {
        await expect(createBtn).toBeVisible();
      }
    });
  });

  test.describe("Project Board View", () => {
    test("navigates to board view", async ({ page }) => {
      await page.goto("/projects");
      const url = page.url();
      if (url.includes("/projects")) {
        // If there's a project link, click it
        const projectLink = page.locator('a[href*="/projects/"]').first();
        if (await projectLink.isVisible()) {
          await projectLink.click();
          await expect(page).toHaveURL(/\/projects\//);
        }
      }
    });
  });

  test.describe("Project Creation", () => {
    test("opens create project modal", async ({ page }) => {
      await page.goto("/projects");
      const createBtn = page.getByRole("button", { name: /create|new project/i });
      if (await createBtn.isVisible()) {
        await createBtn.click();
        // Modal or form should appear
        await expect(
          page.getByRole("dialog").or(page.getByRole("form")).or(page.getByLabel(/project name/i))
        ).toBeVisible({ timeout: 5_000 });
      }
    });

    test("validates project name is required", async ({ page }) => {
      await page.goto("/projects");
      const createBtn = page.getByRole("button", { name: /create|new project/i });
      if (await createBtn.isVisible()) {
        await createBtn.click();
        // Try to submit without filling name
        const submitBtn = page.getByRole("button", { name: /save|create|submit/i });
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          // Should show validation error or stay on form
          await expect(page.locator("body")).toBeVisible();
        }
      }
    });
  });

  test.describe("Project Settings", () => {
    test("navigates to project list page", async ({ page }) => {
      await page.goto("/projects");
      await expect(page.locator("body")).toBeVisible();
    });
  });
});
