from __future__ import annotations

import json
import unittest
from fractions import Fraction

from sympy import symbols

from app import app, parse_general_eq
from eq171_family import (
    EQ171_CATALOG,
    EQ171_SOURCE_URL,
    catalog_is_exact,
    matches_eq171_family,
    search_eq171_family,
    verifies_eq171,
)


n, x, y = symbols("n x y")
EQ171 = "y**2 = (36*n**3 - 19 - 12*x*n)**2 - (2*x)**3"


def read_sse(response) -> list[dict]:
    events: list[dict] = []
    for frame in response.get_data(as_text=True).split("\n\n"):
        for line in frame.splitlines():
            if line.startswith("data: "):
                events.append(json.loads(line.removeprefix("data: ")))
    return events


class Eq171FamilyTests(unittest.TestCase):
    def test_catalog_contains_62_unique_exact_nontrivial_rows(self):
        self.assertEqual(len(EQ171_CATALOG), 62)
        self.assertEqual(len(set(EQ171_CATALOG)), 62)
        self.assertTrue(catalog_is_exact())
        self.assertTrue(all(m_value != 0 for _, m_value, _ in EQ171_CATALOG))

    def test_family_recognizer_accepts_either_equation_orientation(self):
        expression = parse_general_eq(EQ171)
        reversed_expression = parse_general_eq(
            "(36*n**3 - 19 - 12*x*n)**2 - (2*x)**3 = y**2"
        )
        self.assertTrue(matches_eq171_family(expression, n, x, y))
        self.assertTrue(
            matches_eq171_family(reversed_expression, n, x, y)
        )
        self.assertFalse(
            matches_eq171_family(
                parse_general_eq("y**2 = x**3 + n"),
                n,
                x,
                y,
            )
        )

    def test_seeded_lattice_finds_a_new_exact_rational_point(self):
        result = search_eq171_family(
            n_bounds=(15, 15),
            m_bounds=(-20_000, 20_000),
            coefficient_bound=1,
            point_type="all",
            skip_zero_n=False,
            skip_zero_m=False,
            result_limit=100,
        )
        new_points = [
            point
            for point in result.points
            if point.strategy == "eq171_mordell_weil_lattice"
        ]
        target = next(
            point
            for point in new_points
            if point.m == Fraction(-29_087, 2)
            and point.y == Fraction(5_666_832)
        )
        self.assertTrue(verifies_eq171(target.n, target.m, target.y))
        self.assertFalse(target.integral)
        self.assertEqual(target.torsion_multiple, 1)

    def test_api_replays_every_published_seed_with_wide_enough_m_bounds(self):
        with app.test_client() as client:
            response = client.get(
                "/api/diophantine",
                query_string={
                    "eq": EQ171,
                    "n_min": "-200000",
                    "n_max": "200000",
                    "x_min": "-6e12",
                    "x_max": "6e12",
                    "y_min": "-1",
                    "y_max": "1",
                    "point_type": "all",
                    "rational_height": "1",
                    "solution_limit": "124",
                    "projection_mode": "all",
                    "deep_engine": "off",
                },
            )
        events = read_sse(response)
        start = next(event for event in events if event["type"] == "start")
        engine = next(
            event
            for event in events
            if event["type"] == "engine"
            and event["strategy"] == "eq171_seeded_mordell_weil_lattice"
        )
        solutions = [
            solution
            for event in events
            if event["type"] == "solutions"
            for solution in event["data"]
        ]
        catalog_solutions = [
            solution
            for solution in solutions
            if solution["strategy"] == "eq171_verified_catalog"
        ]

        self.assertTrue(start["eq171_recognized"])
        self.assertEqual(start["eq171_catalog_rows"], 62)
        self.assertEqual(start["eq171_source"], EQ171_SOURCE_URL)
        self.assertEqual(engine["catalog_rows_in_bounds"], 62)
        self.assertEqual(len(catalog_solutions), 124)
        self.assertTrue(
            all(solution["source"] == EQ171_SOURCE_URL
                for solution in catalog_solutions)
        )
        self.assertIn(
            {
                "n": "167163",
                "x": "-33373801909",
                "y": "235738065125780169",
                "exact": True,
                "strategy": "eq171_verified_catalog",
                "projection": "eq171_mordell_weil",
                "source": EQ171_SOURCE_URL,
                "family_coordinate": "m=x",
                "y_integral": True,
            },
            catalog_solutions,
        )

    def test_plus_minus_1e11_box_returns_all_60_in_box_rows(self):
        result = search_eq171_family(
            n_bounds=(-10**11, 10**11),
            m_bounds=(-10**11, 10**11),
            coefficient_bound=0,
            point_type="all",
            skip_zero_n=False,
            skip_zero_m=False,
            result_limit=1_000,
        )
        self.assertEqual(result.catalog_rows_in_bounds, 60)
        self.assertEqual(len(result.points), 120)
        self.assertTrue(
            all(point.strategy == "eq171_verified_catalog"
                for point in result.points)
        )


if __name__ == "__main__":
    unittest.main()
