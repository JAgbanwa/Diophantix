"""Differential-check ProofLab's supported polynomial evaluator against SymPy."""

from __future__ import annotations

import json
import random
import subprocess
from pathlib import Path

import sympy


RANDOM = random.Random(0xD10F4A71)
ROOT = Path(__file__).resolve().parents[1]


def build_case() -> dict[str, object]:
    coefficients = [RANDOM.randint(-12, 12) for _ in range(10)]
    expression = (
        f"{coefficients[0]}*x^3 + {coefficients[1]}*x^2*y + "
        f"{coefficients[2]}*x*y^2 + {coefficients[3]}*y^3 + "
        f"{coefficients[4]}*x^2 + {coefficients[5]}*x*y + "
        f"{coefficients[6]}*y^2 + {coefficients[7]}*x + "
        f"{coefficients[8]}*y + {coefficients[9]}"
    )
    return {
        "expression": expression,
        "assignment": {"x": RANDOM.randint(-25, 25), "y": RANDOM.randint(-25, 25)},
    }


def main() -> None:
    cases = [build_case() for _ in range(120)]
    completed = subprocess.run(
        ["node", "scripts/evaluate-polynomials.mjs"],
        cwd=ROOT,
        input=json.dumps(cases),
        text=True,
        capture_output=True,
        check=True,
    )
    prooflab_values = json.loads(completed.stdout)
    x, y = sympy.symbols("x y")
    for index, (case, prooflab_value) in enumerate(zip(cases, prooflab_values, strict=True)):
        expression = sympy.sympify(str(case["expression"]).replace("^", "**"), locals={"x": x, "y": y})
        expected = expression.subs(case["assignment"])
        if str(expected) != prooflab_value:
            raise AssertionError(f"case {index} differed: SymPy={expected}, ProofLab={prooflab_value}")
    print(f"Differential test passed: {len(cases)} random polynomials matched SymPy exactly.")


if __name__ == "__main__":
    main()
