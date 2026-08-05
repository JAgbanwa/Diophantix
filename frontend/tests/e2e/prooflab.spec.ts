import { expect, test } from "@playwright/test";

test("reviewed judge journey works without a model key", async ({ page }) => {
  await page.goto("/prooflab");
  await expect(page.getByRole("heading", { name: /Never confuse a search result/i })).toBeVisible();

  await page.getByRole("button", { name: /True identity/i }).click();
  const serviceStatus = page.locator(".prooflab-health strong");
  await expect(serviceStatus).toHaveText(/API key not configured|GPT-5.6 connected/);
  const runButton = (await serviceStatus.textContent())?.includes("not configured")
    ? page.getByRole("button", { name: /Run labeled offline replay/i })
    : page.getByRole("button", { name: /Analyze with GPT-5.6/i });
  await runButton.click();
  await expect(page.getByRole("heading", { name: "Proved", exact: true })).toBeVisible();
  await expect(page.getByText("Deterministic code decided this")).toBeVisible();

  await page.getByRole("button", { name: "Replay certificate" }).click();
  await expect(page.getByText(/Replay passed/i)).toBeVisible();

  await page.getByRole("button", { name: /Try to break this argument/i }).click();
  await expect(page.getByText(/Adversarial review/i)).toBeVisible();
  await expect(page.locator(".prooflab-check-list article").first()).toBeVisible();
});

test("all three reviewed examples produce their golden deterministic status", async ({ request }) => {
  const cases = [
    ["false-family", "DISPROVED"],
    ["true-identity", "PROVED"],
    ["modular-impossibility", "PROVED"],
  ] as const;
  for (const [demoId, expected] of cases) {
    const response = await request.post("/api/prooflab", { data: { mode: "offline_demo", demoId } });
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload.verification.status).toBe(expected);
    expect(payload.certificateReplay?.valid).toBe(true);
  }
});

test("unreachable API is reported distinctly from missing configuration", async ({ page }) => {
  await page.route("**/api/prooflab", (route) => route.abort());
  await page.goto("/prooflab");
  await expect(page.getByText("ProofLab endpoint unreachable")).toBeVisible();
  await expect(page.getByRole("button", { name: "ProofLab service unavailable" })).toBeDisabled();
});

test("educator mode records a prediction before revealing the exact verdict", async ({ page }) => {
  await page.goto("/prooflab?demo=false-family");
  await page.getByRole("button", { name: "Enter educator mode" }).click();
  const gatedRun = page.getByRole("button", { name: "Choose your prediction first" });
  await expect(gatedRun).toBeDisabled();

  await page.getByRole("button", { name: "Proved", exact: true }).click();
  const serviceStatus = page.locator(".prooflab-health strong");
  await expect(serviceStatus).toHaveText(/API key not configured|GPT-5.6 connected/);
  const runButton = (await serviceStatus.textContent())?.includes("not configured")
    ? page.getByRole("button", { name: /Run labeled offline replay/i })
    : page.getByRole("button", { name: /Analyze with GPT-5.6/i });
  await runButton.click();

  await expect(page.getByRole("heading", { name: "Disproved", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The exact evidence changed the classification." })).toBeVisible();
  await expect(page.getByText("Your recorded prediction: Proved.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Proved", exact: true })).toBeDisabled();
});
