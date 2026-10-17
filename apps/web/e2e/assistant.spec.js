import { expect, test } from "@playwright/test";
test("asks a grounded Hinglish question and confirms a reminder proposal", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".demo-pill").getByText("Synthetic demo", { exact: true })).toBeVisible();
  await expect(page.getByText(/TOTAL SPENDING/)).toBeVisible();
  const input = page.getByRole("textbox", { name: "Ask about your finances" });
  await input.fill("Mere expenses kitne hain is month?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/Is mahine aapka total kharch ₹/)).toBeVisible();
  await input.fill("Remind me before my next bill is due");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/I drafted that as a proposal/)).toBeVisible();
  await page.getByRole("button", { name: "Actions" }).click();
  const proposal = page.locator(".action-row").filter({ hasText: "Remind me before my next bill is due" }).first();
  await expect(proposal.getByText("AWAITING CONFIRMATION")).toBeVisible();
  await proposal.getByRole("button", { name: "Confirm" }).click();
  await expect(proposal.getByText("SUCCEEDED")).toBeVisible();
});
test("switches to actual previous-month synthetic analytics", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Analytics" }).click();
  const total = page.locator(".analytics-kpis .kpi b").first();
  const currentTotal = await total.textContent();
  await page.getByRole("button", { name: "Last month", exact: true }).click();
  await expect(total).not.toHaveText(currentTotal ?? "");
  await expect(page.locator(".page-heading .period-btn")).not.toHaveText(/This month/);
});
