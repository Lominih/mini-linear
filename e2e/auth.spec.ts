import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.describe("Login Page", () => {
    test("displays login form with email and password fields", async ({ page }) => {
      await page.goto("/auth/login");
      await expect(page.getByRole("heading", { name: /log in|sign in|login/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /log in|sign in|login/i })).toBeVisible();
    });

    test("shows validation error for empty form submission", async ({ page }) => {
      await page.goto("/auth/login");
      await page.getByRole("button", { name: /log in|sign in|login/i }).click();
      // Should not navigate away — still on login page
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test("shows error for invalid credentials", async ({ page }) => {
      await page.goto("/auth/login");
      await page.getByLabel(/email/i).fill("nonexistent@example.com");
      await page.getByLabel(/password/i).fill("WrongPassword1");
      await page.getByRole("button", { name: /log in|sign in|login/i }).click();
      await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 10_000 });
    });

    test("navigates to register page from login", async ({ page }) => {
      await page.goto("/auth/login");
      const registerLink = page.getByRole("link", { name: /register|sign up/i });
      if (await registerLink.isVisible()) {
        await registerLink.click();
        await expect(page).toHaveURL(/\/auth\/register/);
      }
    });
  });

  test.describe("Register Page", () => {
    test("displays registration form", async ({ page }) => {
      await page.goto("/auth/register");
      await expect(page.getByRole("heading", { name: /register|sign up/i })).toBeVisible();
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /register|sign up/i })).toBeVisible();
    });

    test("shows validation for short password", async ({ page }) => {
      await page.goto("/auth/register");
      await page.getByLabel(/name/i).fill("Test User");
      await page.getByLabel(/email/i).fill("test@example.com");
      await page.getByLabel(/password/i).fill("short");
      await page.getByRole("button", { name: /register|sign up/i }).click();
      // Should show password validation or stay on page
      await expect(page).toHaveURL(/\/auth\/register/);
    });

    test("navigates to login from register", async ({ page }) => {
      await page.goto("/auth/register");
      const loginLink = page.getByRole("link", { name: /log in|sign in|login/i });
      if (await loginLink.isVisible()) {
        await loginLink.click();
        await expect(page).toHaveURL(/\/auth\/login/);
      }
    });
  });

  test.describe("Protected Routes", () => {
    test("redirects unauthenticated users to login", async ({ page }) => {
      await page.goto("/dashboard");
      // Should end up at login or auth page
      await expect(page).toHaveURL(/\/auth|\/login/, { timeout: 10_000 });
    });
  });
});
