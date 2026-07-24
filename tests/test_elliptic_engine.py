from __future__ import annotations

from fractions import Fraction
import shutil
import unittest
from unittest.mock import patch

from sympy import symbols

from app import app, parse_general_eq
from elliptic_engine import (
    EllipticPoint,
    WeierstrassCurve,
    native_mordell_weil_expansion,
)
from rational_search import (
    AffineBirationalSquarePlan,
    build_birational_square_plan,
)
from sage_bridge import (
    SageBridgeError,
    SageFiber,
    SageMathBridge,
)
from test_rational_search import MIXED_LATEX_EQUATION, read_sse


n, x, y = symbols("n x y")

GENERIC_BIRATIONAL_EQUATION = (
    "y^2 = (3*(2*x+n+1)+(5*n-2))^2"
    " + ((5*n-2)^3-(5*n-2))/(2*x+n+1)"
)
SPECIALIZED_SURFACE = (
    "y^2 = (2*x + 3 + 6*(5*n + 1))^2"
    " + (36*(5*n + 1)^3 - 19)/(2*x + 3)"
)


class BirationalAndEllipticCoreTests(unittest.TestCase):
    def test_generic_affine_birational_model_maps_back_exactly(self):
        expression = parse_general_eq(GENERIC_BIRATIONAL_EQUATION)
        plan = build_birational_square_plan(
            expression,
            n,
            x,
            y,
            {n: (-1, 1), x: (-1, 1), y: (-10, 10)},
            12,
        )
        self.assertIsInstance(plan, AffineBirationalSquarePlan)
        assert plan is not None
        self.assertEqual(plan.square_t_scale, Fraction(3))
        self.assertEqual(plan.t_n_slope, Fraction(1))
        self.assertEqual(plan.t_x_slope, Fraction(2))

        points = list(plan.points(prefer_integer_y=True))
        self.assertTrue(points)
        self.assertEqual(points[0][0][y].denominator, 1)
        target = next(
            point
            for point, hidden, t_value in points
            if hidden == 1 and t_value == 1 and point[y] == 4
        )
        self.assertEqual(target[n], Fraction(3, 5))
        self.assertEqual(target[x], Fraction(-3, 10))
        self.assertTrue(plan.verifies(target))

    def test_exact_group_law_generates_large_rational_multiples(self):
        curve = WeierstrassCurve(
            a2=Fraction(0),
            a4=Fraction(0),
            a6=Fraction(-2),
        )
        generator = EllipticPoint(Fraction(3), Fraction(5))
        doubled = curve.multiply(2, generator)
        self.assertEqual(
            doubled,
            EllipticPoint(Fraction(129, 100), Fraction(-383, 1000)),
        )
        self.assertTrue(curve.contains(doubled))

    def test_native_expansion_is_mapped_and_reverified(self):
        expression = parse_general_eq(SPECIALIZED_SURFACE)
        plan = build_birational_square_plan(
            expression,
            n,
            x,
            y,
            {n: (-10, 10), x: (-1000, 1000)},
            12,
        )
        self.assertIsNotNone(plan)
        assert plan is not None
        base_points = list(plan.points())
        generated = native_mordell_weil_expansion(
            plan,
            base_points,
            max_multiple=4,
            prefer_integer_y=True,
        )
        self.assertTrue(generated)
        self.assertTrue(all(plan.verifies(item.point) for item in generated))
        self.assertTrue(any(item.multiple >= 2 for item in generated))

    def test_sage_generator_point_on_supplied_equation_is_exact(self):
        expression = parse_general_eq(MIXED_LATEX_EQUATION)
        plan = build_birational_square_plan(
            expression,
            n,
            x,
            y,
            {n: (-10, 10), x: (-1000, 1000)},
            12,
        )
        self.assertIsNotNone(plan)
        assert plan is not None
        point = plan.point_from_values(
            Fraction(1),
            Fraction(17, 6),
            Fraction(55, 6),
        )
        self.assertIsNotNone(point)
        assert point is not None
        self.assertTrue(plan.verifies(point))
        self.assertGreater(
            max(
                abs(Fraction(17, 6).numerator),
                Fraction(17, 6).denominator,
            ),
            plan.height,
        )


