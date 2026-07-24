"""Exact structural classification for Diophantix curve searches."""

from __future__ import annotations

from typing import Any

from sympy import Poly, Symbol, cancel, factor


def _plan_classification(plan) -> dict[str, Any] | None:
    if plan is None:
        return None
    classification_method = getattr(plan, "classification", None)
    if callable(classification_method):
        result = dict(classification_method())
    elif plan.strategy == "affine_normalized_square_surface":
        result = {
            "family": "affine_normalized_cubic_square_surface",
            "degree": 3,
            "genus": 1,
            "exact_birational_map": True,
            "condition": "nonzero cubic remainder on the selected fiber",
        }
    elif plan.strategy == "affine_birational_cubic_surface":
        result = {
            "family": "affine_cubic_square_surface",
            "degree": 3,
            "genus": 1,
            "exact_birational_map": True,
            "condition": "nonzero R(z) on the selected fiber",
        }
    else:
        return None
    result["strategy"] = plan.strategy
    result["scope"] = plan.scope()
    return result

def classify_curve_expression(
    expression,
    n_variable: Symbol,
    x_variable: Symbol,
    y_variable: Symbol,
    *,
    plan=None,
) -> dict[str, Any]:
    """Classify ``expression = 0`` without claiming more than is proved.

    Degree/genus statements are for the hyperelliptic model after fixing all
    parameters.  Singularity is reported as exact, generic, or unresolved when
    a symbolic discriminant still depends on parameters.
    """
    normalized = cancel(expression)
    parameters = sorted(
        str(symbol)
        for symbol in normalized.free_symbols - {x_variable, y_variable}
    )
    result: dict[str, Any] = {
        "ok": True,
        "variables": sorted(str(symbol) for symbol in normalized.free_symbols),
        "parameters": parameters,
        "equation_kind": "unclassified",
        "exact_birational_model": _plan_classification(plan),
    }
    try:
        polynomial_y = Poly(normalized, y_variable, domain="EX")
    except Exception:  # noqa: BLE001
        result.update({
            "equation_kind": "non_polynomial_in_y",
            "supported_deep_model": plan is not None,
        })
        return result

    result["degree_y"] = polynomial_y.degree()
    if polynomial_y.degree() != 2:
        result.update({
            "equation_kind": "general_plane_curve",
            "supported_deep_model": plan is not None,
        })
        return result

    leading, linear, constant = (
        cancel(coefficient)
        for coefficient in polynomial_y.all_coeffs()
    )
    if linear != 0:
        result.update({
            "equation_kind": "quadratic_in_y_with_linear_term",
            "supported_deep_model": plan is not None,
        })
        return result
    if leading == 0:
        result.update({
            "equation_kind": "degenerate_y_model",
            "supported_deep_model": False,
        })
        return result

    rhs = cancel(-constant / leading)
    numerator, denominator = rhs.as_numer_denom()
    if x_variable in denominator.free_symbols:
        result.update({
            "equation_kind": "rational_hyperelliptic_fibration",
            "degree_x": None,
            "genus": None,
            "supported_deep_model": plan is not None,
        })
        return result

    try:
        polynomial_x = Poly(rhs, x_variable, domain="EX")
    except Exception:  # noqa: BLE001
        result.update({
            "equation_kind": "non_polynomial_hyperelliptic_model",
            "supported_deep_model": plan is not None,
        })
        return result

    degree = polynomial_x.degree()
    result["degree_x"] = degree
    if degree <= 0:
        curve_type = "constant_or_degenerate"
        genus = 0
    elif degree <= 2:
        curve_type = "genus_zero_conic"
        genus = 0
    elif degree in {3, 4}:
        curve_type = "genus_one_hyperelliptic"
        genus = 1
    else:
        curve_type = "higher_genus_hyperelliptic"
        genus = (degree - 1) // 2
    result.update({
        "equation_kind": curve_type,
        "genus": genus,
        "supported_deep_model": plan is not None,
    })

    try:
        discriminant = factor(polynomial_x.discriminant())
        result["polynomial_discriminant"] = str(discriminant)
        if discriminant == 0:
            result["singularity"] = "singular"
        elif discriminant.free_symbols:
            result["singularity"] = "generically_nonsingular"
            result["singularity_condition"] = f"{discriminant} != 0"
        else:
            result["singularity"] = "nonsingular"
    except Exception:  # noqa: BLE001
        result["singularity"] = "unresolved"
    return result
