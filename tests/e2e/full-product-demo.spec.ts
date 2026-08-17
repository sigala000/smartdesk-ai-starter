import { expect, test } from "@playwright/test";

test.skip(
  !process.env.RECORD_DEMO,
  "Run only for an explicit product demo recording.",
);

test.describe.configure({ mode: "serial" });

test("complete SmartDesk customer and employee story", async ({ page }) => {
  test.setTimeout(150_000);
  async function pause(milliseconds = 650) {
    await page.waitForTimeout(milliseconds);
  }

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Your project request, clearly handled.",
    }),
  ).toBeVisible();
  await pause(1_200);
  await page.getByRole("link", { name: "Start a request" }).click();
  await expect(
    page.getByRole("heading", { name: "Virtual request assistant" }),
  ).toBeVisible();
  await pause();
  await page.getByRole("button", { name: "Request a quotation" }).click();
  await pause();
  await page.getByRole("button", { name: "House renovation" }).click();

  for (const answer of [
    "Demo Customer",
    "+237670000001",
    "yes",
    "Renovate a kitchen and repair the damaged walls.",
    "Bonamoussadi, Douala",
  ]) {
    await page.locator("#chat-answer").fill(answer);
    await pause(350);
    await page.getByRole("button", { name: "Send answer" }).click();
    await pause();
  }
  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: "Skip optional question" }).click();
    await pause();
  }
  await expect(
    page.getByRole("heading", { name: "Review your request" }),
  ).toBeVisible();
  await pause(1_200);
  await page.getByRole("button", { name: "Prepare confirmation" }).click();
  await pause();
  await page
    .getByRole("button", { name: "Confirm and submit request" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Request submitted" }),
  ).toBeVisible();
  const reference = (await page.getByText(/^BP-\d{4}-\d{6}$/).textContent())!;
  await pause(1_500);

  await page.goto("/status");
  await expect(
    page.getByRole("heading", { name: "Check request status" }),
  ).toBeVisible();
  await page.locator("#reference").fill(reference);
  await page.locator("#phone").fill("+237670000001");
  await page.getByRole("button", { name: "Send verification code" }).click();
  const developmentCode = await page
    .locator(".notice-panel strong")
    .textContent();
  await page.locator("#code").fill(developmentCode!);
  await page.getByRole("button", { name: "Verify and view status" }).click();
  await expect(page.getByText(reference)).toBeVisible();
  await pause(1_500);

  await page.goto("/login");
  await page.locator("#email").fill("admin@buildpro.local");
  await page.locator("#password").fill("BuildPro-local-demo-42!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await pause(1_000);
  await page.getByRole("link", { name: "Requests", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Requests" })).toBeVisible();
  await expect(page.getByRole("link", { name: reference })).toBeVisible();
  await pause(1_200);
  await page.getByRole("link", { name: reference }).click();
  await expect(page.getByText("Demo Customer")).toBeVisible();
  await expect(page.getByText("Bonamoussadi, Douala").first()).toBeVisible();
  await page
    .getByLabel("Employee-only note")
    .fill("Customer request reviewed during the product demo.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await pause();

  await page.getByRole("link", { name: "Human handoffs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Human handoff queue" }),
  ).toBeVisible();
  await pause();
  await page.getByRole("link", { name: "Organization", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "BuildPro Cameroon" }),
  ).toBeVisible();
  await pause();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByText("You have signed out securely.")).toBeVisible();
  await pause(1_200);
});

test("human handoff is accepted, answered and resolved", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/chat/buildpro-cameroon");
  await expect(
    page.getByRole("heading", { name: "Virtual request assistant" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Speak with an employee" }).click();
  await expect(
    page.getByRole("heading", { name: "Human support requested" }),
  ).toBeVisible();
  const conversationUrl = page.url();

  await page.goto("/login");
  await page.locator("#email").fill("admin@buildpro.local");
  await page.locator("#password").fill("BuildPro-local-demo-42!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/dashboard/handoffs?status=open");
  await page.getByRole("link", { name: "Open handoff" }).first().click();
  await page.getByRole("button", { name: "Assign" }).click();
  await page
    .getByRole("button", { name: "Accept and join conversation" })
    .click();
  await page
    .getByLabel("Reply to customer")
    .fill("Hello, a BuildPro employee is now here to help you.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(
    page.getByText("Hello, a BuildPro employee is now here to help you."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resolve and resume assistant" })
    .click();

  await page.goto(conversationUrl);
  await expect(
    page.getByText("Hello, a BuildPro employee is now here to help you."),
  ).toBeVisible();
});