class SageBridgeTests(unittest.TestCase):
    def test_missing_sage_is_an_explicit_safe_fallback(self):
        bridge = SageMathBridge(executable="/definitely/missing/sage")
        self.assertFalse(bridge.available)
        with self.assertRaisesRegex(SageBridgeError, "native exact"):
            bridge.search(
                [
                    SageFiber(
                        "missing",
                        Fraction(0),
                        Fraction(0),
                        Fraction(0),
                        Fraction(-2),
                    )
                ],
                max_multiple=2,
            )

    @unittest.skipUnless(shutil.which("sage"), "SageMath is not installed")
    def test_real_sage_descent_finds_a_rank_one_generator(self):
        bridge = SageMathBridge(timeout_seconds=30)
        report = bridge.search(
            [
                SageFiber(
                    "rank-one",
                    Fraction(0),
                    Fraction(0),
                    Fraction(0),
                    Fraction(-2),
                )
            ],
            max_multiple=2,
        )
        self.assertFalse(report.errors)
        self.assertTrue(
            any(
                candidate.x == 3 and abs(candidate.y) == 5
                for candidate in report.candidates
            )
        )


class DeepEngineEndpointTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()

    def test_capabilities_report_native_and_optional_sage_engines(self):
        response = self.client.get("/api/solver-capabilities")
        payload = response.get_json()
        self.assertTrue(payload["exact_rational"])
        self.assertTrue(payload["native_mordell_weil"])
        self.assertTrue(payload["birational_normalization"]["elliptic_fiber_map"])
        self.assertEqual(payload["sage"]["fallback"], "native_mordell_weil")

    def test_general_endpoint_streams_native_elliptic_expansion(self):
        response = self.client.get(
            "/api/diophantine",
            query_string={
                "eq": SPECIALIZED_SURFACE,
                "n_min": "-10",
                "n_max": "10",
                "x_min": "-1000",
                "x_max": "1000",
                "y_min": "-1000",
                "y_max": "1000",
                "point_type": "all",
                "rational_height": "12",
                "projection_mode": "adaptive",
                "solution_limit": "500",
                "deep_engine": "native",
                "descent_depth": "4",
                "prefer_integer_y": "1",
            },
        )
        events = read_sse(response)
        engine = next(event for event in events if event["type"] == "engine")
        self.assertIn("native_mordell_weil", engine["engines_used"])
        solutions = [
            solution
            for event in events
            if event["type"] == "solutions"
            for solution in event["data"]
        ]
        expanded = [
            solution
            for solution in solutions
            if solution.get("deep_engine") == "native_mordell_weil"
        ]
        self.assertTrue(expanded)
        self.assertTrue(all(solution["exact"] for solution in expanded))
        integral_y_prefix = [
            solution["y_integral"]
            for solution in solutions
            if "y_integral" in solution
        ]
        if False in integral_y_prefix:
            first_non_integral = integral_y_prefix.index(False)
            self.assertTrue(all(integral_y_prefix[:first_non_integral]))

    def test_endpoint_falls_back_when_sage_runtime_is_absent(self):
        with patch.dict(
            "os.environ",
            {"DIOPHANTIX_SAGE_EXECUTABLE": "/definitely/missing/sage"},
        ):
            response = self.client.get(
                "/api/search",
                query_string={
                    "expr": SPECIALIZED_SURFACE.split("=", 1)[1],
                    "n_min": "0",
                    "n_max": "0",
                    "x_min": "-10",
                    "x_max": "0",
                    "point_type": "all",
                    "x_denom_max": "12",
                    "deep_engine": "sage",
                    "descent_depth": "2",
                },
            )
            events = read_sse(response)
        engine = next(event for event in events if event["type"] == "engine")
        self.assertFalse(engine["sage_available"])
        self.assertIn("native_mordell_weil", engine["engines_used"])
        warnings = [
            event["message"]
            for event in events
            if event["type"] == "warning"
        ]
        self.assertTrue(any("unavailable" in warning for warning in warnings))


if __name__ == "__main__":
    unittest.main()
