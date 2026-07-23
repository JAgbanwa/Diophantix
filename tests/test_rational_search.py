from __future__ import annotations

import json
import unittest
from fractions import Fraction

from sympy import symbols

from app import app
from rational_search import (
    build_exact_rational_plan,
    point_is_integral,
    rational_roots,
    reduced_rationals,
)


n, x, y = symbols("n x y")


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
        self.assertIn("polynomial equations only", error["message"])


if __name__ == "__main__":
    unittest.main()
