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

const constrainedExactMap = {
  family: "denominator_constrained_affine_integer_fibration",
  forward: "U=y-t; V=2*t+6*q; W=-t-y",
  inverse: "q=(U+V+W)/6; t=-(U+W)/2; y=(U-W)/2",
  cube_target: 114,
  strategy: "bounded_integer_q_signed_divisor_exhaustion",
  scope: "Every integer q in [-1, 1] and every signed divisor on each fiber.",
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

test("constrained affine scan preserves exact scope in the URL and result", async ({
  page,
}) => {
  let searchRequestURL = "";
  await page.route("**/api/**", async route => {
    const requestURL = new URL(route.request().url());
    if (requestURL.pathname === "/api/diophantine") {
      searchRequestURL = requestURL.toString();
      const constraints = {
        n_denominator_divides:
          "530878111278190578569461343171512713543344067216437472524439",
        x_denominator_divides:
          "353918740852127052379640895447675142362229378144291648349626",
        require_nonintegral_n: true,
        require_nonintegral_x: true,
        require_integral_y: true,
        require_nonzero_y: true,
        require_distinct_n_x: true,
      };
      const scope = constrainedExactMap.scope;
      const events = [
        {
          type: "start",
          n_count: 3,
          scope,
          constrained_search: true,
          constraints,
          normalized_q_min: "-1",
          normalized_q_max: "1",
          factor_limit: 100000,
          exact_map: constrainedExactMap,
          curve_classification: {
            equation_kind: "denominator_constrained_affine_integer_fibration",
            genus: 1,
            exact_birational_model: constrainedExactMap,
          },
        },
        {
          type: "done",
          complete: true,
          scope,
          bounded_q_complete: true,
          computational_scope_complete: true,
          proof_grade_complete: true,
          factorization_complete: true,
          factorization_proof_grade: true,
          divisor_enumeration_complete: true,
          incomplete_factorizations: 0,
          incomplete_divisor_enumerations: 0,
          locally_obstructed_fibers: 2,
          divisor_candidates_checked: 12,
          normalized_q_min: "-1",
          normalized_q_max: "1",
          constraints,
          total_solutions: 0,
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
    if (requestURL.pathname === "/api/latex") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, latex: "y^2=(t+6q)^2+(36q^3+114)/t" }),
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
  const constrainedToggle = page.getByRole("checkbox", {
    name: "Enable constrained affine divisor scan",
  });
  await constrainedToggle.check();
  await expect(page.getByLabel("Normalized q min")).toHaveValue("-1000");
  await expect(page.getByLabel("Normalized q max")).toHaveValue("1000");
  await page.getByLabel("Normalized q min").fill("-1");
  await page.getByLabel("Normalized q max").fill("1");
  await page.getByLabel("Factor effort").fill("100000");
  await page.getByRole("button", { name: /Run Search/ }).click();

  await expect.poll(() => searchRequestURL).not.toBe("");
  const requestParams = new URL(searchRequestURL).searchParams;
  expect(requestParams.get("constrained_search")).toBe("1");
  expect(requestParams.get("n_denominator_divisor")).toBe(
    "530878111278190578569461343171512713543344067216437472524439",
  );
  expect(requestParams.get("x_denominator_divisor")).toBe(
    "353918740852127052379640895447675142362229378144291648349626",
  );
  expect(requestParams.get("normalized_q_min")).toBe("-1");
  expect(requestParams.get("normalized_q_max")).toBe("1");
  expect(requestParams.get("factor_limit")).toBe("100000");
  for (const key of [
    "require_nonintegral_n",
    "require_nonintegral_x",
    "require_integral_y",
    "require_nonzero_y",
    "require_distinct_n_x",
  ]) {
    expect(requestParams.get(key)).toBe("1");
  }

  const pageParams = new URL(page.url()).searchParams;
  expect(pageParams.get("mode")).toBe("gen");
  expect(pageParams.get("constrained_search")).toBe("1");
  expect(pageParams.get("normalized_q_min")).toBe("-1");
  expect(pageParams.get("normalized_q_max")).toBe("1");

  const status = page.getByRole("region", {
    name: "Constrained finite search status",
  });
  await expect(status).toBeVisible();
  await expect(status.getByText("Exact numerator-lattice scan")).toBeVisible();
  await expect(status.getByText("PROOF-GRADE COMPLETE")).toBeVisible();
  await expect(status.getByText("[-1, 1]", { exact: true })).toBeVisible();
  await expect(
    status.getByText(
      "Every q in the displayed range has proof-grade factorization and complete divisor enumeration.",
    ),
  ).toBeVisible();

  const mapButton = page.getByRole("button", {
    name: "View exact birational map",
  });
  await mapButton.click();
  const panel = page.getByRole("region", { name: "Exact birational map" });
  await expect(panel.getByText(constrainedExactMap.forward, { exact: true })).toBeVisible();
  await expect(panel.getByText("U³+V³+W³=114", { exact: true })).toBeVisible();
  await expect(panel.getByText("Global status", { exact: true })).toHaveCount(0);
  await expect(panel.getByRole("link")).toHaveCount(0);

  await page.reload();
  await expect(constrainedToggle).toBeChecked();
  await expect(page.getByLabel("Normalized q min")).toHaveValue("-1");
  await expect(page.getByLabel("Normalized q max")).toHaveValue("1");
  await expect(page.getByLabel("Factor effort")).toHaveValue("100000");
});

test("constrained scan loads an exact resume checkpoint without auto-submitting", async ({
  page,
}) => {
  let searchRequests = 0;
  const searchRequestURLs: string[] = [];
  await page.route("**/api/**", async route => {
    const requestURL = new URL(route.request().url());
    if (requestURL.pathname === "/api/diophantine") {
      searchRequests += 1;
      searchRequestURLs.push(requestURL.toString());
      const events = [
        {
          type: "start",
          n_count: 21,
          constrained_search: true,
          normalized_q_min: "-10",
          normalized_q_max: "10",
          factor_limit: 100000,
          constraints: {},
        },
        {
          type: "done",
          complete: false,
          stop_reason: "solution_limit",
          normalized_q_min: "-10",
          normalized_q_max: "10",
          resume_q: "4",
          completed_through_q: "3",
          checkpoint: {
            resume_q: "4",
            completed_through_q: "3",
            resumable: true,
            request_params: {
              normalized_q_min: "4",
              resume_q: "4",
              resume_divisor_cursor: "731",
              resume_solution_offset: "2",
            },
          },
          computational_scope_complete: false,
          proof_grade_complete: false,
          factorization_complete: true,
          factorization_proof_grade: true,
          divisor_enumeration_complete: true,
          divisor_candidates_checked: 24,
          total_solutions: 0,
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
    if (requestURL.pathname === "/api/latex") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, latex: "y^2=(t+6q)^2+(36q^3+114)/t" }),
      });
      return;
    }
    await route.fulfill({ status: 200, body: "{}" });
  });

  await page.goto("/app");
  await page.getByRole("button", { name: "General Diophantine" }).click();
  await page.getByRole("checkbox", {
    name: "Enable constrained affine divisor scan",
  }).check();
  await page.getByLabel("Normalized q min").fill("-10");
  await page.getByLabel("Normalized q max").fill("10");
  await page.getByRole("button", { name: /Run Search/ }).click();

  const status = page.getByRole("region", {
    name: "Constrained finite search status",
  });
  await expect(status.getByText("CHECKPOINT READY")).toBeVisible();
  await expect(status.getByText(/Completed through q = 3/)).toBeVisible();
  await status.getByRole("button", { name: "Load checkpoint" }).click();
  await expect(page.getByLabel("Normalized q min")).toHaveValue("4");
  await expect(
    page.getByText(
      "Checkpoint q = 4 loaded with its exact resume state. Run Search to continue.",
    ),
  ).toBeVisible();
  expect(searchRequests).toBe(1);

  await page.getByRole("button", { name: /Run Search/ }).click();
  await expect.poll(() => searchRequests).toBe(2);
  const resumedParams = new URL(searchRequestURLs[1]).searchParams;
  expect(resumedParams.get("normalized_q_min")).toBe("4");
  expect(resumedParams.get("resume_q")).toBe("4");
  expect(resumedParams.get("resume_divisor_cursor")).toBe("731");
  expect(resumedParams.get("resume_solution_offset")).toBe("2");
});

test("factor blocks, divisor cursors, and continuation segments remain distinct", async ({
  page,
}) => {
  let searchRequests = 0;
  const searchRequestURLs: string[] = [];
  await page.route("**/api/**", async route => {
    const requestURL = new URL(route.request().url());
    if (requestURL.pathname === "/api/diophantine") {
      searchRequests += 1;
      searchRequestURLs.push(requestURL.toString());
      const stopReason = searchRequests === 1
        ? "factorization_limit"
        : searchRequests === 2
          ? "divisor_limit"
          : "continuation_segment_complete";
      const factorBlocked = stopReason === "factorization_limit";
      const divisorCheckpoint = stopReason === "divisor_limit";
      const continuationComplete = stopReason === "continuation_segment_complete";
      const requiredAction = factorBlocked
        ? "Increase factor_limit above 100 and restart q=9 with divisor cursor 0."
        : null;
      const events = [
        {
          type: "start",
          n_count: 1,
          constrained_search: true,
          normalized_q_min: "9",
          normalized_q_max: "9",
          factor_limit: searchRequests === 1 ? 100 : 200,
          constraints: {},
        },
        {
          type: "done",
          complete: false,
          stop_reason: stopReason,
          normalized_q_min: "9",
          normalized_q_max: "9",
          factor_limit: searchRequests === 1 ? 100 : 200,
          resume_q: divisorCheckpoint ? "9" : null,
          blocked_q: factorBlocked ? "9" : null,
          required_action: requiredAction,
          completed_through_q: continuationComplete ? "9" : "8",
          checkpoint: {
            resume_q: divisorCheckpoint ? "9" : null,
            blocked_q: factorBlocked ? "9" : null,
            completed_through_q: continuationComplete ? "9" : "8",
            resumable: divisorCheckpoint,
            request_params: divisorCheckpoint ? {
              normalized_q_min: "9",
              normalized_q_max: "9",
              factor_limit: "200",
              resume_divisor_cursor: "731",
              resume_solution_offset: "0",
            } : {},
            required_action: requiredAction,
          },
          computational_scope_complete: false,
          proof_grade_complete: false,
          continuation_segment_complete: continuationComplete,
          continuation_segment_proof_grade: continuationComplete,
          prior_segment_required: continuationComplete,
          factorization_complete: stopReason !== "factorization_limit",
          factorization_proof_grade: continuationComplete,
          divisor_enumeration_complete: continuationComplete,
          incomplete_factorizations: stopReason === "factorization_limit" ? 1 : 0,
          incomplete_divisor_enumerations: stopReason === "divisor_limit" ? 1 : 0,
          divisor_candidates_checked: 10,
          total_solutions: 0,
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
    if (requestURL.pathname === "/api/latex") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, latex: "y^2=(t+6q)^2+(36q^3+114)/t" }),
      });
      return;
    }
    await route.fulfill({ status: 200, body: "{}" });
  });

  await page.goto("/app");
  await page.getByRole("button", { name: "General Diophantine" }).click();
  await page.getByRole("checkbox", {
    name: "Enable constrained affine divisor scan",
  }).check();
  await page.getByLabel("Normalized q min").fill("9");
  await page.getByLabel("Normalized q max").fill("9");
  await page.getByLabel("Factor effort").fill("100");
  await page.getByRole("button", { name: /Run Search/ }).click();

  const status = page.getByRole("region", {
    name: "Constrained finite search status",
  });
  await expect(status.getByText("ACTION REQUIRED")).toBeVisible();
  await expect(status.getByText(/Increase factor_limit above 100/)).toBeVisible();
  await expect(status.getByText(/blocked at q = 9/)).toBeVisible();
  await expect(status.getByRole("button", { name: "Load checkpoint" })).toHaveCount(0);

  await page.getByLabel("Factor effort").fill("200");
  await page.getByRole("button", { name: /Run Search/ }).click();
  await expect.poll(() => searchRequests).toBe(2);
  await expect(status.getByText("CHECKPOINT READY")).toBeVisible();
  await expect(status.getByText(/resume_divisor_cursor=731/)).toBeVisible();
  await status.getByRole("button", { name: "Load checkpoint" }).click();
  expect(searchRequests).toBe(2);

  await page.getByRole("button", { name: /Run Search/ }).click();
  await expect.poll(() => searchRequests).toBe(3);
  const resumedParams = new URL(searchRequestURLs[2]).searchParams;
  expect(resumedParams.get("normalized_q_min")).toBe("9");
  expect(resumedParams.get("resume_divisor_cursor")).toBe("731");
  expect(resumedParams.get("resume_solution_offset")).toBe("0");

  await expect(status.getByText("SEGMENT COMPLETE", { exact: true })).toBeVisible();
  await expect(
    status.getByText(/Combine it with the prior checkpoint segment/),
  ).toBeVisible();
  await expect(status.getByRole("button", { name: "Load checkpoint" })).toHaveCount(0);
  await expect(page.locator(".warning-banner")).toHaveCount(0);
  await expect(
    page.getByText("No additional rational solutions were found in this continuation segment."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Attempt rigorous proof/ })).toHaveCount(0);
});
