"""Exact seed and Mordell--Weil search for the eqref{1.71} family.

The recognized family is

    y^2 = (36*n^3 - 19 - 12*m*n)^2 - (2*m)^3.

For fixed ``n`` and ``c = 36*n^3 - 19``, the change ``X = -2*m`` gives

    Y^2 = X^3 + 36*n^2*X^2 + 12*n*c*X + c^2.

The point ``T = (0, c)`` has order three.  Published, exactly verified
integer points therefore provide useful seeds for bounded Mordell--Weil
lattice exploration and their complete torsion orbits.

The catalog is evidence and a source of generators, not a claim that the
bounded lattice expansion finds every rational point on every fiber.
Every returned point is independently substituted into the original family.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from itertools import product
from typing import Iterable

from sympy import Symbol, expand

from elliptic_engine import EllipticPoint, WeierstrassCurve


EQ171_SOURCE_URL = (
    "https://github.com/JAgbanwa/heading-somewhere-with-this/blob/main/"
    "Potential%20directions%20with%20specific%20equations/eqref%7B1.71%7D"
)

# (n, m, |y|).  Each entry represents the two signed points y = +/-|y|.
EQ171_CATALOG: tuple[tuple[int, int, int], ...] = (
    (-53316, -70703779450, 73465979324839725),
    (-38466, -18162958315, 12521132249600505),
    (-37917, -3798121117, 3749549735825673),
    (-37020, -49924900441, 39645249762963543),
    (-34655, -15409838367, 9580663199142935),
    (-34067, -83591650317, 77070656053484873),
    (-29317, -335124555576, 561438594393311033),
    (-29317, -1373577672, 1397778450840953),
    (-14362, 454411005, 7213473617543),
    (-9925, 185596059, 10965628195127),
    (-6565, -3579502461, 672515729205193),
    (-6561, 83882471, 2823976115241),
    (-4741, 45340050, 913195026575),
    (-2271, -196197225, 9679512465865),
    (-1641, -620850, 171316003825),
    (-970, -739259850, 57503797038269),
    (-921, 1452425, 11010153735),
    (-675, -613606, 16099399767),
    (-570, -1931787, 21281482855),
    (-367, 289374, 247553783),
    (-234, -1074880501, 99720478180593),
    (-147, -166915, 452011593),
    (-57, -2926, 8679903),
    (-54, -10743, 13016935),
    (-54, 4749, 2420407),
    (-29, -16716, 9066007),
    (-4, -1818, 236845),
    (-4, -1032, 107155),
    (1, -51, 1207),
    (1, -3, 55),
    (15, -1207, 358905),
    (19, -252195, 362844665),
    (19, -1197, 532855),
    (46, -21522, 17788355),
    (75, 11523, 3310775),
    (93, -175921, 307097193),
    (114, 27575, 8719215),
    (131, -401940, 1013677687),
    (309, 56375, 852251625),
    (790, 1096893, 6593716025),
    (798, -5378466956142, 35280376688536712227),
    (798, -5586, 18347596867),
    (909, -11607484, 190054724721),
    (909, 1826300, 1390662225),
    (1626, -213292581, 9811228042657),
    (1759, 6612585, 29364964345),
    (5118, -526254004, 50456015630061),
    (11409, -1918935865, 395599034387145),
    (11527, -67430670, 64484348509601),
    (11750, -1737888261, 366153513664753),
    (14709, -2616641560, 689629545026145),
    (14709, 473559320, 10489917226785),
    (15519, -2004788485, 567823975362135),
    (16531, 220439859, 118539695046007),
    (17309, 225396696, 139544322245119),
    (18344, -1152587709, 488636781747209),
    (27949, 7804038, 783344205524825),
    (57534, -12272261400, 15803899374762125),
    (62643, -99098449359, 121374207030719431),
    (64808, -26459053782, 32724676849633037),
    (138693, 36415956444, 29484467972297713),
    (167163, -33373801909, 235738065125780169),
)


@dataclass(frozen=True)
class Eq171GeneratedPoint:
    n: Fraction
    m: Fraction
    y: Fraction
    strategy: str
    coefficients: tuple[int, ...] = ()
    torsion_multiple: int = 0

    @property
    def integral(self) -> bool:
        return (
            self.n.denominator == 1
            and self.m.denominator == 1
            and self.y.denominator == 1
        )

    @property
    def y_integral(self) -> bool:
        return self.y.denominator == 1


@dataclass(frozen=True)
class Eq171Search:
    points: tuple[Eq171GeneratedPoint, ...]
    catalog_rows_in_bounds: int
    generated_points: int
    fibers_expanded: int
    coefficient_bound: int


def eq171_residual(
    n_variable: Symbol,
    m_variable: Symbol,
    y_variable: Symbol,
):
    return y_variable**2 - (
        (36 * n_variable**3 - 19 - 12 * m_variable * n_variable) ** 2
        - (2 * m_variable) ** 3
    )


def matches_eq171_family(
    expression,
    n_variable: Symbol,
    m_variable: Symbol,
    y_variable: Symbol,
) -> bool:
    """Recognize either orientation of the exact polynomial equation."""
    expected = expand(eq171_residual(n_variable, m_variable, y_variable))
    normalized = expand(expression)
    return normalized == expected or normalized == -expected


def verifies_eq171(
    n_value: Fraction | int,
    m_value: Fraction | int,
    y_value: Fraction | int,
) -> bool:
    n_exact = Fraction(n_value)
    m_exact = Fraction(m_value)
    y_exact = Fraction(y_value)
    center = 36 * n_exact**3 - 19 - 12 * m_exact * n_exact
    return y_exact**2 == center**2 - (2 * m_exact) ** 3


def _curve_for_fiber(n_value: int) -> tuple[WeierstrassCurve, EllipticPoint]:
    c_value = Fraction(36 * n_value**3 - 19)
    curve = WeierstrassCurve(
        Fraction(36 * n_value**2),
        Fraction(12 * n_value) * c_value,
        c_value**2,
    )
    torsion = EllipticPoint(Fraction(0), c_value)
    if not curve.contains(torsion) or curve.multiply(3, torsion) is not None:
        raise ArithmeticError("eqref{1.71} torsion-section verification failed.")
    return curve, torsion


def _point_bits(point: EllipticPoint) -> int:
    return max(
        abs(point.x.numerator).bit_length(),
        point.x.denominator.bit_length(),
        abs(point.y.numerator).bit_length(),
        point.y.denominator.bit_length(),
    )


def _add_multiple(
    curve: WeierstrassCurve,
    accumulator: EllipticPoint | None,
    coefficient: int,
    generator: EllipticPoint,
) -> EllipticPoint | None:
    multiple = curve.multiply(coefficient, generator)
    return curve.add(accumulator, multiple)


def _catalog_by_fiber() -> dict[int, tuple[tuple[int, int], ...]]:
    fibers: dict[int, list[tuple[int, int]]] = {}
    for n_value, m_value, y_value in EQ171_CATALOG:
        fibers.setdefault(n_value, []).append((m_value, y_value))
    return {
        n_value: tuple(points)
        for n_value, points in fibers.items()
    }


def catalog_is_exact() -> bool:
    return (
        len(EQ171_CATALOG) == 62
        and len(set(EQ171_CATALOG)) == 62
        and all(verifies_eq171(*row) for row in EQ171_CATALOG)
    )


def _admissible(
    point: Eq171GeneratedPoint,
    *,
    n_bounds: tuple[int, int],
    m_bounds: tuple[int, int],
    point_type: str,
    skip_zero_n: bool,
    skip_zero_m: bool,
) -> bool:
    if not n_bounds[0] <= point.n <= n_bounds[1]:
        return False
    if not m_bounds[0] <= point.m <= m_bounds[1]:
        return False
    if skip_zero_n and point.n == 0:
        return False
    # The catalog and lattice engine target nontrivial m != 0 points.  The
    # elementary m = 0 family is already emitted by the generic projection
    # solver and would otherwise crowd out genuinely new points.
    if point.m == 0:
        return False
    if point_type == "rational" and point.integral:
        return False
    return verifies_eq171(point.n, point.m, point.y)


def _sorted_points(
    points: Iterable[Eq171GeneratedPoint],
) -> tuple[Eq171GeneratedPoint, ...]:
    return tuple(sorted(
        points,
        key=lambda point: (
            point.strategy != "eq171_verified_catalog",
            not point.y_integral,
            not point.integral,
            abs(point.n),
            abs(point.m),
            point.n,
            point.m,
            point.y < 0,
            point.y,
        ),
    ))


def search_eq171_family(
    *,
    n_bounds: tuple[int, int],
    m_bounds: tuple[int, int],
    coefficient_bound: int,
    point_type: str,
    skip_zero_n: bool,
    skip_zero_m: bool,
    result_limit: int,
    coordinate_bit_limit: int = 16_384,
) -> Eq171Search:
    """Return catalog points and a bounded exact Mordell--Weil expansion."""
    if coefficient_bound < 0:
        raise ValueError("coefficient_bound must be non-negative.")
    if point_type not in {"rational", "all"}:
        raise ValueError("eqref{1.71} exact search requires rational or all.")
    if result_limit < 1:
        raise ValueError("result_limit must be positive.")
    if not catalog_is_exact():
        raise ArithmeticError("The embedded eqref{1.71} seed catalog is invalid.")

    catalog_keys = {
        (Fraction(n_value), Fraction(m_value), Fraction(sign * y_value))
        for n_value, m_value, y_value in EQ171_CATALOG
        for sign in (1, -1)
    }
    seen: set[tuple[Fraction, Fraction, Fraction]] = set()
    accepted: list[Eq171GeneratedPoint] = []

    def register(candidate: Eq171GeneratedPoint) -> bool:
        key = (candidate.n, candidate.m, candidate.y)
        if key in seen or not _admissible(
            candidate,
            n_bounds=n_bounds,
            m_bounds=m_bounds,
            point_type=point_type,
            skip_zero_n=skip_zero_n,
            skip_zero_m=skip_zero_m,
        ):
            return False
        seen.add(key)
        accepted.append(candidate)
        return True

    catalog_rows_in_bounds = sum(
        1
        for n_value, m_value, _ in EQ171_CATALOG
        if n_bounds[0] <= n_value <= n_bounds[1]
        and m_bounds[0] <= m_value <= m_bounds[1]
        and not (skip_zero_n and n_value == 0)
    )
    for n_value, m_value, y_value in EQ171_CATALOG:
        for sign in (1, -1):
            candidate = Eq171GeneratedPoint(
                n=Fraction(n_value),
                m=Fraction(m_value),
                y=Fraction(sign * y_value),
                strategy="eq171_verified_catalog",
            )
            register(candidate)

    generated_count = 0
    fibers_expanded = 0
    if coefficient_bound == 0:
        return Eq171Search(
            points=_sorted_points(accepted),
            catalog_rows_in_bounds=catalog_rows_in_bounds,
            generated_points=0,
            fibers_expanded=0,
            coefficient_bound=0,
        )

    for n_value, fiber_rows in _catalog_by_fiber().items():
        if not n_bounds[0] <= n_value <= n_bounds[1]:
            continue
        curve, torsion = _curve_for_fiber(n_value)
        generators = tuple(dict.fromkeys(
            EllipticPoint(Fraction(-2 * m_value), Fraction(y_value))
            for m_value, y_value in fiber_rows
        ))
        if not all(curve.contains(point) for point in generators):
            raise ArithmeticError(
                f"eqref{{1.71}} seed failed on fiber n={n_value}."
            )
        fibers_expanded += 1

        coefficient_vectors = product(
            range(-coefficient_bound, coefficient_bound + 1),
            repeat=len(generators),
        )
        for coefficients in coefficient_vectors:
            if not any(coefficients):
                continue
            base: EllipticPoint | None = None
            try:
                for coefficient, generator in zip(coefficients, generators):
                    if coefficient:
                        base = _add_multiple(
                            curve,
                            base,
                            coefficient,
                            generator,
                        )
                if base is None or _point_bits(base) > coordinate_bit_limit:
                    continue
                for torsion_multiple in range(3):
                    curve_point = curve.add(
                        base,
                        curve.multiply(torsion_multiple, torsion),
                    )
                    if (
                        curve_point is None
                        or _point_bits(curve_point) > coordinate_bit_limit
                    ):
                        continue
                    m_value = -curve_point.x / 2
                    y_value = curve_point.y
                    key = (
                        Fraction(n_value),
                        m_value,
                        y_value,
                    )
                    strategy = (
                        "eq171_verified_catalog"
                        if key in catalog_keys
                        else "eq171_mordell_weil_lattice"
                    )
                    candidate = Eq171GeneratedPoint(
                        n=Fraction(n_value),
                        m=m_value,
                        y=y_value,
                        strategy=strategy,
                        coefficients=tuple(coefficients),
                        torsion_multiple=torsion_multiple,
                    )
                    before = len(accepted)
                    register(candidate)
                    generated_count += int(
                        strategy == "eq171_mordell_weil_lattice"
                        and len(accepted) > before
                    )
            except (ArithmeticError, ZeroDivisionError):
                continue

    ordered = _sorted_points(accepted)
    return Eq171Search(
        points=ordered[:result_limit],
        catalog_rows_in_bounds=catalog_rows_in_bounds,
        generated_points=generated_count,
        fibers_expanded=fibers_expanded,
        coefficient_bound=coefficient_bound,
    )
