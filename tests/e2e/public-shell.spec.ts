import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public entry point has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Your project request, clearly handled.",
    }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});

test("French entry is exposed and the mobile page does not overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Continuer en français" }),
  ).toHaveAttribute("href", /lang=fr/);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test("an unauthenticated employee cannot open the dashboard", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(
    /\/login\?status=session-required&next=%2Fdashboard/,
  );
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});

test("customer completes the deterministic quotation journey", async ({
  page,
}) => {
  await page.goto("/chat/buildpro-cameroon");
  await expect(
    page.getByRole("heading", { name: "Virtual request assistant" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Request a quotation" }).click();
  await page.getByRole("button", { name: "House renovation" }).click();

  const answers = [
    "Release Test Customer",
    "+237670000001",
    "yes",
    "Renovate the kitchen and repair damaged walls.",
    "Douala, Littoral",
  ];
  for (const answer of answers) {
    const input = page.locator("#chat-answer");
    await expect(input).toBeVisible();
    await input.fill(answer);
    await page.getByRole("button", { name: "Send answer" }).click();
  }

  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: "Skip optional question" }).click();
  }

  await expect(
    page.getByRole("heading", { name: "Review your request" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Prepare confirmation" }).click();
  await page
    .getByRole("button", { name: "Confirm and submit request" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Request submitted" }),
  ).toBeVisible();
  await expect(page.getByText(/^BP-\d{4}-\d{6}$/)).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});
