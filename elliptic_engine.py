"""Exact elliptic-curve arithmetic for birational Diophantix searches.

Advanced engines only generate candidates.  The originating rational-search
plan maps every candidate back and verifies it against the complete input
equation before it can reach an API response.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Iterable, Mapping

from sympy import Symbol


@dataclass(frozen=True)
class EllipticPoint:
    x: Fraction
    y: Fraction


@dataclass(frozen=True)
class WeierstrassCurve:
    """Curve ``y² = x³ + a2*x² + a4*x + a6`` over Q."""

    a2: Fraction
    a4: Fraction
    a6: Fraction

    def contains(self, point: EllipticPoint | None) -> bool:
        if point is None:
            return True
        return (
            point.y**2
            == point.x**3
            + self.a2 * point.x**2
            + self.a4 * point.x
            + self.a6
        )

    def discriminant(self) -> Fraction:
        b2 = 4 * self.a2
        b4 = 2 * self.a4
        b6 = 4 * self.a6
        b8 = 4 * self.a2 * self.a6 - self.a4**2
        return (
            -(b2**2) * b8
            - 8 * b4**3
            - 27 * b6**2
            + 9 * b2 * b4 * b6
        )

    def negate(self, point: EllipticPoint | None) -> EllipticPoint | None:
        if point is None:
            return None
        return EllipticPoint(point.x, -point.y)

    def add(
        self,
        left: EllipticPoint | None,
        right: EllipticPoint | None,
    ) -> EllipticPoint | None:
        if left is None:
            return right
        if right is None:
            return left
        if not self.contains(left) or not self.contains(right):
            raise ValueError("Cannot add a point that is not on the curve.")
        if left.x == right.x and left.y == -right.y:
            return None
        if left == right:
            if left.y == 0:
                return None
            slope = (
                3 * left.x**2 + 2 * self.a2 * left.x + self.a4
            ) / (2 * left.y)
        else:
            slope = (right.y - left.y) / (right.x - left.x)
        x_result = slope**2 - self.a2 - left.x - right.x
        y_result = -left.y + slope * (left.x - x_result)
        result = EllipticPoint(x_result, y_result)
        if not self.contains(result):
            raise ArithmeticError("Elliptic group-law verification failed.")
        return result

    def multiply(
        self,
        multiple: int,
        point: EllipticPoint | None,
    ) -> EllipticPoint | None:
        if multiple == 0 or point is None:
            return None
        if multiple < 0:
            return self.multiply(-multiple, self.negate(point))
        result = None
        addend = point
        remaining = multiple
        while remaining:
            if remaining & 1:
                result = self.add(result, addend)
            remaining >>= 1
            if remaining:
                addend = self.add(addend, addend)
        return result


@dataclass(frozen=True)
class EllipticGeneratedPoint:
    point: Mapping[Symbol, Fraction]
    hidden_value: Fraction
    t_value: Fraction
    engine: str
    source: str
    multiple: int

    @property
    def y_integral(self) -> bool:
        return next(
            value.denominator == 1
            for variable, value in self.point.items()
            if str(variable) == "y"
        )


def fraction_height_bits(value: Fraction) -> int:
    return max(
        abs(value.numerator).bit_length(),
        value.denominator.bit_length(),
    )


def native_mordell_weil_expansion(
    plan,
    base_points: Iterable[
        tuple[Mapping[Symbol, Fraction], Fraction, Fraction]
    ],
    *,
    max_multiple: int,
    prefer_integer_y: bool,
    coordinate_bit_limit: int = 16_384,
    fiber_limit: int = 48,
    result_limit: int = 500,
) -> list[EllipticGeneratedPoint]:
    """Generate exact multiples of discovered points on each elliptic fiber."""
    if max_multiple < 2:
        return []

    y_variable = plan.y_variable
    base_list = list(base_points)
    base_keys = {
        (
            point[plan.n_variable],
            point[plan.x_variable],
            point[y_variable],
        )
        for point, _, _ in base_list
    }
    seen = set(base_keys)
    seeds_by_hidden: dict[Fraction, list[EllipticPoint]] = {}

    for point, hidden_value, t_value in base_list:
        if point[y_variable] < 0:
            continue
        coefficients = plan.elliptic_coefficients(hidden_value)
        transformed = plan.to_elliptic(
            hidden_value,
            t_value,
            point[y_variable],
        )
        if coefficients is None or transformed is None:
            continue
        curve = WeierstrassCurve(*coefficients)
        if curve.discriminant() == 0:
            continue
        curve_point = EllipticPoint(*transformed)
        if curve.contains(curve_point):
            seeds_by_hidden.setdefault(hidden_value, []).append(curve_point)

    generated: list[EllipticGeneratedPoint] = []
    for hidden_value, seeds in list(seeds_by_hidden.items())[:fiber_limit]:
        coefficients = plan.elliptic_coefficients(hidden_value)
        if coefficients is None:
            continue
        curve = WeierstrassCurve(*coefficients)
        unique_seeds = list(dict.fromkeys(seeds))[:4]
        for seed_index, seed in enumerate(unique_seeds, start=1):
            for multiple in range(2, max_multiple + 1):
                curve_point = curve.multiply(multiple, seed)
                if curve_point is None:
                    continue
                if max(
                    fraction_height_bits(curve_point.x),
                    fraction_height_bits(curve_point.y),
                ) > coordinate_bit_limit:
                    break
                for signed_point, sign_name in (
                    (curve_point, "positive"),
                    (curve.negate(curve_point), "negative"),
                ):
                    if signed_point is None:
                        continue
                    mapped = plan.from_elliptic(
                        hidden_value,
                        signed_point.x,
                        signed_point.y,
                    )
                    if mapped is None:
                        continue
                    point, _, t_value = mapped
                    key = (
                        point[plan.n_variable],
                        point[plan.x_variable],
                        point[y_variable],
                    )
                    if key in seen:
                        continue
                    seen.add(key)
                    generated.append(
                        EllipticGeneratedPoint(
                            point=point,
                            hidden_value=hidden_value,
                            t_value=t_value,
                            engine="native_mordell_weil",
                            source=f"seed_{seed_index}_{sign_name}",
                            multiple=multiple,
                        )
                    )

    if prefer_integer_y:
        generated.sort(
            key=lambda item: (
                not item.y_integral,
                item.multiple,
                fraction_height_bits(item.point[y_variable]),
                item.hidden_value,
                item.t_value,
            )
        )
    return generated[:result_limit]


def select_descent_fibers(
    plan,
    base_points: Iterable[
        tuple[Mapping[Symbol, Fraction], Fraction, Fraction]
    ],
    *,
    limit: int = 12,
    coefficient_bit_limit: int = 512,
) -> list[tuple[Fraction, tuple[Fraction, Fraction, Fraction]]]:
    """Choose small, nonsingular fibers for an optional descent backend."""
    base_hidden = {
        hidden_value for _, hidden_value, _ in base_points
    }
    available_values = getattr(
        plan,
        "q_values",
        getattr(plan, "hidden_values", ()),
    )
    ordered = sorted(
        set(available_values),
        key=lambda value: (
            value not in base_hidden,
            value.denominator != 1,
            max(abs(value.numerator), value.denominator),
            value,
        ),
    )
    selected: list[
        tuple[Fraction, tuple[Fraction, Fraction, Fraction]]
    ] = []
    for hidden_value in ordered:
        # Fibers without a discovered seed are useful, but keep the automatic
        # descent scope compact and reproducible.
        if (
            hidden_value not in base_hidden
            and (
                hidden_value.denominator != 1
                or abs(hidden_value.numerator) > 6
            )
        ):
            continue
        coefficients = plan.elliptic_coefficients(hidden_value)
        if coefficients is None:
            continue
        curve = WeierstrassCurve(*coefficients)
        if curve.discriminant() == 0:
            continue
        if max(
            fraction_height_bits(coefficient)
            for coefficient in coefficients
        ) > coefficient_bit_limit:
            continue
        selected.append((hidden_value, coefficients))
        if len(selected) >= limit:
            break
    return selected


def map_external_elliptic_points(
    plan,
    candidates: Iterable[tuple[Fraction, Fraction, Fraction, str, int]],
    *,
    engine: str,
    prefer_integer_y: bool,
) -> list[EllipticGeneratedPoint]:
    """Map externally generated ``(hidden, X, Y)`` points back exactly."""
    y_variable = plan.y_variable
    seen: set[tuple[Fraction, Fraction, Fraction]] = set()
    generated: list[EllipticGeneratedPoint] = []
    for hidden_value, x_curve, y_curve, source, multiple in candidates:
        mapped = plan.from_elliptic(hidden_value, x_curve, y_curve)
        if mapped is None:
            continue
        point, _, t_value = mapped
        key = (
            point[plan.n_variable],
            point[plan.x_variable],
            point[y_variable],
        )
        if key in seen:
            continue
        seen.add(key)
        generated.append(
            EllipticGeneratedPoint(
                point=point,
                hidden_value=hidden_value,
                t_value=t_value,
                engine=engine,
                source=source,
                multiple=multiple,
            )
        )
    if prefer_integer_y:
        generated.sort(
            key=lambda item: (
                not item.y_integral,
                item.multiple,
                fraction_height_bits(item.point[y_variable]),
            )
        )
    return generated
