from __future__ import annotations

import json
import multiprocessing
import time
import unittest
from dataclasses import replace
from fractions import Fraction
from math import isqrt, prod
from unittest.mock import patch

from sympy import expand, sympify, symbols

from constrained_rational import (
    AffineIntegralDivisorPlan,
    ConstrainedRationalSearchError,
    RationalPointConstraints,
    affine_constraint_compatibility_error,
)
from rational_search import build_affine_normalized_square_plan


n, x, y = symbols("n x y")


def blocking_constrained_worker(_plan, send_connection):
    """Test worker that must be terminated by the SSE parent deadline."""
    try:
        time.sleep(5)
    finally:
        send_connection.close()


def one_fiber_then_block_worker(plan, send_connection):
    """Emit one complete bounded fiber, then simulate cumulative work."""
    try:
        fiber = next(plan.scan_fibers())
        send_connection.send((
            "fiber_start",
            {
                "fiber": replace(fiber, points=()),
                "point_count": len(fiber.points),
            },
        ))
        if fiber.points:
            send_connection.send((
                "fiber_points",
                {"q": fiber.q, "offset": 0, "points": fiber.points},
            ))
        send_connection.send((
            "fiber_end",
            {"q": fiber.q, "point_count": len(fiber.points)},
        ))
        time.sleep(5)
    finally:
        send_connection.close()

Q = 176959370426063526189820447723837571181114689072145824174813
B = 530878111278190578569461343171512713543344067216437472524439
K = 223812005206893026939939757344219979030523588763591004819297

SQUARE_N_SLOPE = (
    3185268667669143471416768059029076281260064403298624835146634
)
SQUARE_X_SLOPE = (
    353918740852127052379640895447675142362229378144291648349626
)
SQUARE_OFFSET = (
    1519831401667421687829458991789157445364256221653691853090595
)
CUBIC_COEFFICIENTS = (
    5386255598429912910239991074883103648061323608347515713067104506907275944285878462789841452986266125005845596825628779494465555970916820770687828281560445713580845857529504520594684,
    6812347168386504364564397888712133441306659545486542739467076752649122734543687696820388736586306024705642039157739295712828518798880977420816988175841637415790459974110929417082796,
    2872005922887105612204712888576895642803577224840059660525955764481773178812678494861246411912387442454262975294561586568820236883258414904154274451272523530538639364401666520125108,
    403601373467692408273995159382149494499487848483215368650586145686569090715672337841415767442159797280078496814999716951880794271356612614897783688494744701337220471456567329598609,
)

SUPPLIED_EQUATION = (
    "y^2 = ("
    f"{SQUARE_N_SLOPE}*n + {SQUARE_X_SLOPE}*x + {SQUARE_OFFSET}"
    ")^2 + ("
    f"{CUBIC_COEFFICIENTS[0]}*n^3 + "
    f"{CUBIC_COEFFICIENTS[1]}*n^2 + "
    f"{CUBIC_COEFFICIENTS[2]}*n + "
    f"{CUBIC_COEFFICIENTS[3]}"
    ") / ("
    f"{SQUARE_X_SLOPE}*x + {Q}"
    ")"
)

COMPACT_EQUIVALENT_EQUATION = (
    "y^2 = (2*x + 1 + 6*(3*n + 1))^2"
    " + (36*(3*n + 1)^3 - 19)/(2*x + 1)"
)

TOY_EQUATION = (
    "y^2 = (2*x + 1 + 6*(3*n + 1))^2"
    " + (36*(3*n + 1)^3 + 10)/(2*x + 1)"
)


def target_constraints() -> RationalPointConstraints:
    return RationalPointConstraints(
        n_denominator_divisor=B,
        x_denominator_divisor=2 * Q,
        require_nonintegral_n=True,
        require_nonintegral_x=True,
        require_integral_y=True,
        require_nonzero_y=True,
        require_distinct_n_x=True,
    )


def read_sse(response) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    for frame in response.get_data(as_text=True).split("\n\n"):
        for line in frame.splitlines():
            if line.startswith("data: "):
                events.append(json.loads(line.removeprefix("data: ")))
    return events


class SuppliedConstrainedSurfaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        left, right = SUPPLIED_EQUATION.replace("^", "**").split("=", 1)
        local_symbols = {"n": n, "x": x, "y": y}
        expression = (
            sympify(left, locals=local_symbols)
            - sympify(right, locals=local_symbols)
        )
        cls.surface = build_affine_normalized_square_plan(
            expression,
            n,
            x,
            y,
            {n: (-2, 2), x: (-2, 2)},
            12,
        )
        if cls.surface is None:
            raise AssertionError("The supplied affine surface was not detected.")

    def test_full_equation_collapses_to_the_exact_small_normal_form(self):
        surface = self.surface
        self.assertEqual(B, 3 * Q)
        self.assertEqual(SQUARE_N_SLOPE, 6 * B)
        self.assertEqual(SQUARE_X_SLOPE, 2 * Q)
        self.assertEqual(SQUARE_OFFSET, Q + 6 * K)
        self.assertEqual(surface.q_slope, Fraction(B))
        self.assertEqual(surface.q_offset, Fraction(K))
        self.assertEqual(surface.t_slope, Fraction(2 * Q))
        self.assertEqual(surface.t_offset, Fraction(Q))
        self.assertEqual(surface.residual, Fraction(-19))

        supplied_cubic = sum(
            coefficient * n**power
            for coefficient, power in zip(CUBIC_COEFFICIENTS, (3, 2, 1, 0))
        )
        self.assertEqual(
            expand(supplied_cubic - (36 * (B * n + K) ** 3 - 19)),
            0,
        )
        supplied_square_root = (
            SQUARE_N_SLOPE * n
            + SQUARE_X_SLOPE * x
            + SQUARE_OFFSET
        )
        self.assertEqual(
            expand(
                supplied_square_root
                - ((2 * Q * x + Q) + 6 * (B * n + K))
            ),
            0,
        )

    def test_denominator_divisibility_is_exactly_the_integer_q_t_lattice(self):
        n_examples = {
            K: Fraction(0),
            K + 1: Fraction(1, B),
            K + Q: Fraction(1, 3),
            K + 3: Fraction(1, Q),
            K + B: Fraction(1),
        }
        for q_value, expected_n in n_examples.items():
            n_value = Fraction(q_value - K, B)
            self.assertEqual(n_value, expected_n)
            self.assertEqual(B % n_value.denominator, 0)
            self.assertEqual(B * n_value + K, q_value)

        x_examples = {
            Q: Fraction(0),
            Q + 1: Fraction(1, 2 * Q),
            2 * Q: Fraction(1, 2),
            Q + 2: Fraction(1, Q),
            3 * Q: Fraction(1),
        }
        for t_value, expected_x in x_examples.items():
            x_value = Fraction(t_value - Q, 2 * Q)
            self.assertEqual(x_value, expected_x)
            self.assertEqual((2 * Q) % x_value.denominator, 0)
            self.assertEqual(2 * Q * x_value + Q, t_value)

        for denominator in (1, 3, Q, B):
            n_value = Fraction(1, denominator)
            self.assertEqual((B * n_value + K).denominator, 1)
        for denominator in (1, 2, Q, 2 * Q):
            x_value = Fraction(1, denominator)
            self.assertEqual((2 * Q * x_value + Q).denominator, 1)

        # Check both logical directions across many automatically reduced
        # fractions, including divisors and non-divisors of each slope.
        for numerator in range(-12, 13):
            for denominator in range(1, 41):
                n_value = Fraction(numerator, denominator)
                x_value = Fraction(numerator + 1, denominator)
                self.assertEqual(
                    B % n_value.denominator == 0,
                    (B * n_value + K).denominator == 1,
                )
                self.assertEqual(
                    (2 * Q) % x_value.denominator == 0,
                    (2 * Q * x_value + Q).denominator == 1,
                )

    def test_requested_coordinate_filters_use_reduced_exact_fractions(self):
        constraints = target_constraints()
        self.assertTrue(
            constraints.accepts(
                Fraction(1, B),
                Fraction(1, 2 * Q),
                Fraction(7),
            )
        )
        self.assertFalse(
            constraints.accepts(
                Fraction(1),
                Fraction(1, 2 * Q),
                Fraction(7),
            )
        )
        self.assertFalse(
            constraints.accepts(
                Fraction(1, B),
                Fraction(1, 2 * Q),
                Fraction(7, 2),
            )
        )
        self.assertFalse(
            constraints.accepts(
                Fraction(1, B),
                Fraction(1, 2 * Q),
                Fraction(0),
            )
        )
        self.assertFalse(
            constraints.accepts(
                Fraction(1, B),
                Fraction(1, B),
                Fraction(7),
            )
        )

    def test_cube_114_map_and_inverse_are_exact_symbolic_identities(self):
        q_symbol, t_symbol = symbols("q t", integer=True)
        cube_u = y - t_symbol
        cube_v = 2 * t_symbol + 6 * q_symbol
        cube_w = -t_symbol - y
        normalized_residual = (
            t_symbol * y**2
            - t_symbol * (t_symbol + 6 * q_symbol) ** 2
            - (36 * q_symbol**3 - 19)
        )
        self.assertEqual(
            expand(
                cube_u**3
                + cube_v**3
                + cube_w**3
                - 114
                + 6 * normalized_residual
            ),
            0,
        )
        self.assertEqual(expand((cube_u + cube_v + cube_w) / 6), q_symbol)
        self.assertEqual(expand(-(cube_u + cube_w) / 2), t_symbol)
        self.assertEqual(expand((cube_u - cube_w) / 2), y)

    def test_exact_map_reports_the_computational_reduction(self):
        plan = AffineIntegralDivisorPlan(
            surface=self.surface,
            constraints=target_constraints(),
            q_min=-12,
            q_max=12,
            factor_limit=0,
        )
        descriptor = plan.exact_map()
        self.assertEqual(plan.cube_target, 114)
        self.assertTrue(plan.is_sum114)
        self.assertEqual(descriptor["cube_target"], 114)
        self.assertEqual(
            descriptor["family"],
            "denominator_constrained_affine_cubic_surface",
        )
        self.assertIn("U=y-t", descriptor["forward"])
        self.assertIn("q=(U+V+W)/6", descriptor["inverse"])
        self.assertIn("Every integer q in [-12, 12]", descriptor["scope"])
        self.assertIn(
            "computational completion",
            descriptor["scope"],
        )
        self.assertNotIn("open_problem", descriptor)
        self.assertNotIn("source", descriptor)

    def test_signed_divisor_scan_is_complete_only_when_factorization_is_complete(self):
        exact_plan = AffineIntegralDivisorPlan(
            surface=self.surface,
            constraints=target_constraints(),
            q_min=-12,
            q_max=12,
            factor_limit=0,
        )
        scans = tuple(exact_plan.scan_fibers())
        self.assertEqual(len(scans), 25)
        self.assertTrue(all(scan.factorization_complete for scan in scans))
        self.assertFalse(any(scan.points for scan in scans))

        residue_rejected = next(scan for scan in scans if scan.q == 1)
        self.assertIsNotNone(residue_rejected.local_obstruction)
        self.assertEqual(residue_rejected.divisor_candidates_checked, 0)

        searched = next(scan for scan in scans if scan.q == 3)
        self.assertIsNone(searched.local_obstruction)
        self.assertEqual(searched.factorization, ((953, 1),))
        self.assertEqual(searched.divisor_candidates_checked, 1)

        limited_plan = AffineIntegralDivisorPlan(
            surface=self.surface,
            constraints=target_constraints(),
            q_min=9,
            q_max=9,
            factor_limit=2,
        )
        limited_scan = next(limited_plan.scan_fibers())
        self.assertFalse(limited_scan.factorization_complete)
        self.assertEqual(limited_scan.factorization, ((26225, 1),))
        self.assertIsNone(limited_scan.divisor_cursor_next)

        unsafe_resume = AffineIntegralDivisorPlan(
            surface=self.surface,
            constraints=target_constraints(),
            q_min=9,
            q_max=9,
            factor_limit=2,
            first_q_divisor_cursor=1,
        )
        with self.assertRaisesRegex(
            ConstrainedRationalSearchError,
            "Increase factor effort",
        ):
            next(unsafe_resume.scan_fibers())

    def test_toy_signed_divisor_scan_matches_an_independent_brute_force_oracle(self):
        left, right = TOY_EQUATION.replace("^", "**").split("=", 1)
        local_symbols = {"n": n, "x": x, "y": y}
        expression = (
            sympify(left, locals=local_symbols)
            - sympify(right, locals=local_symbols)
        )
        surface = build_affine_normalized_square_plan(
            expression,
            n,
            x,
            y,
            {n: (-2, 2), x: (-200, 200)},
            4,
        )
        self.assertIsNotNone(surface)
        assert surface is not None
        self.assertEqual(surface.q_slope, Fraction(3))
        self.assertEqual(surface.q_offset, Fraction(1))
        self.assertEqual(surface.t_slope, Fraction(2))
        self.assertEqual(surface.t_offset, Fraction(1))
        self.assertEqual(surface.residual, Fraction(10))

        constraints = RationalPointConstraints(
            n_denominator_divisor=3,
            x_denominator_divisor=2,
            require_nonintegral_n=True,
            require_nonintegral_x=True,
            require_integral_y=True,
            require_nonzero_y=True,
            require_distinct_n_x=True,
        )
        plan = AffineIntegralDivisorPlan(
            surface=surface,
            constraints=constraints,
            q_min=-2,
            q_max=2,
            factor_limit=0,
        )
        observed = {
            (point.q, point.t, point.n, point.x, point.y)
            for fiber in plan.scan_fibers()
            for point in fiber.points
        }

        expected: set[
            tuple[int, int, Fraction, Fraction, Fraction]
        ] = set()
        for q_value in range(-2, 3):
            remainder = 36 * q_value**3 + 10
            for t_value in range(-abs(remainder), abs(remainder) + 1):
                if t_value == 0 or remainder % t_value:
                    continue
                square = (
                    (t_value + 6 * q_value) ** 2
                    + remainder // t_value
                )
                if square < 0:
                    continue
                y_root = isqrt(square)
                if y_root * y_root != square:
                    continue
                y_values = (y_root,) if y_root == 0 else (y_root, -y_root)
                for y_value in y_values:
                    n_value = Fraction(q_value - 1, 3)
                    x_value = Fraction(t_value - 1, 2)
                    y_exact = Fraction(y_value)
                    if constraints.accepts(n_value, x_value, y_exact):
                        expected.add((
                            q_value,
                            t_value,
                            n_value,
                            x_value,
                            y_exact,
                        ))

        self.assertEqual(observed, expected)
        self.assertIn(
            (0, 2, Fraction(-1, 3), Fraction(1, 2), Fraction(3)),
            observed,
        )
        self.assertIn(
            (0, 2, Fraction(-1, 3), Fraction(1, 2), Fraction(-3)),
            observed,
        )

    def test_positive_divisor_cursor_resumes_without_duplicate_candidates(self):
        left, right = TOY_EQUATION.replace("^", "**").split("=", 1)
        expression = (
            sympify(left, locals={"n": n, "x": x, "y": y})
            - sympify(right, locals={"n": n, "x": x, "y": y})
        )
        surface = build_affine_normalized_square_plan(
            expression,
            n,
            x,
            y,
            {n: (-2, 2), x: (-20, 20)},
            4,
        )
        self.assertIsNotNone(surface)
        assert surface is not None
        constraints = RationalPointConstraints(
            n_denominator_divisor=3,
            x_denominator_divisor=2,
            require_integral_y=True,
        )
        full = next(AffineIntegralDivisorPlan(
            surface=surface,
            constraints=constraints,
            q_min=0,
            q_max=0,
            factor_limit=0,
        ).scan_fibers())
        first = next(AffineIntegralDivisorPlan(
            surface=surface,
            constraints=constraints,
            q_min=0,
            q_max=0,
            factor_limit=0,
            max_positive_divisors=2,
        ).scan_fibers())
        self.assertEqual(first.divisor_cursor_start, 0)
        self.assertEqual(first.divisor_cursor_next, 2)
        self.assertFalse(first.divisor_enumeration_complete)

        second = next(AffineIntegralDivisorPlan(
            surface=surface,
            constraints=constraints,
            q_min=0,
            q_max=0,
            factor_limit=0,
            max_positive_divisors=2,
            first_q_divisor_cursor=first.divisor_cursor_next,
        ).scan_fibers())
        self.assertEqual(second.divisor_cursor_start, 2)
        self.assertIsNone(second.divisor_cursor_next)
        self.assertTrue(second.divisor_enumeration_complete)
        self.assertEqual(first.positive_divisor_count, 4)
        self.assertEqual(second.positive_divisor_count, 4)
        self.assertEqual(
            first.divisor_candidates_checked
            + second.divisor_candidates_checked,
            full.divisor_candidates_checked,
        )
        first_points = {
            (point.t, point.y) for point in first.points
        }
        second_points = {
            (point.t, point.y) for point in second.points
        }
        full_points = {(point.t, point.y) for point in full.points}
        self.assertFalse(first_points & second_points)
        self.assertEqual(first_points | second_points, full_points)

    def test_large_divisor_cursor_uses_direct_mixed_radix_resume(self):
        import app as app_module

        primes = (
            2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37,
            41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83,
        )
        remainder = prod(primes)
        self.assertEqual(2 ** len(primes), 8_388_608)
        cursor = 5_200_001
        equation = (
            "y^2=(2*x+1+6*(3*n+1))^2+"
            f"(36*(3*n+1)^3+{remainder})/(2*x+1)"
        )
        query = {
            "eq": equation,
            "point_type": "all",
            "constrained_search": "1",
            "n_denominator_divisor": "3",
            "x_denominator_divisor": "2",
            "require_integral_y": "1",
            "factor_limit": "100000",
            "normalized_q_min": "0",
            "normalized_q_max": "0",
            "resume_divisor_cursor": str(cursor),
        }
        with (
            patch.object(app_module, "_MAX_WEB_POSITIVE_DIVISORS", 2),
            app_module.app.test_client() as client,
        ):
            events = read_sse(client.get(
                "/api/diophantine",
                query_string=query,
            ))
        self.assertFalse(any(event["type"] == "error" for event in events))
        done = next(event for event in events if event["type"] == "done")
        self.assertEqual(done["stop_reason"], "divisor_limit")
        self.assertTrue(done["checkpoint"]["resumable"])
        self.assertEqual(
            done["checkpoint"]["request_params"][
                "resume_divisor_cursor"
            ],
            str(cursor + 2),
        )

    def test_local_obstruction_filters_are_complete_residue_checks(self):
        checks = (
            (9, lambda q_value: q_value % 3 != 0),
            (5, lambda q_value: q_value == 2),
            (7, lambda q_value: q_value == 0),
        )
        for modulus, obstructed_q in checks:
            squares = {value * value % modulus for value in range(modulus)}
            for q_value in range(modulus):
                if not obstructed_q(q_value):
                    continue
                remainder = (36 * q_value**3 - 19) % modulus
                locally_soluble = False
                for t_value in range(modulus):
                    for quotient in range(modulus):
                        if t_value * quotient % modulus != remainder:
                            continue
                        square = (
                            (t_value + 6 * q_value) ** 2 + quotient
                        ) % modulus
                        locally_soluble |= square in squares
                self.assertFalse(
                    locally_soluble,
                    f"unexpected local point q={q_value} mod {modulus}",
                )

        squares_mod_12 = {value * value % 12 for value in range(12)}
        admissible_t_quotients = set()
        for q_value in range(12):
            remainder = (36 * q_value**3 - 19) % 12
            for t_value in range(12):
                for quotient in range(12):
                    if t_value * quotient % 12 != remainder:
                        continue
                    if (
                        (t_value + 6 * q_value) ** 2 + quotient
                    ) % 12 in squares_mod_12:
                        admissible_t_quotients.add((t_value, quotient))
        self.assertEqual(admissible_t_quotients, {(7, 11)})

    def test_incompatible_or_unbounded_requests_are_rejected_explicitly(self):
        constraints = target_constraints()
        wrong_divisor = RationalPointConstraints(
            n_denominator_divisor=B - 1,
            x_denominator_divisor=2 * Q,
            require_integral_y=True,
        )
        self.assertIn(
            "must equal the absolute q(n) slope",
            affine_constraint_compatibility_error(self.surface, wrong_divisor),
        )
        with self.assertRaisesRegex(
            ConstrainedRationalSearchError,
            "at most 2,000,001",
        ):
            AffineIntegralDivisorPlan(
                surface=self.surface,
                constraints=constraints,
                q_min=0,
                q_max=2_000_001,
            )

    def test_zero_remainder_fiber_is_rejected_as_an_infinite_family(self):
        equation = (
            "y^2=(2*x+1+6*(3*n+1))^2"
            "+(36*(3*n+1)^3-36)/(2*x+1)"
        )
        left, right = equation.replace("^", "**").split("=", 1)
        expression = sympify(left, locals={"n": n, "x": x, "y": y}) - (
            sympify(right, locals={"n": n, "x": x, "y": y})
        )
        surface = build_affine_normalized_square_plan(
            expression,
            n,
            x,
            y,
            {n: (-2, 2), x: (-2, 2)},
            4,
        )
        self.assertIsNotNone(surface)
        assert surface is not None
        constraints = RationalPointConstraints(
            n_denominator_divisor=3,
            x_denominator_divisor=2,
            require_integral_y=True,
        )
        with self.assertRaisesRegex(
            ConstrainedRationalSearchError,
            "infinitely many nonzero integer t values",
        ):
            AffineIntegralDivisorPlan(
                surface=surface,
                constraints=constraints,
                q_min=1,
                q_max=1,
            )

    def test_zero_remainder_fiber_skips_when_fixed_n_is_inadmissible(self):
        equation = (
            "y^2=(2*x+1+6*(3*n+1))^2"
            "+(36*(3*n+1)^3-36)/(2*x+1)"
        )
        left, right = equation.replace("^", "**").split("=", 1)
        expression = (
            sympify(left, locals={"n": n, "x": x, "y": y})
            - sympify(right, locals={"n": n, "x": x, "y": y})
        )
        surface = build_affine_normalized_square_plan(
            expression,
            n,
            x,
            y,
            {n: (-2, 2), x: (-2, 2)},
            4,
        )
        self.assertIsNotNone(surface)
        assert surface is not None
        constraints = RationalPointConstraints(
            n_denominator_divisor=3,
            x_denominator_divisor=2,
            require_nonintegral_n=True,
            require_integral_y=True,
        )
        plan = AffineIntegralDivisorPlan(
            surface=surface,
            constraints=constraints,
            q_min=1,
            q_max=1,
        )
        scan = next(plan.scan_fibers())
        self.assertEqual(scan.q, 1)
        self.assertEqual(scan.points, ())
        self.assertTrue(scan.divisor_enumeration_complete)
        self.assertIn("fixed rational-point constraints", scan.local_obstruction)

        x_fixed_equation = (
            "y^2=(x+6*(3*n+1))^2+(36*(3*n+1)^3-36)/x"
        )
        left, right = x_fixed_equation.replace("^", "**").split("=", 1)
        expression = (
            sympify(left, locals={"n": n, "x": x, "y": y})
            - sympify(right, locals={"n": n, "x": x, "y": y})
        )
        x_fixed_surface = build_affine_normalized_square_plan(
            expression,
            n,
            x,
            y,
            {n: (-2, 2), x: (-2, 2)},
            4,
        )
        self.assertIsNotNone(x_fixed_surface)
        assert x_fixed_surface is not None
        x_fixed_constraints = RationalPointConstraints(
            n_denominator_divisor=3,
            x_denominator_divisor=1,
            require_nonintegral_x=True,
            require_integral_y=True,
        )
        x_fixed_plan = AffineIntegralDivisorPlan(
            surface=x_fixed_surface,
            constraints=x_fixed_constraints,
            q_min=1,
            q_max=1,
        )
        x_fixed_scan = next(x_fixed_plan.scan_fibers())
        self.assertEqual(x_fixed_scan.points, ())
        self.assertTrue(x_fixed_scan.divisor_enumeration_complete)

    def test_endpoint_zero_remainder_respects_skip_and_point_domain_filters(self):
        import app as app_module

        base = {
            "eq": (
                "y^2=(2*x+1+18*n)^2+36*(3*n)^3/(2*x+1)"
            ),
            "point_type": "all",
            "constrained_search": "1",
            "n_denominator_divisor": "3",
            "x_denominator_divisor": "2",
            "require_integral_y": "1",
            "factor_limit": "100",
            "normalized_q_min": "0",
            "normalized_q_max": "0",
            "skip_zero_n": "1",
        }
        with app_module.app.test_client() as client:
            events = read_sse(client.get(
                "/api/diophantine",
                query_string=base,
            ))
        self.assertFalse(any(event["type"] == "error" for event in events))
        done = next(event for event in events if event["type"] == "done")
        self.assertTrue(done["complete"])
        self.assertEqual(done["total_solutions"], 0)

        rational_only = dict(
            base,
            eq="y^2=(x+18*n)^2+36*(3*n)^3/x",
            point_type="rational",
            x_denominator_divisor="1",
            skip_zero_n="0",
        )
        with app_module.app.test_client() as client:
            events = read_sse(client.get(
                "/api/diophantine",
                query_string=rational_only,
            ))
        self.assertFalse(any(event["type"] == "error" for event in events))
        done = next(event for event in events if event["type"] == "done")
        self.assertTrue(done["complete"])
        self.assertEqual(done["total_solutions"], 0)

    def test_full_supplied_equation_runs_through_the_production_api(self):
        # Import lazily so the arithmetic unit tests remain independent of the
        # Flask application's startup work.
        from app import app

        with app.test_client() as client:
            response = client.get(
                "/api/diophantine",
                query_string={
                    "eq": SUPPLIED_EQUATION,
                    "n_min": "-2",
                    "n_max": "2",
                    "x_min": "-2",
                    "x_max": "2",
                    "y_min": "-100",
                    "y_max": "100",
                    "point_type": "all",
                    "rational_height": "2",
                    "solution_limit": "100",
                    "deep_engine": "off",
                    "constrained_search": "1",
                    "n_denominator_divisor": str(B),
                    "x_denominator_divisor": str(2 * Q),
                    "require_nonintegral_n": "1",
                    "require_nonintegral_x": "1",
                    "require_integral_y": "1",
                    "require_nonzero_y": "1",
                    "require_distinct_n_x": "1",
                    "normalized_q_min": "0",
                    "normalized_q_max": "0",
                    "factor_limit": "100000",
                },
            )

        events = read_sse(response)
        self.assertFalse(
            any(event["type"] == "error" for event in events),
            events,
        )
        start = next(event for event in events if event["type"] == "start")
        done = next(event for event in events if event["type"] == "done")

        self.assertFalse(any("open_problem" in event for event in events))
        self.assertTrue(start["constrained_search"])
        self.assertEqual(start["normalized_q_min"], "0")
        self.assertEqual(start["normalized_q_max"], "0")
        self.assertEqual(start["scan_start_q"], "0")
        self.assertEqual(start["requested_q_max"], "0")
        self.assertEqual(start["q_iteration_order"], "ascending_inclusive")
        self.assertEqual(
            start["constraints"]["n_denominator_divides"],
            str(B),
        )
        self.assertEqual(
            start["constraints"]["x_denominator_divides"],
            str(2 * Q),
        )
        self.assertEqual(start["cube_target"], 114)
        self.assertEqual(
            start["strategy"],
            "bounded_integer_q_signed_divisor_exhaustion",
        )
        self.assertEqual(start["exact_map"]["cube_target"], 114)

        self.assertTrue(done["complete"])
        self.assertTrue(done["bounded_q_complete"])
        self.assertTrue(done["factorization_complete"])
        self.assertTrue(done["proof_grade_complete"])
        self.assertEqual(done["candidate_pairs_checked"], 1)
        self.assertEqual(done["locally_obstructed_fibers"], 1)
        self.assertEqual(done["total_solutions"], 0)
        self.assertTrue(
            done["scan_certificate"]["all_signed_divisors_tested"]
        )
        self.assertIsNone(done["resume_q"])
        self.assertEqual(done["completed_through_q"], "0")
        self.assertEqual(done["requested_q_max"], "0")
        self.assertEqual(
            done["scan_certificate"]["q_interval"],
            ["0", "0"],
        )

    def test_api_incomplete_runs_return_inclusive_exact_checkpoints(self):
        import app as app_module

        base_query = {
            "eq": COMPACT_EQUIVALENT_EQUATION,
            "point_type": "all",
            "constrained_search": "1",
            "n_denominator_divisor": "3",
            "x_denominator_divisor": "2",
            "require_integral_y": "1",
            "factor_limit": "100",
        }

        timed_query = dict(
            base_query,
            normalized_q_min="0",
            normalized_q_max="0",
        )
        with (
            patch.object(app_module, "_SOFT_TIMEOUT", -1),
            app_module.app.test_client() as client,
        ):
            events = read_sse(client.get(
                "/api/diophantine",
                query_string=timed_query,
            ))
        timed_done = next(
            event for event in events if event["type"] == "done"
        )
        self.assertEqual(timed_done["stop_reason"], "time_limit")
        self.assertIsNone(timed_done["resume_q"])
        self.assertFalse(timed_done["checkpoint"]["resumable"])
        self.assertEqual(timed_done["blocked_q"], "0")
        self.assertEqual(timed_done["completed_through_q"], "-1")
        self.assertEqual(timed_done["requested_q_max"], "0")
        self.assertTrue(timed_done["checkpoint"]["resume_q_is_inclusive"])

        result_query = dict(
            base_query,
            eq=TOY_EQUATION,
            normalized_q_min="0",
            normalized_q_max="0",
            require_nonintegral_n="1",
            require_nonintegral_x="1",
            require_nonzero_y="1",
            solution_limit="1",
        )
        with app_module.app.test_client() as client:
            events = read_sse(client.get(
                "/api/diophantine",
                query_string=result_query,
            ))
        result_done = next(
            event for event in events if event["type"] == "done"
        )
        self.assertEqual(result_done["stop_reason"], "solution_limit")
        self.assertEqual(result_done["resume_q"], "0")
        self.assertEqual(result_done["completed_through_q"], "-1")
        self.assertTrue(result_done["checkpoint"]["resumable"])
        self.assertFalse(
            result_done["checkpoint"]["partial_fiber_may_repeat"]
        )
        result_params = result_done["checkpoint"]["request_params"]
        self.assertEqual(result_params["resume_divisor_cursor"], "0")
        self.assertEqual(result_params["resume_solution_offset"], "1")

        resumed_query = dict(result_query, **result_params)
        with app_module.app.test_client() as client:
            resumed_events = read_sse(client.get(
                "/api/diophantine",
                query_string=resumed_query,
            ))
        first_solution = next(
            event for event in events if event["type"] == "solutions"
        )["data"][0]
        resumed_solution = next(
            event
            for event in resumed_events
            if event["type"] == "solutions"
        )["data"][0]
        self.assertNotEqual(
            (first_solution["normalized_t"], first_solution["y"]),
            (resumed_solution["normalized_t"], resumed_solution["y"]),
        )
        resumed_done = next(
            event for event in resumed_events if event["type"] == "done"
        )
        self.assertEqual(
            resumed_done["checkpoint"]["request_params"][
                "resume_solution_offset"
            ],
            "2",
        )

        factor_query = dict(
            base_query,
            normalized_q_min="9",
            normalized_q_max="9",
            factor_limit="2",
        )
        with app_module.app.test_client() as client:
            events = read_sse(client.get(
                "/api/diophantine",
                query_string=factor_query,
            ))
        factor_done = next(
            event for event in events if event["type"] == "done"
        )
        self.assertEqual(factor_done["stop_reason"], "factorization_limit")
        self.assertIsNone(factor_done["resume_q"])
        self.assertFalse(factor_done["checkpoint"]["resumable"])
        self.assertEqual(factor_done["blocked_q"], "9")
        self.assertIn("Increase factor_limit", factor_done["required_action"])
        self.assertEqual(factor_done["completed_through_q"], "8")

        divisor_query = dict(
            base_query,
            normalized_q_min="3",
            normalized_q_max="3",
        )
        with (
            patch.object(app_module, "_MAX_WEB_POSITIVE_DIVISORS", 1),
            app_module.app.test_client() as client,
        ):
            events = read_sse(client.get(
                "/api/diophantine",
                query_string=divisor_query,
            ))
        divisor_done = next(
            event for event in events if event["type"] == "done"
        )
        self.assertEqual(divisor_done["stop_reason"], "divisor_limit")
        self.assertEqual(divisor_done["resume_q"], "3")
        self.assertEqual(divisor_done["completed_through_q"], "2")
        self.assertTrue(divisor_done["checkpoint"]["resumable"])
        self.assertEqual(
            divisor_done["checkpoint"]["request_params"][
                "resume_divisor_cursor"
            ],
            "1",
        )
        divisor_resume_query = dict(
            divisor_query,
            **divisor_done["checkpoint"]["request_params"],
        )
        with (
            patch.object(app_module, "_MAX_WEB_POSITIVE_DIVISORS", 1),
            app_module.app.test_client() as client,
        ):
            resumed_divisor_events = read_sse(client.get(
                "/api/diophantine",
                query_string=divisor_resume_query,
            ))
        resumed_divisor_done = next(
            event
            for event in resumed_divisor_events
            if event["type"] == "done"
        )
        self.assertFalse(resumed_divisor_done["complete"])
        self.assertFalse(
            resumed_divisor_done["computational_scope_complete"]
        )
        self.assertFalse(resumed_divisor_done["proof_grade_complete"])
        self.assertTrue(
            resumed_divisor_done["continuation_segment_complete"]
        )
        self.assertTrue(resumed_divisor_done["prior_segment_required"])
        self.assertFalse(
            resumed_divisor_done["scan_certificate"][
                "all_signed_divisors_tested"
            ]
        )

    def test_isolated_worker_heartbeats_and_is_reaped_at_fiber_deadline(self):
        import app as app_module

        query = {
            "eq": COMPACT_EQUIVALENT_EQUATION,
            "point_type": "all",
            "constrained_search": "1",
            "n_denominator_divisor": "3",
            "x_denominator_divisor": "2",
            "require_integral_y": "1",
            "factor_limit": "100",
            "normalized_q_min": "0",
            "normalized_q_max": "0",
        }
        before = {
            process.pid for process in multiprocessing.active_children()
        }
        with (
            patch.object(
                app_module,
                "_constrained_scan_worker",
                blocking_constrained_worker,
            ),
            patch.object(app_module, "_KEEPALIVE_SEC", 0.02),
            patch.object(app_module, "_SOFT_TIMEOUT", 0.12),
            app_module.app.test_client() as client,
        ):
            events = read_sse(client.get(
                "/api/diophantine",
                query_string=query,
            ))
        self.assertTrue(any(event["type"] == "heartbeat" for event in events))
        done = next(event for event in events if event["type"] == "done")
        self.assertEqual(done["stop_reason"], "fiber_time_limit")
        self.assertFalse(done["checkpoint"]["resumable"])
        self.assertEqual(done["blocked_q"], "0")
        time.sleep(0.05)
        leaked = [
            process
            for process in multiprocessing.active_children()
            if process.pid not in before
            and process.name == "diophantix-constrained-scan"
        ]
        self.assertEqual(leaked, [])

    def test_cumulative_deadline_returns_the_next_completed_q_checkpoint(self):
        import app as app_module

        query = {
            "eq": COMPACT_EQUIVALENT_EQUATION,
            "point_type": "all",
            "constrained_search": "1",
            "n_denominator_divisor": "3",
            "x_denominator_divisor": "2",
            "require_integral_y": "1",
            "factor_limit": "100",
            "normalized_q_min": "0",
            "normalized_q_max": "1",
        }
        with (
            patch.object(
                app_module,
                "_constrained_scan_worker",
                one_fiber_then_block_worker,
            ),
            patch.object(app_module, "_KEEPALIVE_SEC", 0.1),
            patch.object(app_module, "_SOFT_TIMEOUT", 2.0),
            patch.object(app_module, "_CONSTRAINED_FIBER_TIMEOUT", 5.0),
            app_module.app.test_client() as client,
        ):
            events = read_sse(client.get(
                "/api/diophantine",
                query_string=query,
            ))
        done = next(event for event in events if event["type"] == "done")
        self.assertEqual(done["stop_reason"], "time_limit")
        self.assertTrue(done["checkpoint"]["resumable"])
        self.assertEqual(done["resume_q"], "1")
        self.assertEqual(done["completed_through_q"], "0")
        self.assertEqual(
            done["checkpoint"]["request_params"][
                "resume_divisor_cursor"
            ],
            "0",
        )
        self.assertEqual(
            done["checkpoint"]["request_params"][
                "resume_solution_offset"
            ],
            "0",
        )

    def test_api_rejects_missing_scope_and_incompatible_lattice(self):
        from app import app

        base_query = {
            "eq": COMPACT_EQUIVALENT_EQUATION,
            "point_type": "all",
            "constrained_search": "1",
            "n_denominator_divisor": "3",
            "x_denominator_divisor": "2",
            "require_integral_y": "1",
            "normalized_q_min": "0",
            "normalized_q_max": "0",
        }
        for missing, label in (
            ("normalized_q_min", "normalized_q_min"),
            ("normalized_q_max", "normalized_q_max"),
        ):
            query = dict(base_query)
            query.pop(missing)
            with self.subTest(missing=missing), app.test_client() as client:
                events = read_sse(
                    client.get("/api/diophantine", query_string=query)
                )
            error = next(event for event in events if event["type"] == "error")
            self.assertIn(label, error["message"])

        incompatible = dict(base_query)
        incompatible["n_denominator_divisor"] = "4"
        with app.test_client() as client:
            events = read_sse(
                client.get("/api/diophantine", query_string=incompatible)
            )
        error = next(event for event in events if event["type"] == "error")
        self.assertIn("must equal the absolute q(n) slope", error["message"])


if __name__ == "__main__":
    unittest.main()
