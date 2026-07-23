from __future__ import annotations

import json
import unittest
from fractions import Fraction

from sympy import symbols

from app import app, parse_general_eq
from rational_search import (
    build_exact_rational_plan,
    point_is_integral,
    rational_roots,
    reduced_rationals,
)


n, x, y = symbols("n x y")

LARGE_SQUARE = (
    "(46376906012745923409840343791188227450686*n + "
    "2486598372481845396683104279916570951657*x + "
    "46620984167454969979069506324857826890656)^2"
)
LARGE_NUMERATOR = (
    "16624709489189407440388643213728981685328681791089732876601710038587810847889998299944067715532425036389785803066750571476*n^3 + "
    "49481117808109917372654153079508763668111544754357197384070641920072789816863012403689690888343605217704925500637542381680*n^2 + "
    "49091204092562086792376670895376907696653809047079935546700717754945371359211889852498465756993689409319452027811965860800*n + "
    "16234787638949931054338904909272730014525041302296577490759268200927073136776735826378161845204226655836573767036816415981"
)
LARGE_DENOMINATOR = (
    "2486598372481845396683104279916570951657*x + "
    "609530524018264138310326718615033307496"
)
LARGE_RATIONAL_EQUATION = (
    f"y^2 = {LARGE_SQUARE} + "
    f"({LARGE_NUMERATOR})/({LARGE_DENOMINATOR})"
)
LARGE_LATEX_NUMERATOR = LARGE_NUMERATOR.replace(
    "*n^3",
    r"\* n^{3}",
    1,
)
MIXED_LATEX_EQUATION = (
    f"y^2 = {LARGE_SQUARE} + "
    rf"\frac{{{LARGE_LATEX_NUMERATOR}}}{{{LARGE_DENOMINATOR}}}"
)


def read_sse(response) -> list[dict]:
    events: list[dict] = []
    for frame in response.get_data(as_text=True).split("\n\n"):
        for line in frame.splitlines():
            if line.startswith("data: "):
                events.append(json.loads(line.removeprefix("data: ")))
    return events


