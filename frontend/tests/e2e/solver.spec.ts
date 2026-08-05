import { expect, test } from "@playwright/test";

const exactMap = {
  family: "eqref_1_71_mordell_weil_fibration",
  forward: "X=-2*x; Y=y",
  inverse: "x=-X/2; y=Y",
  weierstrass_equation:
    "Y^2=X^3+36*n^2*X^2+12*n*(36*n^3-19)*X+(36*n^3-19)^2",
  torsion_section: "T=(0,36*n^3-19), with 3*T=O",
  discriminant: "-432*(4*n^3-19)*(36*n^3-19)^3",
  condition: "(4*n^3-19)*(36*n^3-19) != 0",
  scope: "Exact on every fixed rational n fiber in the bounded family search.",
  source: "https://github.com/JAgbanwa/heading-somewhere-with-this",
};

test("EXACT MAP opens the verified forward and inverse formulas", async ({
  page,
}) => {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/diophantine") {
      const events = [
        {
          type: "start",
          n_count: 54,
          scope: "Recognized eqref{1.71} bounded family scope.",
          curve_classification: {
            equation_kind: "eqref_1_71_elliptic_fibration",
            genus: 1,
            exact_birational_model: exactMap,
          },
        },
        {
          type: "solutions",
          data: [{ n: "15", x: "-29087/2", y: "5666832" }],
        },
        {
          type: "done",
          complete: true,
          bounded_family_scope: true,
          global_complete: false,
          total_solutions: 1,
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""),
      });
      return;
    }
    if (path === "/api/latex") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, latex: "x^3-n^2x" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: false }),
    });
  });

  await page.goto("/app");
  await page.getByRole("button", { name: "General Diophantine" }).click();
  await page.getByRole("button", { name: /Run Search/ }).click();

  const mapButton = page.getByRole("button", {
    name: "View exact birational map",
  });
  await expect(mapButton).toBeVisible();
  await expect(mapButton).toHaveAttribute("aria-expanded", "false");
  await expect(mapButton).toHaveAccessibleName("View exact birational map");
  await expect
    .poll(async () => (await mapButton.boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(36);
  await mapButton.click();

  await expect(mapButton).toHaveAttribute("aria-expanded", "true");
  await expect(mapButton).toHaveAccessibleName("View exact birational map");
  const panel = page.getByRole("region", { name: "Exact birational map" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("X=-2*x; Y=y", { exact: true })).toBeVisible();
  await expect(panel.getByText("x=-X/2; y=Y", { exact: true })).toBeVisible();
  await expect(
    panel.getByText("T=(0,36*n^3-19), with 3*T=O", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Close exact map" }).click();
  await expect(panel).toBeHidden();
});
