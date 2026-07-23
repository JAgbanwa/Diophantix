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

from sympy import Poly, QQ, Rational, Symbol, cancel


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
