"""Exact height-bounded rational search for rational-polynomial equations.

The search is deliberately explicit about scope:

* two coordinates are enumerated as reduced fractions p/q with
  max(|p|, q) <= ``height`` inside their configured intervals;
* the remaining coordinate is chosen adaptively and solved exactly over Q;
* the solved coordinate has no height or magnitude bound.

This cannot decide arbitrary Diophantine equations, but every returned point is
exact and a completed scan is exhaustive inside the displayed search scope.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from itertools import product
from math import gcd, isqrt
from typing import Iterator, Mapping, Sequence

from sympy import (
    Poly,
    QQ,
    Rational,
    Symbol,
    cancel,
    expand,
    factor,
    factor_list,
)


_AFFINE_NORMALIZED_HEIGHT_CAP = 24


class ExactRationalSearchError(ValueError):
    """Raised when an equation is outside the exact rational-search language."""


def format_fraction(value: Fraction) -> str:
    """Return a stable integer or reduced-fraction representation."""
    return (
        str(value.numerator)
        if value.denominator == 1
        else f"{value.numerator}/{value.denominator}"
    )


def reduced_rationals(
    lower: int,
    upper: int,
    height: int,
) -> list[Fraction]:
    """Enumerate every reduced p/q in [lower, upper] of projective height <= H.

    Results are ordered by height, then denominator and numerator, so small
    points are attempted first without changing the completeness of a full run.
    """
    if lower > upper:
        raise ExactRationalSearchError("Search interval minimum exceeds maximum.")
    if height < 1:
        raise ExactRationalSearchError("Rational height must be at least 1.")

    values: list[Fraction] = []
    for denominator in range(1, height + 1):
        numerator_min = max(-height, lower * denominator)
        numerator_max = min(height, upper * denominator)
        for numerator in range(numerator_min, numerator_max + 1):
            if gcd(abs(numerator), denominator) != 1:
                continue
            values.append(Fraction(numerator, denominator))

    values.sort(
        key=lambda value: (
            max(abs(value.numerator), value.denominator),
            value.denominator,
            value.numerator,
        )
    )
    return values


def _as_fraction(value) -> Fraction:
    if isinstance(value, Fraction):
        return value
    if isinstance(value, int):
        return Fraction(value)
    if getattr(value, "is_Rational", False):
        return Fraction(int(value.p), int(value.q))
    raise ExactRationalSearchError(
        f"Coefficient evaluation produced a non-rational value: {value!r}."
    )


def _sqrt_fraction(value: Fraction) -> Fraction | None:
    if value < 0:
        return None
    numerator_root = isqrt(value.numerator)
    denominator_root = isqrt(value.denominator)
    if (
        numerator_root * numerator_root != value.numerator
        or denominator_root * denominator_root != value.denominator
    ):
        return None
    return Fraction(numerator_root, denominator_root)


def _polynomial_square_base(expression):
    """Return an exact polynomial square root, or ``None``."""
    try:
        coefficient, factors = factor_list(expression)
        coefficient_root = _sqrt_fraction(_as_fraction(coefficient))
        if coefficient_root is None:
            return None
        square_root = Rational(
            coefficient_root.numerator,
            coefficient_root.denominator,
        )
        for factor_expression, exponent in factors:
            if exponent % 2:
                return None
            square_root *= factor_expression ** (exponent // 2)
        return factor(square_root)
    except Exception:  # noqa: BLE001
        return None


def _compile_rational_polynomial(expression, variables: Sequence[Symbol]):
    """Compile a QQ polynomial without introducing floating-point literals."""
    if not variables:
        constant = _as_fraction(expression)
        return lambda: constant

    try:
        terms = tuple(
            (
                tuple(monomial),
                Fraction(int(coefficient.p), int(coefficient.q)),
            )
            for monomial, coefficient in Poly(
                expression,
                *variables,
                domain=QQ,
            ).terms()
        )
    except Exception as exc:  # noqa: BLE001
        raise ExactRationalSearchError(
            "Exact rational mode requires polynomial coefficients in Q."
        ) from exc

    def evaluate(*arguments: Fraction) -> Fraction:
        total = Fraction(0)
        for monomial, coefficient in terms:
            value = coefficient
            for argument, exponent in zip(arguments, monomial):
                if exponent:
                    value *= argument**exponent
            total += value
        return total

    return evaluate


def rational_roots(
    coefficients: Sequence[Fraction],
    variable: Symbol,
) -> tuple[list[Fraction], bool]:
    """Return all distinct rational roots and whether the polynomial is zero."""
    normalized = list(coefficients)
    while normalized and normalized[0] == 0:
        normalized.pop(0)

    if not normalized:
        return [], True
    degree = len(normalized) - 1
    if degree == 0:
        return [], False
    if degree == 1:
        leading, constant = normalized
        return [-constant / leading], False
    if degree == 2:
        a_value, b_value, c_value = normalized
        discriminant = b_value * b_value - 4 * a_value * c_value
        square_root = _sqrt_fraction(discriminant)
        if square_root is None:
            return [], False
        roots = {
            (-b_value + square_root) / (2 * a_value),
            (-b_value - square_root) / (2 * a_value),
        }
        return sorted(roots), False

    sympy_coefficients = [
        Rational(value.numerator, value.denominator) for value in normalized
    ]
    polynomial = Poly.from_list(sympy_coefficients, gens=variable, domain=QQ)
    roots = {
        Fraction(int(root.p), int(root.q))
        for root in polynomial.ground_roots().keys()
        if getattr(root, "is_Rational", False)
    }
    return sorted(roots), False


@dataclass(frozen=True)
class AffineNormalizedSquarePlan:
    """Exact search after compressing a large affine cubic-square surface.

    The detected model is

        y² = (t + 6q)² + (36q³ + k) / t,

    where q and t are invertible affine changes of n and x. Small q/t values
    can therefore map to n/x coordinates with arbitrarily large rational
    height. This is precisely the case that coordinate-height sweeps miss.
    """

    q_slope: Fraction
    q_offset: Fraction
    t_slope: Fraction
    t_offset: Fraction
    residual: Fraction
    q_values: tuple[Fraction, ...]
    t_values: tuple[Fraction, ...]
    equation_variables: tuple[Symbol, ...]
    equation_function: object
    denominator_function: object
    bounds: Mapping[Symbol, tuple[int, int]]
    n_variable: Symbol
    x_variable: Symbol
    y_variable: Symbol
    height: int

    @property
    def strategy(self) -> str:
        return "affine_normalized_square_surface"

    @property
    def hidden_label(self) -> str:
        return "q"

    @property
    def candidate_count(self) -> int:
        return len(self.q_values) * len(self.t_values)

    def verifies(self, point: Mapping[Symbol, Fraction]) -> bool:
        arguments = [point[variable] for variable in self.equation_variables]
        return (
            self.denominator_function(*arguments) != 0
            and self.equation_function(*arguments) == 0
        )

    def point_from_values(
        self,
        q_value: Fraction,
        t_value: Fraction,
        y_value: Fraction,
    ) -> dict[Symbol, Fraction] | None:
        if t_value == 0:
            return None
        n_value = (q_value - self.q_offset) / self.q_slope
        x_value = (t_value - self.t_offset) / self.t_slope
        n_lower, n_upper = self.bounds[self.n_variable]
        x_lower, x_upper = self.bounds[self.x_variable]
        if not n_lower <= n_value <= n_upper:
            return None
        if not x_lower <= x_value <= x_upper:
            return None
        y_bounds = self.bounds.get(self.y_variable)
        if y_bounds is not None and not (
            y_bounds[0] <= y_value <= y_bounds[1]
        ):
            return None
        point = {
            self.n_variable: n_value,
            self.x_variable: x_value,
            self.y_variable: y_value,
        }
        return point if self.verifies(point) else None

    def elliptic_coefficients(
        self,
        q_value: Fraction,
    ) -> tuple[Fraction, Fraction, Fraction] | None:
        """Return a2, a4, a6 for the birational elliptic q-fiber."""
        u_value = 6 * q_value
        remainder = 36 * q_value**3 + self.residual
        if remainder == 0:
            return None
        return (
            u_value**2,
            2 * u_value * remainder,
            remainder**2,
        )

    def to_elliptic(
        self,
        q_value: Fraction,
        t_value: Fraction,
        y_value: Fraction,
    ) -> tuple[Fraction, Fraction] | None:
        remainder = 36 * q_value**3 + self.residual
        if remainder == 0 or t_value == 0:
            return None
        x_curve = remainder / t_value
        return x_curve, x_curve * y_value

    def from_elliptic(
        self,
        q_value: Fraction,
        x_curve: Fraction,
        y_curve: Fraction,
    ) -> tuple[dict[Symbol, Fraction], Fraction, Fraction] | None:
        remainder = 36 * q_value**3 + self.residual
        if remainder == 0 or x_curve == 0:
            return None
        t_value = remainder / x_curve
        y_value = y_curve / x_curve
        point = self.point_from_values(q_value, t_value, y_value)
        if point is None:
            return None
        return point, q_value, t_value

    def classification(self) -> dict[str, object]:
        return {
            "family": "affine_normalized_cubic_square_surface",
            "degree": 3,
            "genus": 1,
            "geometry": "genus_one_fibration",
            "genus_applies_to": "generic nonsingular fixed-q fiber",
            "exact_birational_map": True,
            "forward": (
                f"q={format_fraction(self.q_slope)}*n+"
                f"{format_fraction(self.q_offset)}; "
                f"t={format_fraction(self.t_slope)}*x+"
                f"{format_fraction(self.t_offset)}"
            ),
            "inverse": (
                f"n=(q-{format_fraction(self.q_offset)})/"
                f"{format_fraction(self.q_slope)}; "
                f"x=(t-{format_fraction(self.t_offset)})/"
                f"{format_fraction(self.t_slope)}"
            ),
            "weierstrass_equation": (
                "Y^2=X^3+36*q^2*X^2+12*q*(36*q^3+k)*X"
                "+(36*q^3+k)^2"
            ),
            "cubic_discriminant": (
                "-27*(k+4*q^3)*(k+36*q^3)^3"
            ),
            "discriminant": (
                "-432*(k+4*q^3)*(k+36*q^3)^3"
            ),
            "condition": (
                "(k+4*q^3)*(k+36*q^3) is nonzero on the analyzed fiber"
            ),
        }

    def birational_descriptor(
        self,
        q_value: Fraction,
    ) -> dict[str, object]:
        remainder = 36 * q_value**3 + self.residual
        return {
            "available": remainder != 0,
            "family": "affine_normalized_cubic_square_surface",
            "forward": (
                f"X=({format_fraction(remainder)})/t; Y=X*y"
            ),
            "inverse": (
                f"t=({format_fraction(remainder)})/X; y=Y/X"
            ),
        }

    def points(
        self,
        *,
        prefer_integer_y: bool = True,
    ) -> Iterator[tuple[dict[Symbol, Fraction], Fraction, Fraction]]:
        found: list[
            tuple[dict[Symbol, Fraction], Fraction, Fraction]
        ] = []
        for q_value, t_value in product(self.q_values, self.t_values):
            if t_value == 0:
                continue
            rhs = (
                (t_value + 6 * q_value) ** 2
                + (36 * q_value**3 + self.residual) / t_value
            )
            y_root = _sqrt_fraction(rhs)
            if y_root is None:
                continue

            y_values = [y_root] if y_root == 0 else [y_root, -y_root]
            for y_value in y_values:
                point = self.point_from_values(q_value, t_value, y_value)
                if point is not None:
                    found.append((point, q_value, t_value))
        if prefer_integer_y:
            found.sort(
                key=lambda item: (
                    item[0][self.y_variable].denominator != 1,
                    max(
                        abs(item[1].numerator),
                        item[1].denominator,
                        abs(item[2].numerator),
                        item[2].denominator,
                    ),
                    item[1],
                    item[2],
                    item[0][self.y_variable] < 0,
                )
            )
        yield from found

    def scope(self) -> str:
        return (
            "Detected the exact affine normal form "
            "y²=(t+6q)²+(36q³+k)/t. Every reduced rational q and t with "
            f"max(|numerator|, denominator) <= {self.height} is tested, then "
            "mapped back exactly. The mapped n and x coordinates have no "
            "height or magnitude bound; configured value intervals still apply."
        )


def build_affine_normalized_square_plan(
    expression,
    n_variable: Symbol,
    x_variable: Symbol,
    y_variable: Symbol,
    bounds: Mapping[Symbol, tuple[int, int]],
    height: int,
) -> AffineNormalizedSquarePlan | None:
    """Detect and compile an affine-compressed cubic-square surface.

    Returns ``None`` when the equation does not have the supported exact form.
    Detection is symbolic: no coefficient sizes or equation-specific constants
    are hard-coded.
    """
    try:
        normalized_expression = cancel(expression)
        polynomial_y = Poly(normalized_expression, y_variable, domain="EX")
        if polynomial_y.degree() != 2:
            return None
        leading, linear, constant = (
            cancel(coefficient)
            for coefficient in polynomial_y.all_coeffs()
        )
        if linear != 0 or leading.free_symbols:
            return None

        rhs = cancel(-constant / leading)
        numerator, denominator = rhs.as_numer_denom()
        if (
            denominator.free_symbols - {x_variable}
            or x_variable not in denominator.free_symbols
        ):
            return None
        denominator_polynomial = Poly(denominator, x_variable, domain=QQ)
        if denominator_polynomial.degree() != 1:
            return None

        quotient, remainder = Poly(
            numerator,
            x_variable,
            domain="EX",
        ).div(Poly(denominator, x_variable, domain="EX"))
        square_candidate = factor(quotient.as_expr())
        square_base, square_exponent = square_candidate.as_base_exp()
        if square_exponent != 2:
            return None

        remainder_expression = cancel(remainder.as_expr())
        if remainder_expression.free_symbols - {n_variable}:
            return None

        denominator_x_coefficient = denominator_polynomial.coeff_monomial(
            x_variable
        )
        detected = None
        for linear_square_root in (square_base, -square_base):
            try:
                root_polynomial = Poly(
                    linear_square_root,
                    n_variable,
                    x_variable,
                    domain=QQ,
                )
            except Exception:  # noqa: BLE001
                continue
            if root_polynomial.total_degree() != 1:
                continue

            # ``cancel`` is free to move a nonzero rational scalar from the
            # symbolic denominator into the numerator.  Recover the actual
            # affine t from the x coefficient of the squared linear form
            # instead of assuming that the canonical denominator itself is t.
            # Of the two square roots, use the orientation with positive
            # t-slope so the detected map and residual are deterministic.
            root_x_coefficient = root_polynomial.coeff_monomial(x_variable)
            if root_x_coefficient <= 0:
                continue
            t_scale = cancel(
                root_x_coefficient / denominator_x_coefficient
            )
            if t_scale.free_symbols:
                continue
            t_expression = cancel(t_scale * denominator)

            q_expression = cancel(
                (linear_square_root - t_expression) / 6
            )
            if q_expression.free_symbols - {n_variable}:
                continue
            q_polynomial = Poly(q_expression, n_variable, domain=QQ)
            if q_polynomial.degree() != 1:
                continue

            residual_expression = cancel(
                t_scale * remainder_expression - 36 * q_expression**3
            )
            if residual_expression.free_symbols:
                continue
            detected = (
                q_polynomial,
                residual_expression,
                t_expression,
            )
            break

        if detected is None:
            return None
        q_polynomial, residual_expression, t_expression = detected

        q_slope = _as_fraction(q_polynomial.coeff_monomial(n_variable))
        q_offset = _as_fraction(q_polynomial.coeff_monomial(1))
        t_polynomial = Poly(t_expression, x_variable, domain=QQ)
        t_slope = _as_fraction(t_polynomial.coeff_monomial(x_variable))
        t_offset = _as_fraction(t_polynomial.coeff_monomial(1))
        residual = _as_fraction(residual_expression)
        if q_slope == 0 or t_slope == 0:
            return None

        normalized_height = min(height, _AFFINE_NORMALIZED_HEIGHT_CAP)
        normalized_values = tuple(
            reduced_rationals(
                -normalized_height,
                normalized_height,
                normalized_height,
            )
        )
        active_variables = tuple(
            variable
            for variable in (n_variable, x_variable, y_variable)
            if variable in normalized_expression.free_symbols
        )
        original_numerator, original_denominator = (
            normalized_expression.as_numer_denom()
        )
        return AffineNormalizedSquarePlan(
            q_slope=q_slope,
            q_offset=q_offset,
            t_slope=t_slope,
            t_offset=t_offset,
            residual=residual,
            q_values=normalized_values,
            t_values=normalized_values,
            equation_variables=active_variables,
            equation_function=_compile_rational_polynomial(
                original_numerator,
                active_variables,
            ),
            denominator_function=_compile_rational_polynomial(
                original_denominator,
                active_variables,
            ),
            bounds=bounds,
            n_variable=n_variable,
            x_variable=x_variable,
            y_variable=y_variable,
            height=normalized_height,
        )
    except Exception:  # noqa: BLE001
        return None


@dataclass(frozen=True)
class AffineBirationalSquarePlan:
    """Exact search on a generically detected affine cubic-square surface.

    The supported normal form is

        y² = (lambda*t + z)² + R(z)/t,

    where z is affine in n, t is affine in n and x, lambda is rational, and
    R has degree at most three.  This strictly generalizes the specialized
    contest surface while retaining an explicit invertible map.
    """

    hidden_slope: Fraction
    hidden_offset: Fraction
    t_x_slope: Fraction
    t_n_slope: Fraction
    t_offset: Fraction
    square_t_scale: Fraction
    remainder_coefficients: tuple[Fraction, ...]
    hidden_values: tuple[Fraction, ...]
    t_values: tuple[Fraction, ...]
    equation_variables: tuple[Symbol, ...]
    equation_function: object
    denominator_function: object
    bounds: Mapping[Symbol, tuple[int, int]]
    n_variable: Symbol
    x_variable: Symbol
    y_variable: Symbol
    height: int

    @property
    def strategy(self) -> str:
        return "affine_birational_cubic_surface"

    @property
    def hidden_label(self) -> str:
        return "z"

    @property
    def candidate_count(self) -> int:
        return len(self.hidden_values) * len(self.t_values)

    def remainder_at(self, hidden_value: Fraction) -> Fraction:
        result = Fraction(0)
        for coefficient in self.remainder_coefficients:
            result = result * hidden_value + coefficient
        return result

    def verifies(self, point: Mapping[Symbol, Fraction]) -> bool:
        arguments = [point[variable] for variable in self.equation_variables]
        return (
            self.denominator_function(*arguments) != 0
            and self.equation_function(*arguments) == 0
        )

    def point_from_values(
        self,
        hidden_value: Fraction,
        t_value: Fraction,
        y_value: Fraction,
    ) -> dict[Symbol, Fraction] | None:
        if t_value == 0:
            return None
        n_value = (
            hidden_value - self.hidden_offset
        ) / self.hidden_slope
        x_value = (
            t_value
            - self.t_n_slope * n_value
            - self.t_offset
        ) / self.t_x_slope
        n_lower, n_upper = self.bounds[self.n_variable]
        x_lower, x_upper = self.bounds[self.x_variable]
        if not n_lower <= n_value <= n_upper:
            return None
        if not x_lower <= x_value <= x_upper:
            return None
        y_bounds = self.bounds.get(self.y_variable)
        if y_bounds is not None and not (
            y_bounds[0] <= y_value <= y_bounds[1]
        ):
            return None
        point = {
            self.n_variable: n_value,
            self.x_variable: x_value,
            self.y_variable: y_value,
        }
        return point if self.verifies(point) else None

    def elliptic_coefficients(
        self,
        hidden_value: Fraction,
    ) -> tuple[Fraction, Fraction, Fraction] | None:
        remainder = self.remainder_at(hidden_value)
        if remainder == 0:
            return None
        return (
            hidden_value**2,
            2 * self.square_t_scale * hidden_value * remainder,
            (self.square_t_scale * remainder) ** 2,
        )

    def to_elliptic(
        self,
        hidden_value: Fraction,
        t_value: Fraction,
        y_value: Fraction,
    ) -> tuple[Fraction, Fraction] | None:
        remainder = self.remainder_at(hidden_value)
        if remainder == 0 or t_value == 0:
            return None
        x_curve = remainder / t_value
        return x_curve, x_curve * y_value

    def from_elliptic(
        self,
        hidden_value: Fraction,
        x_curve: Fraction,
        y_curve: Fraction,
    ) -> tuple[dict[Symbol, Fraction], Fraction, Fraction] | None:
        remainder = self.remainder_at(hidden_value)
        if remainder == 0 or x_curve == 0:
            return None
        t_value = remainder / x_curve
        y_value = y_curve / x_curve
        point = self.point_from_values(hidden_value, t_value, y_value)
        if point is None:
            return None
        return point, hidden_value, t_value

    def classification(self) -> dict[str, object]:
        return {
            "family": "affine_cubic_square_surface",
            "degree": 3,
            "genus": 1,
            "exact_birational_map": True,
            "condition": "R(z) is nonzero on the analyzed fiber",
        }

    def birational_descriptor(
        self,
        hidden_value: Fraction,
    ) -> dict[str, object]:
        remainder = self.remainder_at(hidden_value)
        return {
            "available": remainder != 0,
            "family": "affine_cubic_square_surface",
            "forward": (
                f"X=({format_fraction(remainder)})/t; Y=X*y"
            ),
            "inverse": (
                f"t=({format_fraction(remainder)})/X; y=Y/X"
            ),
        }

    def points(
        self,
        *,
        prefer_integer_y: bool = True,
    ) -> Iterator[tuple[dict[Symbol, Fraction], Fraction, Fraction]]:
        found: list[
            tuple[dict[Symbol, Fraction], Fraction, Fraction]
        ] = []
        for hidden_value, t_value in product(
            self.hidden_values,
            self.t_values,
        ):
            if t_value == 0:
                continue
            rhs = (
                self.square_t_scale * t_value + hidden_value
            ) ** 2 + self.remainder_at(hidden_value) / t_value
            y_root = _sqrt_fraction(rhs)
            if y_root is None:
                continue
            y_values = [y_root] if y_root == 0 else [y_root, -y_root]
            for y_value in y_values:
                point = self.point_from_values(
                    hidden_value,
                    t_value,
                    y_value,
                )
                if point is not None:
                    found.append((point, hidden_value, t_value))
        if prefer_integer_y:
            found.sort(
                key=lambda item: (
                    item[0][self.y_variable].denominator != 1,
                    max(
                        abs(item[1].numerator),
                        item[1].denominator,
                        abs(item[2].numerator),
                        item[2].denominator,
                    ),
                    item[1],
                    item[2],
                    item[0][self.y_variable] < 0,
                )
            )
        yield from found

    def scope(self) -> str:
        return (
            "Detected the exact birational normal form "
            "y²=(lambda*t+z)²+R(z)/t, with affine z(n), affine t(n,x), "
            "and cubic R. Every reduced rational z and t with "
            f"max(|numerator|, denominator) <= {self.height} is tested, then "
            "mapped back and verified exactly. The mapped n and x coordinates "
            "have no height or magnitude bound; configured intervals still apply."
        )


def build_affine_birational_square_plan(
    expression,
    n_variable: Symbol,
    x_variable: Symbol,
    y_variable: Symbol,
    bounds: Mapping[Symbol, tuple[int, int]],
    height: int,
) -> AffineBirationalSquarePlan | None:
    """Detect the generic affine cubic-square normal form symbolically."""
    try:
        normalized_expression = cancel(expression)
        polynomial_y = Poly(normalized_expression, y_variable, domain="EX")
        if polynomial_y.degree() != 2:
            return None
        leading, linear, constant = (
            cancel(coefficient)
            for coefficient in polynomial_y.all_coeffs()
        )
        if linear != 0 or leading.free_symbols:
            return None

        rhs = cancel(-constant / leading)
        numerator, denominator = rhs.as_numer_denom()
        if (
            x_variable not in denominator.free_symbols
            or denominator.free_symbols - {n_variable, x_variable}
        ):
            return None
        denominator_polynomial = Poly(
            denominator,
            n_variable,
            x_variable,
            domain=QQ,
        )
        if denominator_polynomial.total_degree() != 1:
            return None
        t_x_slope = _as_fraction(
            denominator_polynomial.coeff_monomial(x_variable)
        )
        t_n_slope = _as_fraction(
            denominator_polynomial.coeff_monomial(n_variable)
        )
        t_offset = _as_fraction(
            denominator_polynomial.coeff_monomial(1)
        )
        if t_x_slope == 0:
            return None

        quotient, remainder = Poly(
            numerator,
            x_variable,
            domain="EX",
        ).div(Poly(denominator, x_variable, domain="EX"))
        square_base = _polynomial_square_base(quotient.as_expr())
        if square_base is None:
            return None

        remainder_expression = cancel(remainder.as_expr())
        if remainder_expression.free_symbols - {n_variable}:
            return None

        detected = None
        for linear_square_root in (square_base, -square_base):
            root_polynomial = Poly(
                linear_square_root,
                n_variable,
                x_variable,
                domain=QQ,
            )
            if root_polynomial.total_degree() != 1:
                continue
            root_x_slope = _as_fraction(
                root_polynomial.coeff_monomial(x_variable)
            )
            square_t_scale = root_x_slope / t_x_slope
            hidden_expression = cancel(
                linear_square_root - square_t_scale * denominator
            )
            if hidden_expression.free_symbols - {n_variable}:
                continue
            hidden_polynomial = Poly(
                hidden_expression,
                n_variable,
                domain=QQ,
            )
            if hidden_polynomial.degree() != 1:
                continue

            hidden_slope = _as_fraction(
                hidden_polynomial.coeff_monomial(n_variable)
            )
            hidden_offset = _as_fraction(
                hidden_polynomial.coeff_monomial(1)
            )
            if hidden_slope == 0:
                continue

            hidden_symbol = Symbol("_diophantix_hidden")
            n_inverse = (
                hidden_symbol
                - Rational(hidden_offset.numerator, hidden_offset.denominator)
            ) / Rational(hidden_slope.numerator, hidden_slope.denominator)
            remainder_hidden = cancel(
                remainder_expression.subs(n_variable, n_inverse)
            )
            remainder_polynomial = Poly(
                remainder_hidden,
                hidden_symbol,
                domain=QQ,
            )
            if remainder_polynomial.degree() > 3:
                continue
            detected = (
                hidden_slope,
                hidden_offset,
                square_t_scale,
                tuple(
                    _as_fraction(coefficient)
                    for coefficient in remainder_polynomial.all_coeffs()
                ),
            )
            break

        if detected is None:
            return None
        (
            hidden_slope,
            hidden_offset,
            square_t_scale,
            remainder_coefficients,
        ) = detected

        normalized_height = min(height, _AFFINE_NORMALIZED_HEIGHT_CAP)
        normalized_values = tuple(
            reduced_rationals(
                -normalized_height,
                normalized_height,
                normalized_height,
            )
        )
        active_variables = tuple(
            variable
            for variable in (n_variable, x_variable, y_variable)
            if variable in normalized_expression.free_symbols
        )
        original_numerator, original_denominator = (
            normalized_expression.as_numer_denom()
        )
        return AffineBirationalSquarePlan(
            hidden_slope=hidden_slope,
            hidden_offset=hidden_offset,
            t_x_slope=t_x_slope,
            t_n_slope=t_n_slope,
            t_offset=t_offset,
            square_t_scale=square_t_scale,
            remainder_coefficients=remainder_coefficients,
            hidden_values=normalized_values,
            t_values=normalized_values,
            equation_variables=active_variables,
            equation_function=_compile_rational_polynomial(
                original_numerator,
                active_variables,
            ),
            denominator_function=_compile_rational_polynomial(
                original_denominator,
                active_variables,
            ),
            bounds=bounds,
            n_variable=n_variable,
            x_variable=x_variable,
            y_variable=y_variable,
            height=normalized_height,
        )
    except Exception:  # noqa: BLE001
        return None


@dataclass(frozen=True)
class PolynomialEllipticFiberPlan:
    """Exact elliptic fibers coming from cubic or rooted-quartic models.

    Two additional birational families are supported:

    * ``y² = a*x³ + b*x² + c*x + d`` with rational coefficients after a
      hidden-parameter specialization.  ``X=a*x, Y=a*y`` gives a monic
      Weierstrass model.
    * ``y² = f₄(x)`` when the specialized quartic has a rational root ``r``.
      Setting ``u=1/(x-r), v=y/(x-r)²`` produces a cubic, which is then
      scaled to a monic Weierstrass model.

    Every map is inverted with exact fractions and every returned point is
    substituted into the complete original equation.
    """

    rhs_coefficients: tuple[object, ...]
    polynomial_degree: int
    hidden_values: tuple[Fraction, ...]
    x_values: tuple[Fraction, ...]
    equation_variables: tuple[Symbol, ...]
    equation_function: object
    denominator_function: object
    bounds: Mapping[Symbol, tuple[int, int]]
    n_variable: Symbol
    x_variable: Symbol
    y_variable: Symbol
    height: int
    parameterized: bool

    @property
    def strategy(self) -> str:
        return (
            "polynomial_cubic_weierstrass_fiber"
            if self.polynomial_degree == 3
            else "polynomial_quartic_rational_root_fiber"
        )

    @property
    def hidden_label(self) -> str:
        return "n"

    @property
    def candidate_count(self) -> int:
        return len(self.hidden_values) * len(self.x_values)

    def _coefficient_values(
        self,
        hidden_value: Fraction,
    ) -> tuple[Fraction, ...] | None:
        substitution = Rational(
            hidden_value.numerator,
            hidden_value.denominator,
        )
        try:
            return tuple(
                _as_fraction(cancel(coefficient.subs(
                    self.n_variable,
                    substitution,
                )))
                for coefficient in self.rhs_coefficients
            )
        except Exception:  # noqa: BLE001
            return None

    @staticmethod
    def _evaluate_polynomial(
        coefficients: Sequence[Fraction],
        value: Fraction,
    ) -> Fraction:
        result = Fraction(0)
        for coefficient in coefficients:
            result = result * value + coefficient
        return result

    def _quartic_map_data(
        self,
        hidden_value: Fraction,
    ) -> tuple[
        Fraction,
        Fraction,
        tuple[Fraction, Fraction, Fraction],
    ] | None:
        coefficients = self._coefficient_values(hidden_value)
        if coefficients is None or len(coefficients) != 5:
            return None
        polynomial = Poly.from_list(
            [
                Rational(value.numerator, value.denominator)
                for value in coefficients
            ],
            gens=self.x_variable,
            domain=QQ,
        )
        rational_roots_found = sorted(
            (
                Fraction(int(root.p), int(root.q))
                for root in polynomial.ground_roots()
                if getattr(root, "is_Rational", False)
            ),
            key=lambda value: (
                max(abs(value.numerator), value.denominator),
                value,
            ),
        )
        u_variable = Symbol("_diophantix_u")
        for root in rational_roots_found:
            root_sympy = Rational(root.numerator, root.denominator)
            transformed = cancel(
                u_variable**4
                * polynomial.as_expr().subs(
                    self.x_variable,
                    root_sympy + 1 / u_variable,
                )
            )
            try:
                cubic = Poly(expand(transformed), u_variable, domain=QQ)
            except Exception:  # noqa: BLE001
                continue
            if cubic.degree() != 3:
                continue
            a_value, b_value, c_value, d_value = (
                _as_fraction(value) for value in cubic.all_coeffs()
            )
            if a_value == 0:
                continue
            return (
                root,
                a_value,
                (
                    b_value,
                    a_value * c_value,
                    a_value**2 * d_value,
                ),
            )
        return None

    def verifies(self, point: Mapping[Symbol, Fraction]) -> bool:
        arguments = [point[variable] for variable in self.equation_variables]
        return (
            self.denominator_function(*arguments) != 0
            and self.equation_function(*arguments) == 0
        )

    def point_from_values(
        self,
        hidden_value: Fraction,
        x_value: Fraction,
        y_value: Fraction,
    ) -> dict[Symbol, Fraction] | None:
        n_lower, n_upper = self.bounds[self.n_variable]
        x_lower, x_upper = self.bounds[self.x_variable]
        if not n_lower <= hidden_value <= n_upper:
            return None
        if not x_lower <= x_value <= x_upper:
            return None
        y_bounds = self.bounds.get(self.y_variable)
        if y_bounds is not None and not (
            y_bounds[0] <= y_value <= y_bounds[1]
        ):
            return None
        point = {
            self.n_variable: hidden_value,
            self.x_variable: x_value,
            self.y_variable: y_value,
        }
        return point if self.verifies(point) else None

    def elliptic_coefficients(
        self,
        hidden_value: Fraction,
    ) -> tuple[Fraction, Fraction, Fraction] | None:
        coefficients = self._coefficient_values(hidden_value)
        if coefficients is None:
            return None
        if self.polynomial_degree == 3:
            a_value, b_value, c_value, d_value = coefficients
            if a_value == 0:
                return None
            return (
                b_value,
                a_value * c_value,
                a_value**2 * d_value,
            )
        quartic_data = self._quartic_map_data(hidden_value)
        return quartic_data[2] if quartic_data is not None else None

    def to_elliptic(
        self,
        hidden_value: Fraction,
        x_value: Fraction,
        y_value: Fraction,
    ) -> tuple[Fraction, Fraction] | None:
        coefficients = self._coefficient_values(hidden_value)
        if coefficients is None:
            return None
        if self.polynomial_degree == 3:
            leading = coefficients[0]
            if leading == 0:
                return None
            return leading * x_value, leading * y_value
        quartic_data = self._quartic_map_data(hidden_value)
        if quartic_data is None:
            return None
        root, cubic_leading, _ = quartic_data
        if x_value == root:
            return None
        u_value = 1 / (x_value - root)
        v_value = y_value * u_value**2
        return cubic_leading * u_value, cubic_leading * v_value

    def from_elliptic(
        self,
        hidden_value: Fraction,
        x_curve: Fraction,
        y_curve: Fraction,
    ) -> tuple[dict[Symbol, Fraction], Fraction, Fraction] | None:
        coefficients = self._coefficient_values(hidden_value)
        if coefficients is None:
            return None
        if self.polynomial_degree == 3:
            leading = coefficients[0]
            if leading == 0:
                return None
            x_value = x_curve / leading
            y_value = y_curve / leading
        else:
            quartic_data = self._quartic_map_data(hidden_value)
            if quartic_data is None or x_curve == 0:
                return None
            root, cubic_leading, _ = quartic_data
            x_value = root + cubic_leading / x_curve
            y_value = cubic_leading * y_curve / x_curve**2
        point = self.point_from_values(hidden_value, x_value, y_value)
        if point is None:
            return None
        return point, hidden_value, x_value

    def points(
        self,
        *,
        prefer_integer_y: bool = True,
    ) -> Iterator[tuple[dict[Symbol, Fraction], Fraction, Fraction]]:
        found: list[
            tuple[dict[Symbol, Fraction], Fraction, Fraction]
        ] = []
        for hidden_value in self.hidden_values:
            coefficients = self._coefficient_values(hidden_value)
            if coefficients is None:
                continue
            for x_value in self.x_values:
                rhs = self._evaluate_polynomial(coefficients, x_value)
                y_root = _sqrt_fraction(rhs)
                if y_root is None:
                    continue
                y_values = [y_root] if y_root == 0 else [y_root, -y_root]
                for y_value in y_values:
                    point = self.point_from_values(
                        hidden_value,
                        x_value,
                        y_value,
                    )
                    if point is not None:
                        found.append(
                            (point, hidden_value, x_value)
                        )
        if prefer_integer_y:
            found.sort(
                key=lambda item: (
                    item[0][self.y_variable].denominator != 1,
                    max(
                        abs(item[1].numerator),
                        item[1].denominator,
                        abs(item[2].numerator),
                        item[2].denominator,
                    ),
                    item[1],
                    item[2],
                    item[0][self.y_variable] < 0,
                )
            )
        yield from found

    def classification(self) -> dict[str, object]:
        if self.polynomial_degree == 3:
            return {
                "family": "cubic_weierstrass_scaling",
                "degree": 3,
                "genus": 1,
                "exact_birational_map": True,
                "condition": "nonzero specialized cubic leading coefficient",
            }
        return {
            "family": "quartic_with_rational_root",
            "degree": 4,
            "genus": 1,
            "exact_birational_map": True,
            "condition": "a rational root on each analyzed quartic fiber",
        }

    def birational_descriptor(
        self,
        hidden_value: Fraction,
    ) -> dict[str, object]:
        coefficients = self._coefficient_values(hidden_value)
        if coefficients is None:
            return {"available": False}
        if self.polynomial_degree == 3:
            leading = coefficients[0]
            return {
                "available": leading != 0,
                "family": "cubic_weierstrass_scaling",
                "forward": f"X=({format_fraction(leading)})*x; "
                f"Y=({format_fraction(leading)})*y",
                "inverse": f"x=X/({format_fraction(leading)}); "
                f"y=Y/({format_fraction(leading)})",
            }
        quartic_data = self._quartic_map_data(hidden_value)
        if quartic_data is None:
            return {"available": False}
        root, cubic_leading, _ = quartic_data
        return {
            "available": True,
            "family": "quartic_with_rational_root",
            "rational_root": format_fraction(root),
            "forward": (
                f"u=1/(x-({format_fraction(root)})); "
                f"X=({format_fraction(cubic_leading)})*u; "
                f"Y=({format_fraction(cubic_leading)})*y*u^2"
            ),
            "inverse": (
                f"x=({format_fraction(root)})+"
                f"({format_fraction(cubic_leading)})/X; "
                f"y=({format_fraction(cubic_leading)})*Y/X^2"
            ),
        }

    def scope(self) -> str:
        family = (
            "cubic fibers scaled to monic Weierstrass form"
            if self.polynomial_degree == 3
            else "quartic fibers with a rational root mapped to a cubic"
        )
        parameter_scope = (
            "Every reduced rational n and x"
            if self.parameterized
            else "One representative n and every reduced rational x"
        )
        return (
            f"Automatically classified {family}. {parameter_scope} inside "
            "the configured intervals with "
            f"max(|numerator|, denominator) <= {self.height} is tested. "
            "Nonsingular fibers can then be expanded by exact elliptic "
            "group-law arithmetic; every inverse image is independently "
            "verified in the original equation."
        )


def build_polynomial_elliptic_fiber_plan(
    expression,
    n_variable: Symbol,
    x_variable: Symbol,
    y_variable: Symbol,
    bounds: Mapping[Symbol, tuple[int, int]],
    height: int,
) -> PolynomialEllipticFiberPlan | None:
    """Classify cubic and rational-root quartic fibers automatically."""
    try:
        normalized_expression = cancel(expression)
        polynomial_y = Poly(normalized_expression, y_variable, domain="EX")
        if polynomial_y.degree() != 2:
            return None
        leading, linear, constant = (
            cancel(coefficient)
            for coefficient in polynomial_y.all_coeffs()
        )
        if linear != 0 or leading.free_symbols:
            return None
        rhs = cancel(-constant / leading)
        rhs_denominator = rhs.as_numer_denom()[1]
        if (
            x_variable in rhs_denominator.free_symbols
            or rhs_denominator.free_symbols - {n_variable}
        ):
            return None
        if rhs.free_symbols - {n_variable, x_variable}:
            return None
        polynomial_x = Poly(rhs, x_variable, domain="EX")
        degree = polynomial_x.degree()
        if degree not in {3, 4}:
            return None
        coefficient_expressions = tuple(
            cancel(coefficient)
            for coefficient in polynomial_x.all_coeffs()
        )
        if any(
            coefficient.free_symbols - {n_variable}
            for coefficient in coefficient_expressions
        ):
            return None

        normalized_height = min(height, _AFFINE_NORMALIZED_HEIGHT_CAP)
        n_lower, n_upper = bounds[n_variable]
        x_lower, x_upper = bounds[x_variable]
        parameterized = n_variable in rhs.free_symbols
        if parameterized:
            hidden_values = tuple(
                reduced_rationals(
                    n_lower,
                    n_upper,
                    normalized_height,
                )
            )
        else:
            representative = (
                Fraction(0)
                if n_lower <= 0 <= n_upper
                else Fraction(n_lower)
            )
            hidden_values = (representative,)
        x_values = tuple(
            reduced_rationals(
                x_lower,
                x_upper,
                normalized_height,
            )
        )
        active_variables = tuple(
            variable
            for variable in (n_variable, x_variable, y_variable)
            if variable in normalized_expression.free_symbols
        )
        original_numerator, original_denominator = (
            normalized_expression.as_numer_denom()
        )
        plan = PolynomialEllipticFiberPlan(
            rhs_coefficients=coefficient_expressions,
            polynomial_degree=degree,
            hidden_values=hidden_values,
            x_values=x_values,
            equation_variables=active_variables,
            equation_function=_compile_rational_polynomial(
                original_numerator,
                active_variables,
            ),
            denominator_function=_compile_rational_polynomial(
                original_denominator,
                active_variables,
            ),
            bounds=bounds,
            n_variable=n_variable,
            x_variable=x_variable,
            y_variable=y_variable,
            height=normalized_height,
            parameterized=parameterized,
        )
        if not any(
            plan.elliptic_coefficients(hidden_value) is not None
            for hidden_value in hidden_values
        ):
            return None
        return plan
    except Exception:  # noqa: BLE001
        return None


def build_birational_square_plan(
    expression,
    n_variable: Symbol,
    x_variable: Symbol,
    y_variable: Symbol,
    bounds: Mapping[Symbol, tuple[int, int]],
    height: int,
) -> (
    AffineNormalizedSquarePlan
    | AffineBirationalSquarePlan
    | PolynomialEllipticFiberPlan
    | None
):
    """Select the first exact elliptic model recognized symbolically."""
    specialized = build_affine_normalized_square_plan(
        expression,
        n_variable,
        x_variable,
        y_variable,
        bounds,
        height,
    )
    if specialized is not None:
        return specialized
    generic = build_affine_birational_square_plan(
        expression,
        n_variable,
        x_variable,
        y_variable,
        bounds,
        height,
    )
    if generic is not None:
        return generic
    return build_polynomial_elliptic_fiber_plan(
        expression,
        n_variable,
        x_variable,
        y_variable,
        bounds,
        height,
    )


@dataclass(frozen=True)
class ExactRationalPlan:
    """Compiled exact search plan for one polynomial equation."""

    solve_variable: Symbol
    scan_variables: tuple[Symbol, ...]
    scan_values: tuple[tuple[Fraction, ...], ...]
    coefficient_functions: tuple
    equation_variables: tuple[Symbol, ...]
    equation_function: object
    denominator_function: object
    has_variable_denominator: bool
    polynomial_degree: int
    height: int
    bounds: Mapping[Symbol, tuple[int, int]]

    @property
    def candidate_count(self) -> int:
        count = 1
        for values in self.scan_values:
            count *= len(values)
        return count

    def assignments(self) -> Iterator[dict[Symbol, Fraction]]:
        if not self.scan_variables:
            yield {}
            return
        for values in product(*self.scan_values):
            yield dict(zip(self.scan_variables, values))

    def roots_for(
        self,
        assignment: Mapping[Symbol, Fraction],
    ) -> tuple[list[Fraction], bool]:
        arguments = [assignment[variable] for variable in self.scan_variables]
        coefficients = tuple(
            _as_fraction(function(*arguments))
            for function in self.coefficient_functions
        )
        return rational_roots(coefficients, self.solve_variable)

    def verifies(self, point: Mapping[Symbol, Fraction]) -> bool:
        """Independently substitute a point using exact rational arithmetic."""
        arguments = [point[variable] for variable in self.equation_variables]
        return (
            self.denominator_function(*arguments) != 0
            and self.equation_function(*arguments) == 0
        )

    def scope(self) -> str:
        if self.scan_variables:
            scanned = ", ".join(str(variable) for variable in self.scan_variables)
            scan_text = (
                f"Every reduced rational value of {scanned} inside the configured "
                f"intervals with max(|numerator|, denominator) <= {self.height}"
            )
        else:
            scan_text = "The equation has no enumerated coordinate"
        scope = (
            f"{scan_text}; for each assignment, every rational "
            f"{self.solve_variable}-root is solved exactly with no magnitude bound."
        )
        if self.has_variable_denominator:
            scope += (
                " Rational denominators are cleared symbolically and every "
                "original denominator pole is excluded."
            )
        return scope


def build_exact_rational_plan(
    expression,
    variables: Sequence[Symbol],
    bounds: Mapping[Symbol, tuple[int, int]],
    height: int,
    preferred_solve_variable: Symbol | None = None,
    integral_priority_variable: Symbol | None = None,
) -> ExactRationalPlan:
    """Compile an exact-rational projection for a rational polynomial."""
    active_variables = tuple(
        variable for variable in variables if variable in expression.free_symbols
    )
    if not active_variables:
        raise ExactRationalSearchError("The equation contains no searchable variable.")
    try:
        normalized_expression = cancel(expression)
        numerator, denominator = normalized_expression.as_numer_denom()
        rational_polynomial = Poly(numerator, *active_variables, domain=QQ)
        Poly(denominator, *active_variables, domain=QQ)
        degrees = {
            variable: int(rational_polynomial.degree(variable))
            for variable in active_variables
        }
    except Exception as exc:  # noqa: BLE001
        raise ExactRationalSearchError(
            "Exact rational mode requires a polynomial or rational-polynomial "
            "equation with coefficients in Q."
        ) from exc

    candidate_values = {
        variable: tuple(reduced_rationals(*bounds[variable], height))
        for variable in active_variables
    }
    if integral_priority_variable in candidate_values:
        candidate_values[integral_priority_variable] = tuple(
            sorted(
                candidate_values[integral_priority_variable],
                key=lambda value: value.denominator != 1,
            )
        )
    feasible_solve_variables = [
        variable
        for variable in active_variables
        if all(
            candidate_values[other]
            for other in active_variables
            if other != variable
        )
    ]
    if not feasible_solve_variables:
        raise ExactRationalSearchError(
            "At least two configured intervals contain no rational value at "
            "this height. Increase H or widen the intervals."
        )

    if preferred_solve_variable is not None:
        if preferred_solve_variable not in active_variables:
            raise ExactRationalSearchError(
                f"Cannot solve for absent variable {preferred_solve_variable}."
            )
        if preferred_solve_variable not in feasible_solve_variables:
            raise ExactRationalSearchError(
                f"The configured scan intervals cannot support solving for "
                f"{preferred_solve_variable} at height {height}."
            )
        solve_variable = preferred_solve_variable
    else:
        preference = {"y": 0, "x": 1, "n": 2}
        solve_variable = min(
            feasible_solve_variables,
            key=lambda variable: (
                degrees[variable],
                -len(candidate_values[variable]),
                preference.get(str(variable), 3),
            ),
        )
    scan_variables = tuple(
        variable for variable in active_variables if variable != solve_variable
    )

    polynomial = Poly(numerator, solve_variable, domain="EX")
    coefficient_expressions = polynomial.all_coeffs()
    coefficient_functions = tuple(
        _compile_rational_polynomial(coefficient, scan_variables)
        for coefficient in coefficient_expressions
    )

    return ExactRationalPlan(
        solve_variable=solve_variable,
        scan_variables=scan_variables,
        scan_values=tuple(candidate_values[variable] for variable in scan_variables),
        coefficient_functions=coefficient_functions,
        equation_variables=active_variables,
        equation_function=_compile_rational_polynomial(
            numerator,
            active_variables,
        ),
        denominator_function=_compile_rational_polynomial(
            denominator,
            active_variables,
        ),
        has_variable_denominator=bool(denominator.free_symbols),
        polynomial_degree=degrees[solve_variable],
        height=height,
        bounds=bounds,
    )


def point_is_integral(values: Mapping[Symbol, Fraction]) -> bool:
    return all(value.denominator == 1 for value in values.values())
