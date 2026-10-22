import { test, expect } from "@playwright/test";

test("login renders on desktop and mobile without horizontal overflow", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Ingresá a tu proyecto" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("unauthenticated portal and registration requests return to login", async ({ page }) => {
  for (const route of ["/", "/admin/projects", "/projects/seed-project", "/workspace", "/register"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Ingresá a tu proyecto" })).toBeVisible();
  }
});

test("theme choice survives a reload", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Modo oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Modo claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

// These are transport/UI tests with intercepted responses, NOT successful DB login E2E.
test("network failure releases the submit state and allows a retry", async ({ page }) => {
  await page.route("**/api/auth/login", route => route.abort("failed"));
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@example.com");
  await page.getByLabel("Contraseña").fill("fictional-password");
  await page.getByRole("button", { name: "Ingresar al portal" }).click();
  await expect(page.getByRole("alert")).toContainText("Revisá tu conexión");
  await expect(page.getByRole("button", { name: "Ingresar al portal" })).toBeEnabled();
  await page.unroute("**/api/auth/login");
  await page.route("**/api/auth/login", route => route.fulfill({ status: 401, json: { error: "Credenciales inválidas" } }));
  await page.getByRole("button", { name: "Ingresar al portal" }).click();
  await expect(page.getByRole("alert")).toHaveText("Credenciales inválidas");
  await expect(page.getByRole("button", { name: "Ingresar al portal" })).toBeEnabled();
});

test("malformed success is not treated as authenticated", async ({ page }) => {
  await page.route("**/api/auth/login", route => route.fulfill({ status: 200, body: "not-json" }));
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@example.com");
  await page.getByLabel("Contraseña").fill("fictional-password");
  await page.getByRole("button", { name: "Ingresar al portal" }).click();
  await expect(page.getByRole("alert")).toContainText("No se pudo confirmar el acceso");
  await expect(page).toHaveURL(/\/login$/);
});
