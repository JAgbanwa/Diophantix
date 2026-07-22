export const LITERATURE_REVIEWED_AT = "2026-07-21";

export type LiteratureStatus = "established" | "open" | "partially_resolved";

export type LiteratureSource = {
  label: string;
  url: string;
};

export type LiteratureContext = {
  problemId: string;
  name: string;
  status: LiteratureStatus;
  reviewedAt: string;
  summary: string;
  scopeNote: string;
  verifierBoundary: string;
  sources: LiteratureSource[];
};

export type LiteratureContextInput = {
  equation: string;
  claim: string;
  proposedArgument: string;
};

type CatalogEntry = LiteratureContext & { aliases: string[] };

const VERIFIER_BOUNDARY =
  "Literature status is contextual metadata. It cannot change the deterministic verdict or create a proof certificate.";

const CLAY_MILLENNIUM_SOURCE: LiteratureSource = {
  label: "Clay Mathematics Institute — Millennium Prize Problems status",
  url: "https://www.claymath.org/events/millennium-prize-problems-lecture-series/",
};

const CATALOG: CatalogEntry[] = [
  {
    problemId: "poincare-conjecture",
    name: "Poincaré conjecture",
    status: "established",
    reviewedAt: LITERATURE_REVIEWED_AT,
    summary: "The conjecture is solved. Grigori Perelman's work established it in the early 2000s, building on Richard Hamilton's Ricci-flow program.",
    scopeNote: "This is a theorem in geometric topology, outside ProofLab's current polynomial certificate language.",
    verifierBoundary: VERIFIER_BOUNDARY,
    sources: [{
      label: "Clay Mathematics Institute — Poincaré Conjecture (Solved)",
      url: "https://www.claymath.org/millennium/poincare-conjecture/",
    }],
    aliases: ["poincare conjecture"],
  },
  {
    problemId: "fermats-last-theorem",
    name: "Fermat's Last Theorem",
    status: "established",
    reviewedAt: LITERATURE_REVIEWED_AT,
    summary: "Fermat's Last Theorem is proved: for integer exponent n > 2, no positive nonzero integers satisfy x^n + y^n = z^n. The cubic equation is its n = 3 case.",
    scopeNote: "The unrestricted cubic equation has trivial solutions involving zero. ProofLab may still return UNKNOWN when its certificate language cannot replay the theorem under the submitted side conditions.",
    verifierBoundary: VERIFIER_BOUNDARY,
    sources: [{
      label: "Andrew Wiles — Modular elliptic curves and Fermat's Last Theorem",
      url: "https://annals.math.princeton.edu/1995/141-3/p01",
    }],
    aliases: ["fermat's last theorem", "fermats last theorem", "fermat last theorem"],
  },
  {
    problemId: "sums-of-three-cubes",
    name: "Sums of three cubes",
    status: "partially_resolved",
    reviewedAt: LITERATURE_REVIEWED_AT,
    summary: "The family x³ + y³ + z³ = k is only partially resolved. Targets k congruent to ±4 modulo 9 are impossible; many admissible targets have known solutions, while the general existence question for admissible k remains open.",
    scopeNote: "A concrete value of k can be impossible, solved, or still unresolved. Its status must be checked as a specific instance rather than inferred from the family label.",
    verifierBoundary: VERIFIER_BOUNDARY,
    sources: [
      {
        label: "Booker and Sutherland — On a question of Mordell",
        url: "https://math.mit.edu/~drew/Mordell2022.pdf",
      },
      {
        label: "Andrew Sutherland — reviewed sums-of-cubes computations",
        url: "https://math.mit.edu/~drew/sumsofcubes.html",
      },
    ],
    aliases: ["sums of three cubes", "sum of three cubes", "three cubes problem"],
  },
  {
    problemId: "riemann-hypothesis",
    name: "Riemann hypothesis",
    status: "open",
    reviewedAt: LITERATURE_REVIEWED_AT,
    summary: "The Riemann hypothesis remains an open Millennium Prize Problem.",
    scopeNote: "Computational checks of zeros are finite evidence, not a proof of the global statement.",
    verifierBoundary: VERIFIER_BOUNDARY,
    sources: [CLAY_MILLENNIUM_SOURCE],
    aliases: ["riemann hypothesis"],
  },
  {
    problemId: "p-versus-np",
    name: "P versus NP",
    status: "open",
    reviewedAt: LITERATURE_REVIEWED_AT,
    summary: "P versus NP remains an open Millennium Prize Problem.",
    scopeNote: "This complexity-theory question is outside ProofLab's polynomial certificate language.",
    verifierBoundary: VERIFIER_BOUNDARY,
    sources: [CLAY_MILLENNIUM_SOURCE],
    aliases: ["p versus np", "p vs np", "p vs. np", "p= np", "p = np"],
  },
  {
    problemId: "birch-swinnerton-dyer",
    name: "Birch and Swinnerton–Dyer conjecture",
    status: "open",
    reviewedAt: LITERATURE_REVIEWED_AT,
    summary: "The Birch and Swinnerton–Dyer conjecture remains an open Millennium Prize Problem.",
    scopeNote: "Special cases and partial results do not settle the full conjecture.",
    verifierBoundary: VERIFIER_BOUNDARY,
    sources: [CLAY_MILLENNIUM_SOURCE],
    aliases: ["birch and swinnerton-dyer", "birch and swinnerton dyer", "birch-swinnerton-dyer", "bsd conjecture"],
  },
  {
    problemId: "hodge-conjecture",
    name: "Hodge conjecture",
    status: "open",
    reviewedAt: LITERATURE_REVIEWED_AT,
    summary: "The Hodge conjecture remains an open Millennium Prize Problem.",
    scopeNote: "Known special cases do not settle the full conjecture.",
    verifierBoundary: VERIFIER_BOUNDARY,
    sources: [CLAY_MILLENNIUM_SOURCE],
    aliases: ["hodge conjecture"],
  },
  {
    problemId: "navier-stokes",
    name: "Navier–Stokes existence and smoothness",
    status: "open",
    reviewedAt: LITERATURE_REVIEWED_AT,
    summary: "The three-dimensional Navier–Stokes existence and smoothness problem remains an open Millennium Prize Problem.",
    scopeNote: "Results for restricted settings or finite simulations do not settle the full problem.",
    verifierBoundary: VERIFIER_BOUNDARY,
    sources: [CLAY_MILLENNIUM_SOURCE],
    aliases: ["navier-stokes", "navier stokes"],
  },
  {
    problemId: "yang-mills-mass-gap",
    name: "Yang–Mills existence and mass gap",
    status: "open",
    reviewedAt: LITERATURE_REVIEWED_AT,
    summary: "Yang–Mills existence and the mass gap remains an open Millennium Prize Problem.",
    scopeNote: "Physical evidence is not a rigorous construction satisfying the prize problem's mathematical requirements.",
    verifierBoundary: VERIFIER_BOUNDARY,
    sources: [CLAY_MILLENNIUM_SOURCE],
    aliases: ["yang-mills", "yang mills", "mass gap"],
  },
];

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEquation(value: string) {
  return normalizeText(value
    .replaceAll("³", "^3")
    .replaceAll("−", "-")
    .replaceAll("**", "^"))
    .replace(/\s+/g, "");
}

