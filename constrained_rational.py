"""Exact denominator constraints and bounded affine-lattice searches.

The affine normalizer in :mod:`rational_search` recognizes equations of the
form

    y^2 = (t + 6*q)^2 + (36*q^3 + k) / t,

with invertible affine changes ``q=q(n)`` and ``t=t(x)``.  When requested
coordinate-denominator divisors agree with those affine slopes, the original
denominator conditions are *equivalent* to ``q,t`` being integers.  If ``y``
is also required to be integral, then ``t`` must divide ``36*q^3+k``.  This
module turns that observation into a finite signed-divisor search over an
explicit integer-q interval.  Computational completion and proof-grade
completion are tracked separately.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from fractions import Fraction
from math import isqrt, prod
from typing import Iterator

from sympy import factorint, integer_nthroot, isprime

from rational_search import AffineNormalizedSquarePlan


class ConstrainedRationalSearchError(ValueError):
    """Raised when an exact constraint or finite scope is invalid."""


@dataclass(frozen=True)
class SerializableAffineSurface:
    """Pickle-safe numeric surface used by isolated web workers.

    Production normalizers attach locally compiled verification callables to
    :class:`AffineNormalizedSquarePlan`; those closures cannot be sent through
    multiprocessing's safe ``spawn`` start method.  This compact surface keeps
    only the exact affine data and verifies the normalized identity.  The web
    parent independently substitutes every returned point into the original
    equation before streaming it.
    """

    q_slope: Fraction
    q_offset: Fraction
    t_slope: Fraction
    t_offset: Fraction
    residual: Fraction
    n_variable: object
    x_variable: object
    y_variable: object

    def verifies(self, point) -> bool:
        n_value = Fraction(point[self.n_variable])
        x_value = Fraction(point[self.x_variable])
        y_value = Fraction(point[self.y_variable])
        q_value = self.q_slope * n_value + self.q_offset
        t_value = self.t_slope * x_value + self.t_offset
        if t_value == 0:
            return False
        return (
            t_value * y_value**2
            == t_value * (t_value + 6 * q_value) ** 2
            + 36 * q_value**3
            + self.residual
        )


@dataclass(frozen=True)
class RationalPointConstraints:
    """Coordinate predicates checked with reduced :class:`Fraction` values."""

    n_denominator_divisor: int | None = None
    x_denominator_divisor: int | None = None
    require_nonintegral_n: bool = False
    require_nonintegral_x: bool = False
    require_integral_y: bool = False
    require_nonzero_y: bool = False
    require_distinct_n_x: bool = False
    exclude_zero_n: bool = False
    exclude_zero_x: bool = False
    point_type: str = "all"

    def __post_init__(self) -> None:
        for name, value in (
            ("n denominator divisor", self.n_denominator_divisor),
            ("x denominator divisor", self.x_denominator_divisor),
        ):
            if value is not None and value <= 0:
                raise ConstrainedRationalSearchError(
                    f"{name} must be a positive integer."
                )
        if self.point_type not in {"integer", "rational", "all"}:
            raise ConstrainedRationalSearchError(
                "Point type must be integer, rational, or all."
            )

    @property
    def enabled(self) -> bool:
        return any((
            self.n_denominator_divisor is not None,
            self.x_denominator_divisor is not None,
            self.require_nonintegral_n,
            self.require_nonintegral_x,
            self.require_integral_y,
            self.require_nonzero_y,
            self.require_distinct_n_x,
        ))

    def accepts(
        self,
        n_value: Fraction,
        x_value: Fraction,
        y_value: Fraction,
    ) -> bool:
        n_exact = Fraction(n_value)
        x_exact = Fraction(x_value)
        y_exact = Fraction(y_value)
        if (
            self.n_denominator_divisor is not None
            and self.n_denominator_divisor % n_exact.denominator != 0
        ):
            return False
        if (
            self.x_denominator_divisor is not None
            and self.x_denominator_divisor % x_exact.denominator != 0
        ):
            return False
        if self.require_nonintegral_n and n_exact.denominator == 1:
            return False
        if self.require_nonintegral_x and x_exact.denominator == 1:
            return False
        if self.require_integral_y and y_exact.denominator != 1:
            return False
        if self.require_nonzero_y and y_exact == 0:
            return False
        if self.require_distinct_n_x and n_exact == x_exact:
            return False
        if self.exclude_zero_n and n_exact == 0:
            return False
        if self.exclude_zero_x and x_exact == 0:
            return False
        all_integral = all(
            value.denominator == 1
            for value in (n_exact, x_exact, y_exact)
        )
        if self.point_type == "integer" and not all_integral:
            return False
        if self.point_type == "rational" and all_integral:
            return False
        return True

    def as_dict(self) -> dict[str, object]:
        return {
            "n_denominator_divides": (
                str(self.n_denominator_divisor)
                if self.n_denominator_divisor is not None
                else None
            ),
            "x_denominator_divides": (
                str(self.x_denominator_divisor)
                if self.x_denominator_divisor is not None
                else None
            ),
            "require_nonintegral_n": self.require_nonintegral_n,
            "require_nonintegral_x": self.require_nonintegral_x,
            "require_integral_y": self.require_integral_y,
            "require_nonzero_y": self.require_nonzero_y,
            "require_distinct_n_x": self.require_distinct_n_x,
            "exclude_zero_n": self.exclude_zero_n,
            "exclude_zero_x": self.exclude_zero_x,
            "point_type": self.point_type,
        }


@dataclass(frozen=True)
class ConstrainedAffinePoint:
    n: Fraction
    x: Fraction
    y: Fraction
    q: int
    t: int
    cube_u: int
    cube_v: int
    cube_w: int

    @property
    def cube_sum(self) -> int:
        return self.cube_u**3 + self.cube_v**3 + self.cube_w**3


@dataclass(frozen=True)
class AffineFiberScan:
    q: int
    points: tuple[ConstrainedAffinePoint, ...]
    divisor_candidates_checked: int
    factorization_complete: bool
    factorization_proof_grade: bool
    divisor_enumeration_complete: bool
    positive_divisor_count: int
    factorization: tuple[tuple[int, int], ...]
    local_obstruction: str | None = None
    divisor_cursor_start: int = 0
    divisor_cursor_next: int | None = None


def _positive_divisors_from_factors(
    factors: tuple[tuple[int, int], ...],
    start: int = 0,
    stop: int | None = None,
) -> Iterator[int]:
    """Yield a deterministic divisor-index slice in O(slice length) work.

    The mixed-radix order exactly matches ``itertools.product`` over ascending
    prime-power choices, but decodes each requested index directly.  A late
    resume cursor therefore does not regenerate millions of earlier divisors.
    """
    divisor_count = prod(exponent + 1 for _, exponent in factors)
    if start < 0 or start > divisor_count:
        raise ConstrainedRationalSearchError(
            "Positive-divisor cursor is outside the factorization's divisor range."
        )
    slice_stop = divisor_count if stop is None else min(stop, divisor_count)
    if slice_stop < start:
        raise ConstrainedRationalSearchError(
            "Positive-divisor slice stop precedes its cursor."
        )
    for divisor_index in range(start, slice_stop):
        remaining = divisor_index
        divisor = 1
        for base, exponent in reversed(factors):
            radix = exponent + 1
            power = remaining % radix
            remaining //= radix
            divisor *= base**power
        yield divisor


def _bounded_factorization(
    value: int,
    factor_limit: int,
) -> tuple[tuple[tuple[int, int], ...], bool, bool]:
    if value == 0:
        raise ConstrainedRationalSearchError(
            "The affine cubic remainder must be nonzero."
        )
    absolute = abs(value)
    if absolute == 1:
        return (), True, True
    kwargs = {} if factor_limit == 0 else {"limit": factor_limit}
    raw = factorint(absolute, **kwargs)
    factors = tuple(sorted(
        (int(base), int(exponent))
        for base, exponent in raw.items()
        if int(base) > 1 and int(exponent) > 0
    ))
    reconstructed = prod(base**exponent for base, exponent in factors)
    if reconstructed != absolute:
        raise ArithmeticError("Factorization did not reconstruct its input.")
    complete = all(bool(isprime(base)) for base, _ in factors)
    # SymPy's primality path is deterministic below 2^64.  Above that bound it
    # may rely on BPSW probable-prime evidence, which is excellent computation
    # but not a proof certificate.  Keep those statuses separate.
    proof_grade = complete and all(base < 2**64 for base, _ in factors)
    return factors, complete, proof_grade


def _sum114_local_obstruction(q_value: int) -> str | None:
    """Return a proved residue obstruction for the k=-19 surface."""
    if q_value % 3:
        return "q is not divisible by 3 (complete square-residue check mod 9)"
    if q_value % 5 == 2:
        return "q is 2 mod 5 (complete square-residue check mod 5)"
    if q_value % 7 == 0:
        return "q is 0 mod 7 (complete square-residue check mod 7)"
    return None


@dataclass(frozen=True)
class AffineIntegralDivisorPlan:
    """Complete signed-divisor search for every q in a finite interval."""

    surface: AffineNormalizedSquarePlan
    constraints: RationalPointConstraints
    q_min: int
    q_max: int
    factor_limit: int = 100_000
    max_positive_divisors: int = 1_000_000
    first_q_divisor_cursor: int = 0

    def serializable_worker_copy(self) -> "AffineIntegralDivisorPlan":
        """Return an equivalent plan without locally compiled closures."""
        worker_surface = SerializableAffineSurface(
            q_slope=self.surface.q_slope,
            q_offset=self.surface.q_offset,
            t_slope=self.surface.t_slope,
            t_offset=self.surface.t_offset,
            residual=self.surface.residual,
            n_variable=self.surface.n_variable,
            x_variable=self.surface.x_variable,
            y_variable=self.surface.y_variable,
        )
        return replace(self, surface=worker_surface)

    def __post_init__(self) -> None:
        if self.q_min > self.q_max:
            raise ConstrainedRationalSearchError(
                "Normalized q minimum exceeds q maximum."
            )
        if self.q_max - self.q_min + 1 > 2_000_001:
            raise ConstrainedRationalSearchError(
                "A constrained run may cover at most 2,000,001 consecutive "
                "integer q fibers. Split larger searches into adjacent runs."
            )
        if not 0 <= self.factor_limit <= 10_000_000:
            raise ConstrainedRationalSearchError(
                "Factor effort must be 0 (unlimited) or at most 10,000,000."
            )
        if not 1 <= self.max_positive_divisors <= 5_000_000:
            raise ConstrainedRationalSearchError(
                "Positive-divisor work limit must be between 1 and 5,000,000."
            )
        if self.first_q_divisor_cursor < 0:
            raise ConstrainedRationalSearchError(
                "The first-q positive-divisor cursor must be nonnegative."
            )
        error = affine_constraint_compatibility_error(
            self.surface,
            self.constraints,
        )
        if error is not None:
            raise ConstrainedRationalSearchError(error)
        target_cube = Fraction(-self.residual, 36)
        if target_cube.denominator == 1:
            absolute_root, exact_root = integer_nthroot(
                abs(target_cube.numerator),
                3,
            )
            if exact_root:
                zero_remainder_q = (
                    absolute_root
                    if target_cube.numerator >= 0
                    else -absolute_root
                )
                if (
                    self.q_min <= zero_remainder_q <= self.q_max
                    and self._zero_remainder_witness(zero_remainder_q)
                    is not None
                ):
                    raise ConstrainedRationalSearchError(
                        "The normalized q interval contains q="
                        f"{zero_remainder_q}, where 36*q^3+k=0. That fiber "
                        "has infinitely many nonzero integer t values and "
                        "cannot be represented by finite divisor exhaustion. "
                        "Split the interval around this q or analyze the "
                        "reported infinite family y=+/- (t+6*q) separately."
                    )

    def _zero_remainder_witness(
        self,
        q_value: int,
    ) -> tuple[int, int] | None:
        """Return one admissible ``(t, y)`` on a zero-remainder fiber.

        The fixed n value can make the whole fiber inadmissible.  Likewise,
        requiring nonintegral x is impossible when the affine t slope has
        absolute value one.  Once those fixed predicates pass, only finitely
        many t values can be removed by ``t != 0``, ``y != 0``, and ``n != x``;
        the short deterministic progression below therefore supplies a
        witness whenever an infinite admissible family remains.
        """
        n_value = (
            Fraction(q_value) - self.surface.q_offset
        ) / self.surface.q_slope
        t_slope = self.surface.t_slope.numerator
        t_offset = self.surface.t_offset.numerator
        force_integer_x = self.constraints.point_type == "integer"
        force_nonintegral_x = (
            self.constraints.require_nonintegral_x
            or (
                self.constraints.point_type == "rational"
                and n_value.denominator == 1
            )
        )
        if force_integer_x and force_nonintegral_x:
            return None
        if force_integer_x:
            t_seed = t_offset
            t_step = t_slope
        elif force_nonintegral_x:
            if abs(t_slope) == 1:
                return None
            t_seed = t_offset + 1
            t_step = t_slope
        else:
            t_seed = 1
            t_step = 1

        for index in range(8):
            t_value = t_seed + index * t_step
            if t_value == 0:
                continue
            x_value = (
                Fraction(t_value) - self.surface.t_offset
            ) / self.surface.t_slope
            y_value = t_value + 6 * q_value
            if self.constraints.accepts(
                n_value,
                x_value,
                Fraction(y_value),
            ):
                return t_value, y_value
        return None

    @property
    def candidate_count(self) -> int:
        return self.q_max - self.q_min + 1

    @property
    def residual(self) -> int:
        return self.surface.residual.numerator

    @property
    def cube_target(self) -> int:
        return -6 * self.residual

    @property
    def is_sum114(self) -> bool:
        return self.cube_target == 114

    def scope(self) -> str:
        effort = (
            "unlimited factor effort"
            if self.factor_limit == 0
            else f"factor effort {self.factor_limit:,}"
        )
        return (
            f"Every integer q in [{self.q_min}, {self.q_max}] is tested. "
            "For each fiber, every signed divisor t of 36*q^3+k exposed by "
            f"{effort} is square-tested and mapped back exactly; n, x, and y "
            "have no additional magnitude bound. A run is certified complete "
            "for this q interval only when every required factorization "
            "completed, every exposed divisor fit within the configured "
            f"{self.max_positive_divisors:,}-positive-divisor work limit, and "
            "no time or result limit stopped the scan. That is computational "
            "completion for the requested interval. Proof-grade completion is "
            "reported separately and requires deterministic primality evidence "
            "for every factor."
        )

    def exact_map(self) -> dict[str, object]:
        q_slope = self.surface.q_slope
        q_offset = self.surface.q_offset
        t_slope = self.surface.t_slope
        t_offset = self.surface.t_offset
        return {
            "family": "denominator_constrained_affine_cubic_surface",
            "degree": 3,
            "genus": 1,
            "geometry": "genus_one_fibration",
            "genus_applies_to": "generic nonsingular fixed-q fiber",
            "exact_birational_map": True,
            "forward": (
                f"q={q_slope}*n+{q_offset}; "
                f"t={t_slope}*x+{t_offset}; "
                "U=y-t; V=2*t+6*q; W=-t-y"
            ),
            "inverse": (
                f"n=(q-{q_offset})/{q_slope}; "
                f"x=(t-{t_offset})/{t_slope}; "
                "q=(U+V+W)/6; t=-(U+W)/2; y=(U-W)/2"
            ),
            "weierstrass_equation": (
                "Y^2=X^3+36*q^2*X^2+12*q*(36*q^3+k)*X"
                "+(36*q^3+k)^2, with X=(36*q^3+k)/t and Y=X*y"
            ),
            "cubic_discriminant": (
                "-27*(k+4*q^3)*(k+36*q^3)^3"
            ),
            "discriminant": (
                "-432*(k+4*q^3)*(k+36*q^3)^3"
            ),
            "condition": (
                "den(n) divides |dq/dn| and den(x) divides |dt/dx| "
                "iff q,t are integers for this affine map; t != 0 and "
                "(k+4*q^3)*(k+36*q^3) != 0 on a nonsingular elliptic fiber. "
                "The cube "
                "inverse additionally requires U+V+W divisible by 6 and "
                "U+W even (an admissible ordering always supplies the parity "
                "condition for a cube triple summing to an even target)."
            ),
            "strategy": "bounded_integer_q_signed_divisor_exhaustion",
            "scope": self.scope(),
            "cube_target": self.cube_target,
            "optional_identity": "U^3+V^3+W^3=cube_target",
        }

    def _point(
        self,
        q_value: int,
        t_value: int,
        y_value: int,
    ) -> ConstrainedAffinePoint | None:
        n_value = (
            Fraction(q_value) - self.surface.q_offset
        ) / self.surface.q_slope
        x_value = (
            Fraction(t_value) - self.surface.t_offset
        ) / self.surface.t_slope
        y_exact = Fraction(y_value)
        if not self.constraints.accepts(n_value, x_value, y_exact):
            return None
        original_point = {
            self.surface.n_variable: n_value,
            self.surface.x_variable: x_value,
            self.surface.y_variable: y_exact,
        }
        if not self.surface.verifies(original_point):
            raise ArithmeticError(
                "Constrained affine candidate failed independent verification."
            )
        cube_u = y_value - t_value
        cube_v = 2 * t_value + 6 * q_value
        cube_w = -t_value - y_value
        point = ConstrainedAffinePoint(
            n=n_value,
            x=x_value,
            y=y_exact,
            q=q_value,
            t=t_value,
            cube_u=cube_u,
            cube_v=cube_v,
            cube_w=cube_w,
        )
        if point.cube_sum != self.cube_target:
            raise ArithmeticError(
                "Constrained affine point failed the three-cubes identity."
            )
        return point

    def scan_fibers(self) -> Iterator[AffineFiberScan]:
        for q_value in range(self.q_min, self.q_max + 1):
            cursor_start = (
                self.first_q_divisor_cursor
                if q_value == self.q_min
                else 0
            )
            if self.is_sum114:
                obstruction = _sum114_local_obstruction(q_value)
                if obstruction is not None:
                    if cursor_start:
                        raise ConstrainedRationalSearchError(
                            "The positive-divisor cursor is nonzero, but the "
                            "first q fiber is eliminated before divisor "
                            "enumeration. Restart that fiber with cursor 0."
                        )
                    yield AffineFiberScan(
                        q=q_value,
                        points=(),
                        divisor_candidates_checked=0,
                        factorization_complete=True,
                        factorization_proof_grade=True,
                        divisor_enumeration_complete=True,
                        positive_divisor_count=0,
                        factorization=(),
                        local_obstruction=obstruction,
                        divisor_cursor_start=0,
                        divisor_cursor_next=None,
                    )
                    continue

            cubic_remainder = 36 * q_value**3 + self.residual
            if cubic_remainder == 0:
                if self._zero_remainder_witness(q_value) is not None:
                    raise ConstrainedRationalSearchError(
                        "An admissible zero-remainder fiber cannot be "
                        "exhausted by finite signed-divisor enumeration."
                    )
                if cursor_start:
                    raise ConstrainedRationalSearchError(
                        "The positive-divisor cursor is nonzero, but fixed "
                        "coordinate predicates exclude the first q fiber "
                        "before divisor enumeration. Restart with cursor 0."
                    )
                yield AffineFiberScan(
                    q=q_value,
                    points=(),
                    divisor_candidates_checked=0,
                    factorization_complete=True,
                    factorization_proof_grade=True,
                    divisor_enumeration_complete=True,
                    positive_divisor_count=0,
                    factorization=(),
                    local_obstruction=(
                        "zero-remainder fiber excluded by fixed rational-point "
                        "constraints"
                    ),
                    divisor_cursor_start=0,
                    divisor_cursor_next=None,
                )
                continue
            (
                factors,
                factorization_complete,
                factorization_proof_grade,
            ) = _bounded_factorization(
                cubic_remainder,
                self.factor_limit,
            )
            positive_divisor_count = prod(
                exponent + 1 for _, exponent in factors
            )
            if cursor_start > positive_divisor_count:
                raise ConstrainedRationalSearchError(
                    "The first-q positive-divisor cursor exceeds the "
                    f"computed divisor count ({positive_divisor_count})."
                )
            if cursor_start and not factorization_complete:
                raise ConstrainedRationalSearchError(
                    "A positive-divisor cursor cannot resume an incomplete "
                    "factorization. Increase factor effort and restart this "
                    "q fiber with cursor 0."
                )
            cursor_stop = min(
                positive_divisor_count,
                cursor_start + self.max_positive_divisors,
            )
            divisor_enumeration_complete = (
                factorization_complete
                and cursor_stop >= positive_divisor_count
            )
            divisor_cursor_next = (
                cursor_stop
                if factorization_complete
                and cursor_stop < positive_divisor_count
                else None
            )
            points: list[ConstrainedAffinePoint] = []
            checked = 0
            divisors = _positive_divisors_from_factors(
                factors,
                cursor_start,
                cursor_stop,
            )
            for positive_divisor in divisors:
                for t_value in (-positive_divisor, positive_divisor):
                    if t_value == 0 or cubic_remainder % t_value:
                        continue
                    quotient = cubic_remainder // t_value
                    if self.is_sum114 and (
                        t_value % 12 != 7 or quotient % 12 != 11
                    ):
                        continue
                    checked += 1
                    square = (t_value + 6 * q_value) ** 2 + quotient
                    if square < 0:
                        continue
                    y_value = isqrt(square)
                    if y_value * y_value != square:
                        continue
                    signed_y = (
                        (y_value,)
                        if y_value == 0
                        else (y_value, -y_value)
                    )
                    for candidate_y in signed_y:
                        point = self._point(q_value, t_value, candidate_y)
                        if point is not None:
                            points.append(point)

            points.sort(key=lambda point: (
                abs(point.t),
                point.t,
                point.y < 0,
                point.y,
            ))
            yield AffineFiberScan(
                q=q_value,
                points=tuple(points),
                divisor_candidates_checked=checked,
                factorization_complete=factorization_complete,
                factorization_proof_grade=factorization_proof_grade,
                divisor_enumeration_complete=divisor_enumeration_complete,
                positive_divisor_count=positive_divisor_count,
                factorization=factors,
                divisor_cursor_start=cursor_start,
                divisor_cursor_next=divisor_cursor_next,
            )


def affine_constraint_compatibility_error(
    surface: AffineNormalizedSquarePlan,
    constraints: RationalPointConstraints,
) -> str | None:
    """Explain why denominator constraints do not give an integer q,t lattice."""
    if constraints.n_denominator_divisor is None:
        return "Constrained affine search requires an n denominator divisor."
    if constraints.x_denominator_divisor is None:
        return "Constrained affine search requires an x denominator divisor."
    if not constraints.require_integral_y:
        return "Constrained affine divisor search requires integral y."
    if surface.q_slope.denominator != 1 or surface.q_offset.denominator != 1:
        return "The detected q(n) map does not preserve the requested integer lattice."
    if surface.t_slope.denominator != 1 or surface.t_offset.denominator != 1:
        return "The detected t(x) map does not preserve the requested integer lattice."
    if abs(surface.q_slope.numerator) != constraints.n_denominator_divisor:
        return (
            "The n denominator divisor must equal the absolute q(n) slope "
            "for a complete integer-q reduction."
        )
    if abs(surface.t_slope.numerator) != constraints.x_denominator_divisor:
        return (
            "The x denominator divisor must equal the absolute t(x) slope "
            "for a complete integer-t reduction."
        )
    if surface.residual.denominator != 1:
        return "The normalized cubic remainder is not integral on integer q."
    return None
