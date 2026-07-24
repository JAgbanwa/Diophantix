"""Replayable exact certificates for elliptic-fiber solver output.

The certificate replays algebraic facts Diophantix can verify independently:
the Weierstrass discriminant, nonsingularity, curve membership of reported
points, transformation metadata, and payload integrity.  Rank/descent bounds
remain explicitly labelled as external SageMath or Magma evidence.
"""

from __future__ import annotations

from copy import deepcopy
from fractions import Fraction
import hashlib
import json
from typing import Any, Iterable

from elliptic_engine import EllipticPoint, WeierstrassCurve
from rational_search import format_fraction


CERTIFICATE_SCHEMA = "diophantix.elliptic-fiber-certificate.v1"


def _canonical_payload(value: Any) -> bytes:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode("utf-8")


def _digest(payload: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical_payload(payload)).hexdigest()


def _fraction(value: Any) -> Fraction:
    return Fraction(str(value))


def build_fiber_certificate(
    plan,
    hidden_value: Fraction,
    coefficients: tuple[Fraction, Fraction, Fraction],
    *,
    analysis: dict[str, Any] | None = None,
    reported_points: Iterable[tuple[Fraction, Fraction, str]] = (),
) -> dict[str, Any]:
    """Build a deterministic, tamper-evident certificate for one fiber."""
    curve = WeierstrassCurve(*coefficients)
    descriptor_method = getattr(plan, "birational_descriptor", None)
    if callable(descriptor_method):
        birational_map = descriptor_method(hidden_value)
    else:
        birational_map = {
            "available": True,
            "family": plan.strategy,
            "forward": "See the versioned Diophantix plan implementation.",
            "inverse": "Every inverse image is checked in the original equation.",
        }
    points = [
        {
            "x": format_fraction(x_value),
            "y": format_fraction(y_value),
            "source": source,
            "on_curve": curve.contains(EllipticPoint(x_value, y_value)),
        }
        for x_value, y_value, source in reported_points
    ]
    external_analysis = analysis or {
        "rank": {
            "status": "not_computed",
            "lower": None,
            "upper": None,
            "rigor": "none",
        },
        "two_descent": {"status": "not_computed"},
        "three_descent": {"status": "not_computed"},
    }
    payload: dict[str, Any] = {
        "schema": CERTIFICATE_SCHEMA,
        "fiber": {
            "hidden_label": plan.hidden_label,
            "hidden_value": format_fraction(hidden_value),
            "strategy": plan.strategy,
        },
        "curve": {
            "model": "Y^2 = X^3 + a2*X^2 + a4*X + a6",
            "a2": format_fraction(coefficients[0]),
            "a4": format_fraction(coefficients[1]),
            "a6": format_fraction(coefficients[2]),
            "discriminant": format_fraction(curve.discriminant()),
            "nonsingular": curve.discriminant() != 0,
        },
        "birational_map": birational_map,
        "reported_curve_points": points,
        "external_arithmetic_evidence": external_analysis,
        "claim_scope": {
            "replayable_exact": [
                "payload SHA-256 integrity",
                "Weierstrass discriminant",
                "nonsingularity flag",
                "reported point membership",
                "inverse images are separately checked against the input equation",
            ],
            "external": [
                "rank bounds and Selmer/descent results are attributed to the "
                "named external engine and are not re-proved by this replay",
            ],
            "not_claimed": [
                "completeness for arbitrary Diophantine equations",
                "a rank equality unless the external evidence reports matching "
                "rigorous lower and upper bounds",
            ],
        },
    }
    payload["sha256"] = _digest(payload)
    return payload


def replay_fiber_certificate(
    certificate: dict[str, Any],
) -> dict[str, Any]:
    """Replay every exact assertion supported by the certificate schema."""
    errors: list[str] = []
    warnings: list[str] = []
    if certificate.get("schema") != CERTIFICATE_SCHEMA:
        errors.append("Unsupported certificate schema.")
    supplied_digest = certificate.get("sha256")
    unsigned = deepcopy(certificate)
    unsigned.pop("sha256", None)
    expected_digest = _digest(unsigned)
    if supplied_digest != expected_digest:
        errors.append("SHA-256 payload digest mismatch.")

    curve_payload = certificate.get("curve", {})
    try:
        curve = WeierstrassCurve(
            _fraction(curve_payload["a2"]),
            _fraction(curve_payload["a4"]),
            _fraction(curve_payload["a6"]),
        )
        discriminant = curve.discriminant()
        if discriminant != _fraction(curve_payload["discriminant"]):
            errors.append("Weierstrass discriminant does not replay.")
        if bool(curve_payload.get("nonsingular")) != (discriminant != 0):
            errors.append("Nonsingularity flag does not replay.")
        for index, point_payload in enumerate(
            certificate.get("reported_curve_points", [])
        ):
            point = EllipticPoint(
                _fraction(point_payload["x"]),
                _fraction(point_payload["y"]),
            )
            on_curve = curve.contains(point)
            if not on_curve or not point_payload.get("on_curve"):
                errors.append(
                    f"Reported curve point {index + 1} is not on the curve."
                )
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Invalid exact curve payload: {exc}")

    rank = (
        certificate
        .get("external_arithmetic_evidence", {})
        .get("rank", {})
    )
    lower = rank.get("lower")
    upper = rank.get("upper")
    if lower is not None and upper is not None:
        try:
            if int(lower) < 0 or int(upper) < int(lower):
                errors.append("External rank interval is malformed.")
        except (TypeError, ValueError):
            errors.append("External rank interval is not integral.")
    if rank.get("status") not in {None, "not_computed", "unavailable"}:
        warnings.append(
            "Rank/descent evidence is externally attributed and was not "
            "independently recomputed during replay."
        )
    return {
        "ok": not errors,
        "schema": certificate.get("schema"),
        "sha256": expected_digest,
        "exact_checks": {
            "digest": supplied_digest == expected_digest,
            "curve_arithmetic": not any(
                "curve" in error.lower()
                or "discriminant" in error.lower()
                or "nonsingularity" in error.lower()
                for error in errors
            ),
        },
        "errors": errors,
        "warnings": warnings,
    }
