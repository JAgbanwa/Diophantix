"""Optional, sandboxed SageMath subprocess bridge.

SageMath is intentionally optional: hosted runtimes without the ``sage``
binary continue with the native exact engine.  User expressions are never
interpolated into executable code; only bounded rational curve coefficients
are sent as JSON over stdin to a constant driver.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
import json
import os
import shutil
import subprocess
import tempfile
from threading import BoundedSemaphore
from typing import Iterable


_SAGE_SLOT = BoundedSemaphore(value=1)


_SAGE_DRIVER = r"""
import json
import sys
from sage.all import QQ, EllipticCurve

payload = json.load(sys.stdin)
output = {"points": [], "errors": []}

for fiber in payload["fibers"]:
    try:
        curve = EllipticCurve(QQ, [
            0,
            QQ(fiber["a2"]),
            0,
            QQ(fiber["a4"]),
            QQ(fiber["a6"]),
        ])
        seeds = []
        try:
            seeds.extend(("generator", point) for point in curve.gens(proof=False))
        except Exception as exc:
            output["errors"].append({
                "fiber_id": fiber["id"],
                "stage": "gens",
                "message": str(exc)[:240],
            })
        try:
            seeds.extend(
                ("torsion", point)
                for point in curve.torsion_points()
                if not point.is_zero()
            )
        except Exception as exc:
            output["errors"].append({
                "fiber_id": fiber["id"],
                "stage": "torsion",
                "message": str(exc)[:240],
            })

        seen_seeds = set()
        unique_seeds = []
        for source, point in seeds:
            if point.is_zero():
                continue
            key = (str(point[0]), str(point[1]))
            if key in seen_seeds:
                continue
            seen_seeds.add(key)
            unique_seeds.append((source, point))

        for seed_index, (source, seed) in enumerate(unique_seeds[:8], start=1):
            for multiple in range(1, payload["max_multiple"] + 1):
                point = multiple * seed
                if point.is_zero():
                    continue
                output["points"].append({
                    "fiber_id": fiber["id"],
                    "hidden": fiber["hidden"],
                    "x": str(point[0]),
                    "y": str(point[1]),
                    "source": f"{source}_{seed_index}",
                    "multiple": multiple,
                })
                if point[1] != 0:
                    output["points"].append({
                        "fiber_id": fiber["id"],
                        "hidden": fiber["hidden"],
                        "x": str(point[0]),
                        "y": str(-point[1]),
                        "source": f"{source}_{seed_index}_negative",
                        "multiple": multiple,
                    })
    except Exception as exc:
        output["errors"].append({
            "fiber_id": fiber["id"],
            "stage": "curve",
            "message": str(exc)[:240],
        })