function isCubicFermatEquation(equation: string) {
  const normalized = normalizeEquation(equation);
  const match = normalized.match(/^([a-z_][a-z0-9_]*)\^3\+([a-z_][a-z0-9_]*)\^3=([a-z_][a-z0-9_]*)\^3$/);
  return Boolean(match && new Set(match.slice(1)).size === 3);
}

function isSumsOfThreeCubesEquation(equation: string) {
  const normalized = normalizeEquation(equation);
  const match = normalized.match(/^([a-z_][a-z0-9_]*)\^3\+([a-z_][a-z0-9_]*)\^3\+([a-z_][a-z0-9_]*)\^3=(-?\d+|[a-z_][a-z0-9_]*)$/);
  return Boolean(match && new Set(match.slice(1, 4)).size === 3);
}

function publicContext(entry: CatalogEntry): LiteratureContext {
  return {
    problemId: entry.problemId,
    name: entry.name,
    status: entry.status,
    reviewedAt: entry.reviewedAt,
    summary: entry.summary,
    scopeNote: entry.scopeNote,
    verifierBoundary: entry.verifierBoundary,
    sources: entry.sources,
  };
}

export function lookupLiteratureContext(input: LiteratureContextInput): LiteratureContext | null {
  const searchable = normalizeText(`${input.equation}\n${input.claim}\n${input.proposedArgument}`);
  const namedMatch = CATALOG.find((entry) => entry.aliases.some((alias) => searchable.includes(normalizeText(alias))));
  if (namedMatch) return publicContext(namedMatch);

  if (isCubicFermatEquation(input.equation)) {
    return publicContext(CATALOG.find((entry) => entry.problemId === "fermats-last-theorem")!);
  }
  if (isSumsOfThreeCubesEquation(input.equation)) {
    return publicContext(CATALOG.find((entry) => entry.problemId === "sums-of-three-cubes")!);
  }
  return null;
}