class ExactRationalCoreTests(unittest.TestCase):
    def test_height_enumeration_is_reduced_complete_and_unique(self):
        values = reduced_rationals(-1, 1, 3)
        self.assertIn(Fraction(-2, 3), values)
        self.assertIn(Fraction(1, 2), values)
        self.assertIn(Fraction(1), values)
        self.assertNotIn(Fraction(4, 3), values)
        self.assertEqual(len(values), len(set(values)))
        self.assertTrue(
            all(
                max(abs(value.numerator), value.denominator) <= 3
                for value in values
            )
        )

    def test_linear_solver_keeps_an_eighty_digit_coordinate_exact(self):
        huge = 10**80
        expression = 5 * y - huge * n - 7 * x - 1
        plan = build_exact_rational_plan(
            expression,
            (n, x, y),
            {n: (1, 1), x: (0, 0), y: (-1, 1)},
            2,
        )
        assignment = next(plan.assignments())
        roots, infinite = plan.roots_for(assignment)
        self.assertEqual(plan.solve_variable, y)
        self.assertFalse(infinite)
        self.assertEqual(roots, [Fraction(huge + 1, 5)])

    def test_quadratic_solver_returns_only_exact_rational_roots(self):
        roots, infinite = rational_roots(
            [Fraction(6), Fraction(-5), Fraction(1)],
            y,
        )
        self.assertFalse(infinite)
        self.assertEqual(roots, [Fraction(1, 3), Fraction(1, 2)])

    def test_fractional_coefficients_never_pass_through_floats(self):
        expression = y - x / 3 - n
        plan = build_exact_rational_plan(
            expression,
            (n, x, y),
            {n: (0, 0), x: (0, 1), y: (0, 1)},
            2,
        )
        roots, infinite = plan.roots_for({n: Fraction(0), x: Fraction(1, 2)})
        self.assertFalse(infinite)
        self.assertEqual(roots, [Fraction(1, 6)])
        self.assertTrue(
            plan.verifies(
                {n: Fraction(0), x: Fraction(1, 2), y: Fraction(1, 6)}
            )
        )

    def test_rational_denominator_is_cleared_but_its_pole_is_excluded(self):
        expression = y - x - 1 / (n + 1)
        plan = build_exact_rational_plan(
            expression,
            (n, x, y),
            {n: (-1, 1), x: (-1, 1), y: (-1, 2)},
            2,
        )
        self.assertTrue(plan.has_variable_denominator)
        self.assertTrue(
            plan.verifies(
                {n: Fraction(0), x: Fraction(1, 2), y: Fraction(3, 2)}
            )
        )
        self.assertFalse(
            plan.verifies(
                {n: Fraction(-1), x: Fraction(0), y: Fraction(0)}
            )
        )

    def test_adaptive_plan_prefers_the_lower_degree_coordinate(self):
        expression = n + x**4 + y**3 - 7
        plan = build_exact_rational_plan(
            expression,
            (n, x, y),
            {n: (-2, 2), x: (-2, 2), y: (-2, 2)},
            3,
        )
        self.assertEqual(plan.solve_variable, n)
        self.assertEqual(plan.polynomial_degree, 1)

    def test_requested_projection_can_leave_x_unbounded(self):
        expression = n + x**4 + y**3 - 7
        plan = build_exact_rational_plan(
            expression,
            (n, x, y),
            {n: (-2, 2), x: (-2, 2), y: (-2, 2)},
            3,
            preferred_solve_variable=x,
            integral_priority_variable=y,
        )
        self.assertEqual(plan.solve_variable, x)
        y_values = plan.scan_values[plan.scan_variables.index(y)]
        first_noninteger = next(
            index
            for index, value in enumerate(y_values)
            if value.denominator != 1
        )
        self.assertTrue(
            all(value.denominator == 1 for value in y_values[:first_noninteger])
        )

    def test_integrality_accounts_for_all_three_coordinates(self):
        self.assertFalse(
            point_is_integral(
                {n: Fraction(1, 2), x: Fraction(2), y: Fraction(3)}
            )
        )


class ExactRationalEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_endpoint_finds_huge_non_integer_solution_without_y_bound(self):
        huge = 10**80
        response = self.client.get(
            "/api/diophantine",
            query_string={
                "eq": f"5*y = {huge}*n + 7*x + 1",
                "n_min": "1",
                "n_max": "1",
                "x_min": "0",
                "x_max": "0",
                "y_min": "-1",
                "y_max": "1",
                "point_type": "rational",
                "rational_height": "2",
                "solution_limit": "10",
            },
        )
        events = read_sse(response)
        start = next(event for event in events if event["type"] == "start")
        done = next(event for event in events if event["type"] == "done")
        solutions = [
            solution
            for event in events
            if event["type"] == "solutions"
            for solution in event["data"]
        ]

        self.assertEqual(start["strategy"], "exact_rational_roots")
        self.assertEqual(start["solve_variable"], "y")
        self.assertTrue(start["exact"])
        self.assertEqual(
            solutions,
            [{
                "n": "1",
                "x": "0",
                "y": f"{huge + 1}/5",
                "exact": True,
                "height_bound": 2,
                "projection": "y",
                "y_integral": False,
            }],
        )
        self.assertTrue(done["complete"])
        self.assertEqual(done["candidate_pairs_checked"], 1)

    def test_endpoint_enumerates_non_integer_scan_coordinates(self):
        response = self.client.get(
            "/api/diophantine",
            query_string={
                "eq": "y = n + x",
                "n_min": "0",
                "n_max": "0",
                "x_min": "0",
                "x_max": "1",
                "y_min": "0",
                "y_max": "1",
                "point_type": "rational",
                "rational_height": "2",
            },
        )
        events = read_sse(response)
        solutions = [
            solution
            for event in events
            if event["type"] == "solutions"
            for solution in event["data"]
        ]
        self.assertIn(
            {
                "n": "0",
                "x": "1/2",
                "y": "1/2",
                "exact": True,
                "height_bound": 2,
                "projection": "y",
                "y_integral": False,
            },
            solutions,
        )

    def test_deep_projection_finds_huge_x_with_integral_y(self):
        huge = 10**80
        response = self.client.get(
            "/api/diophantine",
            query_string={
                "eq": f"x = {huge}*n + y",
                "n_min": "1",
                "n_max": "1",
                "x_min": "-1",
                "x_max": "1",
                "y_min": "2",
                "y_max": "2",
                "point_type": "all",
                "projection_mode": "all",
                "prefer_integer_y": "1",
                "rational_height": "2",
                "solution_limit": "10",
            },
        )
        events = read_sse(response)
        start = next(event for event in events if event["type"] == "start")
        solutions = [
            solution
            for event in events
            if event["type"] == "solutions"
            for solution in event["data"]
        ]
        self.assertEqual(
            start["strategy"],
            "exact_rational_projection_sweep",
        )
        self.assertEqual(start["projection_variables"][0], "x")
        self.assertIn(
            {
                "n": "1",
                "x": str(huge + 2),
                "y": "2",
                "exact": True,
                "height_bound": 2,
                "projection": "x",
                "y_integral": True,
            },
            solutions,
        )

    def test_rational_mode_rejects_non_polynomial_equations_honestly(self):
        response = self.client.get(
            "/api/diophantine",
            query_string={
                "eq": "x**y = n",
                "point_type": "rational",
                "rational_height": "3",
            },
        )
        events = read_sse(response)
        error = next(event for event in events if event["type"] == "error")
        self.assertIn("polynomial or rational-polynomial", error["message"])

    def test_supplied_large_rational_equation_compiles_exactly(self):
        self.assertGreater(len(LARGE_RATIONAL_EQUATION), 400)
        response = self.client.get(
            "/api/diophantine",
            query_string={
                "eq": LARGE_RATIONAL_EQUATION,
                "n_min": "-1",
                "n_max": "1",
                "x_min": "-1",
                "x_max": "1",
                "y_min": "-1",
                "y_max": "1",
                "point_type": "all",
                "rational_height": "1",
                "solution_limit": "20",
            },
        )
        events = read_sse(response)
        start = next(event for event in events if event["type"] == "start")
        done = next(event for event in events if event["type"] == "done")
        self.assertEqual(start["solve_variable"], "y")
        self.assertEqual(start["polynomial_degree"], 2)
        self.assertTrue(start["rational_denominator"])
        self.assertIn("denominator pole is excluded", start["scope"])
        self.assertTrue(done["complete"])

    def test_supplied_mixed_latex_equation_runs_from_main_editor(self):
        parsed_mixed = parse_general_eq(MIXED_LATEX_EQUATION)
        parsed_python = parse_general_eq(LARGE_RATIONAL_EQUATION)
        self.assertEqual(parsed_mixed, parsed_python)
        self.assertEqual(
            parse_general_eq(
                MIXED_LATEX_EQUATION.replace("n", "k_1").replace("x", "k_2")
            ),
            parsed_python,
        )

        response = self.client.get(
            "/api/diophantine",
            query_string={
                "eq": MIXED_LATEX_EQUATION,
                "n_min": "-1",
                "n_max": "1",
                "x_min": "-1",
                "x_max": "1",
                "y_min": "-1",
                "y_max": "1",
                "point_type": "all",
                "rational_height": "1",
                "solution_limit": "20",
            },
        )
        events = read_sse(response)
        self.assertFalse(
            any(event["type"] == "error" for event in events),
            events,
        )
        start = next(event for event in events if event["type"] == "start")
        done = next(event for event in events if event["type"] == "done")
        self.assertTrue(start["rational_denominator"])
        self.assertTrue(done["complete"])

    def test_malformed_latex_fraction_returns_a_targeted_error(self):
        response = self.client.get(
            "/api/diophantine",
            query_string={
                "eq": r"y = \frac{1}{x + 1",
                "point_type": "all",
                "rational_height": "1",
            },
        )
        events = read_sse(response)
        error = next(event for event in events if event["type"] == "error")
        self.assertIn("unclosed", error["message"])


if __name__ == "__main__":
    unittest.main()