print(json.dumps(output, separators=(",", ":")))
"""


class SageBridgeError(RuntimeError):
    """Raised when an explicitly requested SageMath search cannot run."""


@dataclass(frozen=True)
class SageFiber:
    fiber_id: str
    hidden_value: Fraction
    a2: Fraction
    a4: Fraction
    a6: Fraction


@dataclass(frozen=True)
class SageCandidate:
    hidden_value: Fraction
    x: Fraction
    y: Fraction
    source: str
    multiple: int


@dataclass(frozen=True)
class SageSearchReport:
    candidates: tuple[SageCandidate, ...]
    errors: tuple[str, ...]
    fibers_attempted: int


def _fraction_text(value: Fraction) -> str:
    if value.denominator == 1:
        return str(value.numerator)
    return f"{value.numerator}/{value.denominator}"


class SageMathBridge:
    """Discover and invoke a local SageMath installation safely."""

    def __init__(
        self,
        executable: str | None = None,
        *,
        timeout_seconds: int = 30,
    ) -> None:
        configured = executable or os.environ.get(
            "DIOPHANTIX_SAGE_EXECUTABLE"
        )
        self.executable = configured or shutil.which("sage")
        self.timeout_seconds = max(2, min(timeout_seconds, 120))

    @property
    def available(self) -> bool:
        if not self.executable:
            return False
        if os.path.sep not in self.executable:
            return shutil.which(self.executable) is not None
        return os.path.isfile(self.executable) and os.access(
            self.executable,
            os.X_OK,
        )

    def version(self) -> str | None:
        if not self.available:
            return None
        try:
            completed = subprocess.run(
                [self.executable, "--version"],
                check=True,
                capture_output=True,
                text=True,
                timeout=4,
            )
            return completed.stdout.strip()[:160] or None
        except Exception:  # noqa: BLE001
            return None

    def search(
        self,
        fibers: Iterable[SageFiber],
        *,
        max_multiple: int,
    ) -> SageSearchReport:
        if not self.available:
            raise SageBridgeError(
                "SageMath is not installed in this runtime; the native exact "
                "Mordell-Weil engine remains available."
            )
        bounded_fibers = tuple(fibers)[:16]
        bounded_multiple = max(1, min(max_multiple, 12))
        payload = {
            "max_multiple": bounded_multiple,
            "fibers": [
                {
                    "id": fiber.fiber_id,
                    "hidden": _fraction_text(fiber.hidden_value),
                    "a2": _fraction_text(fiber.a2),
                    "a4": _fraction_text(fiber.a4),
                    "a6": _fraction_text(fiber.a6),
                }
                for fiber in bounded_fibers
            ],
        }
        if not bounded_fibers:
            return SageSearchReport((), (), 0)
        sage_cache = os.path.join(
            tempfile.gettempdir(),
            "diophantix-sage-cache",
        )
        os.makedirs(sage_cache, exist_ok=True)
        sage_environment = {
            key: os.environ[key]
            for key in ("PATH", "HOME", "LANG", "LC_ALL", "TMPDIR")
            if key in os.environ
        }
        sage_environment["DOT_SAGE"] = sage_cache
        if not _SAGE_SLOT.acquire(blocking=False):
            raise SageBridgeError(
                "SageMath is already serving another descent request; the "
                "native exact engine remains available."
            )
        try:
            try:
                completed = subprocess.run(
                    [self.executable, "-python", "-c", _SAGE_DRIVER],
                    input=json.dumps(payload, separators=(",", ":")),
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=self.timeout_seconds,
                    env=sage_environment,
                )
            except subprocess.TimeoutExpired as exc:
                raise SageBridgeError(
                    f"SageMath descent exceeded the "
                    f"{self.timeout_seconds}-second budget; native exact "
                    "results are still valid."
                ) from exc
            except (OSError, subprocess.CalledProcessError) as exc:
                stderr = getattr(exc, "stderr", "") or ""
                detail = stderr.strip().splitlines()[-1:] or [str(exc)]
                raise SageBridgeError(
                    f"SageMath descent failed: {detail[0][:240]}"
                ) from exc
        finally:
            _SAGE_SLOT.release()

        try:
            raw = json.loads(completed.stdout.strip().splitlines()[-1])
            candidates = tuple(
                SageCandidate(
                    hidden_value=Fraction(item["hidden"]),
                    x=Fraction(item["x"]),
                    y=Fraction(item["y"]),
                    source=str(item["source"]),
                    multiple=int(item["multiple"]),
                )
                for item in raw.get("points", [])
            )
            errors = tuple(
                (
                    f"{item.get('fiber_id', '?')} "
                    f"{item.get('stage', 'search')}: "
                    f"{item.get('message', 'unknown SageMath error')}"
                )
                for item in raw.get("errors", [])
            )
        except Exception as exc:  # noqa: BLE001
            raise SageBridgeError(
                "SageMath returned an invalid response."
            ) from exc
        return SageSearchReport(
            candidates=candidates,
            errors=errors,
            fibers_attempted=len(bounded_fibers),
        )
