import { createHash } from "node:crypto";

export const PROOFLAB_STATUSES = Object.freeze([
  "PROVED",
  "DISPROVED",
  "VERIFIED_IN_RANGE",
  "EXPERIMENTAL_EVIDENCE",
  "CONJECTURAL",
  "UNKNOWN",
]);

export const ATTACK_KINDS = Object.freeze([
  "counterexample_search",
  "boundary_values",
  "congruence_scan",
  "assumption_audit",
  "zero_division_audit",
  "scope_audit",
  "bounded_solution_search",
]);

const DEFAULT_LIMITS = Object.freeze({
  maxInputLength: 600,
  maxTerms: 10_000,
  maxExponent: 64,
  maxVariables: 8,
  maxModularAssignments: 120_000,
  maxBoundedAssignments: 80_000,
});

export const CERTIFICATE_VERSION = 2;
export const OBLIGATION_SCHEMA_VERSION = "prooflab-obligation-1";
export const VERIFIER_ENGINE_VERSION = "prooflab-verifier-2.0.0";

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export class ProofLabError extends Error {
  constructor(message, code = "INVALID_INPUT") {
    super(message);
    this.name = "ProofLabError";
    this.code = code;
  }
}

function mergeLimits(limits = {}) {
  return { ...DEFAULT_LIMITS, ...limits };
}

function normalizeMathInput(raw) {
  if (typeof raw !== "string") {
    throw new ProofLabError("Mathematical input must be a string.");
  }
  return raw
    .trim()
    .replaceAll("\u2212", "-")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2014", "-")
    .replaceAll("\u00d7", "*")
    .replaceAll("\u00b7", "*")
    .replace(/\\(?:cdot|times)/g, "*")
    .replace(/\\left|\\right/g, "")
    .replace(/[{}]/g, (m) => (m === "{" ? "(" : ")"))
    .replaceAll("\u00b2", "^2")
    .replaceAll("\u00b3", "^3")
    .replaceAll("**", "^")
    .replaceAll("$", "");
}

function tokenize(raw, limits) {
  const input = normalizeMathInput(raw);
  if (!input) throw new ProofLabError("Expression is empty.");
  if (input.length > limits.maxInputLength) {
    throw new ProofLabError(`Expression exceeds ${limits.maxInputLength} characters.`, "INPUT_TOO_LONG");
  }

  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/\d/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /\d/.test(input[j])) j += 1;
      tokens.push({ type: "number", value: input.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j += 1;
      tokens.push({ type: "identifier", value: input.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*^()".includes(ch)) {
      const type = ch === "(" ? "lparen" : ch === ")" ? "rparen" : "operator";
      tokens.push({ type, value: ch });
      i += 1;
      continue;
    }
    if (ch === "/") {
      throw new ProofLabError(
        "Division is outside ProofLab's polynomial certificate language. Clear denominators explicitly or use a polynomial equation.",
        "UNSUPPORTED_DIVISION",
      );
    }
    throw new ProofLabError(`Unsupported character “${ch}” in expression.`, "UNSUPPORTED_CHARACTER");
  }

  const withImplicitMultiplication = [];
  const canEndFactor = (t) => t && ["number", "identifier", "rparen"].includes(t.type);
  const canStartFactor = (t) => t && ["number", "identifier", "lparen"].includes(t.type);
  for (const token of tokens) {
    const previous = withImplicitMultiplication.at(-1);
    if (canEndFactor(previous) && canStartFactor(token)) {
      withImplicitMultiplication.push({ type: "operator", value: "*" });
    }
    withImplicitMultiplication.push(token);
  }
  return withImplicitMultiplication;
}

function keyFromExponents(exponents) {
  return [...exponents.entries()]
    .filter(([, exponent]) => exponent !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, exponent]) => `${name}:${exponent}`)
    .join("|");
}

function exponentsFromKey(key) {
  const out = new Map();
  if (!key) return out;
  for (const part of key.split("|")) {
    const split = part.lastIndexOf(":");
    out.set(part.slice(0, split), Number(part.slice(split + 1)));
  }
  return out;
}

function clonePolynomial(poly) {
  return new Map(poly);
}

function compactPolynomial(poly) {
  for (const [key, coefficient] of poly) {
    if (coefficient === 0n) poly.delete(key);
  }
  return poly;
}

function enforceTermBudget(poly, limits) {
  if (poly.size > limits.maxTerms) {
    throw new ProofLabError(
      `Symbolic expansion exceeded the ${limits.maxTerms}-term safety budget.`,
      "TERM_BUDGET_EXCEEDED",
    );
  }
  return poly;
}

function constantPolynomial(value) {
  const coefficient = BigInt(value);
  return coefficient === 0n ? new Map() : new Map([["", coefficient]]);
}

function variablePolynomial(name) {
  if (!IDENTIFIER_RE.test(name)) throw new ProofLabError(`Invalid variable name “${name}”.`);
  return new Map([[`${name}:1`, 1n]]);
}

function addPolynomials(a, b, limits) {
  const out = clonePolynomial(a);
  for (const [key, coefficient] of b) {
    out.set(key, (out.get(key) ?? 0n) + coefficient);
  }
  return enforceTermBudget(compactPolynomial(out), limits);
}

function negatePolynomial(poly) {
  return new Map([...poly.entries()].map(([key, coefficient]) => [key, -coefficient]));
}

function subtractPolynomials(a, b, limits) {
  return addPolynomials(a, negatePolynomial(b), limits);
}

function multiplyMonomialKeys(aKey, bKey, limits) {
  const exponents = exponentsFromKey(aKey);
  for (const [name, exponent] of exponentsFromKey(bKey)) {
    const next = (exponents.get(name) ?? 0) + exponent;
    if (next > limits.maxExponent) {
      throw new ProofLabError(
        `Exponent of ${name} exceeds the ${limits.maxExponent} safety limit.`,
        "EXPONENT_TOO_LARGE",
      );
    }
    exponents.set(name, next);
  }
  return keyFromExponents(exponents);
}

function multiplyPolynomials(a, b, limits) {
  if (a.size === 0 || b.size === 0) return new Map();
  const out = new Map();
  for (const [aKey, aCoefficient] of a) {
    for (const [bKey, bCoefficient] of b) {
      const key = multiplyMonomialKeys(aKey, bKey, limits);
      out.set(key, (out.get(key) ?? 0n) + aCoefficient * bCoefficient);
    }
  }
  return enforceTermBudget(compactPolynomial(out), limits);
}

function powerPolynomial(base, exponent, limits) {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > limits.maxExponent) {
    throw new ProofLabError(
      `Exponent must be an integer between 0 and ${limits.maxExponent}.`,
      "INVALID_EXPONENT",
    );
  }
  let result = constantPolynomial(1n);
  let factor = base;
  let n = exponent;
  while (n > 0) {
    if (n % 2 === 1) result = multiplyPolynomials(result, factor, limits);
    n = Math.floor(n / 2);
    if (n > 0) factor = multiplyPolynomials(factor, factor, limits);
  }
  return result;
}

class PolynomialParser {
  constructor(tokens, limits) {
    this.tokens = tokens;
    this.index = 0;
    this.limits = limits;
  }

  peek() {
    return this.tokens[this.index];
  }

  consume(type, value) {
    const token = this.peek();
    if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
      const expected = value === undefined ? type : `“${value}”`;
      const found = token ? `“${token.value}”` : "end of input";
      throw new ProofLabError(`Expected ${expected}, found ${found}.`, "PARSE_ERROR");
    }
    this.index += 1;
    return token;
  }

  parse() {
    const result = this.parseAdditive();
    if (this.peek()) {
      throw new ProofLabError(`Unexpected token “${this.peek().value}”.`, "PARSE_ERROR");
    }
    return result;
  }

  parseAdditive() {
    let value = this.parseMultiplicative();
    while (this.peek()?.type === "operator" && ["+", "-"].includes(this.peek().value)) {
      const operator = this.consume("operator").value;
      const right = this.parseMultiplicative();
      value = operator === "+"
        ? addPolynomials(value, right, this.limits)
        : subtractPolynomials(value, right, this.limits);
    }
    return value;
  }

  parseMultiplicative() {
    let value = this.parseUnary();
    while (this.peek()?.type === "operator" && this.peek().value === "*") {
      this.consume("operator", "*");
      value = multiplyPolynomials(value, this.parseUnary(), this.limits);
    }
    return value;
  }

  parseUnary() {
    if (this.peek()?.type === "operator" && this.peek().value === "+") {
      this.consume("operator", "+");
      return this.parseUnary();
    }
    if (this.peek()?.type === "operator" && this.peek().value === "-") {
      this.consume("operator", "-");
      return negatePolynomial(this.parseUnary());
    }
    return this.parsePower();
  }

  parsePower() {
    let value = this.parsePrimary();
    if (this.peek()?.type === "operator" && this.peek().value === "^") {
      this.consume("operator", "^");
      const exponentToken = this.consume("number");
      const exponent = Number(exponentToken.value);
      value = powerPolynomial(value, exponent, this.limits);
    }
    return value;
  }

  parsePrimary() {
    const token = this.peek();
    if (!token) throw new ProofLabError("Unexpected end of expression.", "PARSE_ERROR");
    if (token.type === "number") {
      this.index += 1;
      return constantPolynomial(BigInt(token.value));
    }
    if (token.type === "identifier") {
      this.index += 1;
      return variablePolynomial(token.value);
    }
    if (token.type === "lparen") {
      this.consume("lparen", "(");
      const value = this.parseAdditive();
      this.consume("rparen", ")");
      return value;
    }
    throw new ProofLabError(`Unexpected token “${token.value}”.`, "PARSE_ERROR");
  }
}

export function parsePolynomial(raw, options = {}) {
  const limits = mergeLimits(options.limits);
  const poly = new PolynomialParser(tokenize(raw, limits), limits).parse();
  const variables = polynomialVariables(poly);
  if (variables.length > limits.maxVariables) {
    throw new ProofLabError(
      `Expression has ${variables.length} variables; the safety limit is ${limits.maxVariables}.`,
      "TOO_MANY_VARIABLES",
    );
  }
  return poly;
}

export function parseEquation(raw, options = {}) {
  const normalized = normalizeMathInput(raw);
  const parts = normalized.split("=");
  if (parts.length > 2) throw new ProofLabError("Equation contains more than one equals sign.");
  const left = parsePolynomial(parts[0], options);
  const right = parts.length === 2 ? parsePolynomial(parts[1], options) : constantPolynomial(0n);
  return subtractPolynomials(left, right, mergeLimits(options.limits));
}

export function polynomialVariables(poly) {
  const variables = new Set();
  for (const key of poly.keys()) {
    for (const name of exponentsFromKey(key).keys()) variables.add(name);
  }
  return [...variables].sort();
}

export function isZeroPolynomial(poly) {
  return poly.size === 0;
}

function totalDegreeForKey(key) {
  let total = 0;
  for (const exponent of exponentsFromKey(key).values()) total += exponent;
  return total;
}

export function polynomialToString(poly) {
  if (isZeroPolynomial(poly)) return "0";
  const terms = [...poly.entries()].sort(([aKey], [bKey]) => {
    const degreeDiff = totalDegreeForKey(bKey) - totalDegreeForKey(aKey);
    return degreeDiff || aKey.localeCompare(bKey);
  });

  const pieces = [];
  for (const [key, coefficient] of terms) {
    const negative = coefficient < 0n;
    const absolute = negative ? -coefficient : coefficient;
    const factors = [...exponentsFromKey(key).entries()].map(([name, exponent]) =>
      exponent === 1 ? name : `${name}^${exponent}`,
    );
    let body;
    if (factors.length === 0) body = absolute.toString();
    else if (absolute === 1n) body = factors.join("*");
    else body = `${absolute}*${factors.join("*")}`;

    if (pieces.length === 0) pieces.push(negative ? `-${body}` : body);
    else pieces.push(`${negative ? " - " : " + "}${body}`);
  }
  return pieces.join("");
}

function normalizeSubstitutions(substitutions) {
  if (Array.isArray(substitutions)) {
    return Object.fromEntries(
      substitutions.map((item) => {
        if (!item || typeof item.variable !== "string" || typeof item.expression !== "string") {
          throw new ProofLabError("Each substitution requires string variable and expression fields.");
        }
        return [item.variable.trim(), item.expression.trim()];
      }),
    );
  }
  if (substitutions && typeof substitutions === "object") return substitutions;
  return {};
}

export function substitutePolynomial(poly, substitutions, options = {}) {
  const limits = mergeLimits(options.limits);
  const rawMap = normalizeSubstitutions(substitutions);
  const parsedMap = new Map();
  for (const [name, expression] of Object.entries(rawMap)) {
    if (!IDENTIFIER_RE.test(name)) throw new ProofLabError(`Invalid substitution variable “${name}”.`);
    parsedMap.set(name, parsePolynomial(expression, { limits }));
  }

  let result = new Map();
  for (const [key, coefficient] of poly) {
    let term = constantPolynomial(coefficient);
    for (const [name, exponent] of exponentsFromKey(key)) {
      const replacement = parsedMap.get(name) ?? variablePolynomial(name);
      term = multiplyPolynomials(term, powerPolynomial(replacement, exponent, limits), limits);
    }
    result = addPolynomials(result, term, limits);
  }
  return result;
}

function bigintPowMod(base, exponent, modulus) {
  let result = 1n;
  let factor = ((base % modulus) + modulus) % modulus;
  let n = BigInt(exponent);
  while (n > 0n) {
    if (n & 1n) result = (result * factor) % modulus;
    factor = (factor * factor) % modulus;
    n >>= 1n;
  }
  return result;
}

export function evaluatePolynomial(poly, assignment) {
  let result = 0n;
  for (const [key, coefficient] of poly) {
    let term = coefficient;
    for (const [name, exponent] of exponentsFromKey(key)) {
      if (!(name in assignment)) {
        throw new ProofLabError(`Missing value for variable ${name}.`, "MISSING_ASSIGNMENT");
      }
      term *= BigInt(assignment[name]) ** BigInt(exponent);
    }
    result += term;
  }
  return result;
}

function evaluatePolynomialModulo(poly, assignment, modulusNumber) {
  const modulus = BigInt(modulusNumber);
  let result = 0n;
  for (const [key, coefficient] of poly) {
    let term = ((coefficient % modulus) + modulus) % modulus;
    for (const [name, exponent] of exponentsFromKey(key)) {
      term = (term * bigintPowMod(BigInt(assignment[name]), exponent, modulus)) % modulus;
    }
    result = (result + term) % modulus;
  }
  return Number((result + modulus) % modulus);
}

function degreeInVariable(poly, variable) {
  let degree = 0;
  for (const key of poly.keys()) degree = Math.max(degree, exponentsFromKey(key).get(variable) ?? 0);
  return degree;
}

function substituteConstant(poly, variable, value, limits) {
  const out = new Map();
  const integerValue = BigInt(value);
  for (const [key, coefficient] of poly) {
    const exponents = exponentsFromKey(key);
    const exponent = exponents.get(variable) ?? 0;
    exponents.delete(variable);
    const newKey = keyFromExponents(exponents);
    const newCoefficient = coefficient * integerValue ** BigInt(exponent);
    out.set(newKey, (out.get(newKey) ?? 0n) + newCoefficient);
  }
  return enforceTermBudget(compactPolynomial(out), limits);
}

export function findGuaranteedCounterexample(poly, variables = polynomialVariables(poly), options = {}) {
  if (isZeroPolynomial(poly)) return null;
  const limits = mergeLimits(options.limits);
  let current = poly;
  const assignment = {};
  const ordered = [...new Set([...variables, ...polynomialVariables(poly)])].sort();

  for (const variable of ordered) {
    const degree = degreeInVariable(current, variable);
    if (degree === 0) {
      assignment[variable] = 0;
      continue;
    }
    let selected = null;
    for (let candidate = 0; candidate <= degree; candidate += 1) {
      const next = substituteConstant(current, variable, candidate, limits);
      if (!isZeroPolynomial(next)) {
        selected = { candidate, next };
        break;
      }
    }
    if (!selected) {
      throw new ProofLabError(
        "Internal interpolation invariant failed while constructing a counterexample.",
        "INTERNAL_INVARIANT_FAILURE",
      );
    }
    assignment[variable] = selected.candidate;
    current = selected.next;
  }

  const remaining = polynomialVariables(current);
  if (remaining.length > 0) {
    throw new ProofLabError("Counterexample construction left unassigned variables.", "INTERNAL_INVARIANT_FAILURE");
  }
  const value = current.get("") ?? 0n;
  if (value === 0n) {
    throw new ProofLabError("Constructed counterexample unexpectedly evaluates to zero.", "INTERNAL_INVARIANT_FAILURE");
  }
  return { assignment, residualValue: value.toString() };
}

function enumerateAssignments(variables, values, callback, budget) {
  let checked = 0;
  const assignment = {};
  const visit = (index) => {
    if (checked >= budget) return { stopped: true, value: null };
    if (index === variables.length) {
      checked += 1;
      const result = callback({ ...assignment });
      if (result) return { stopped: true, value: result };
      return { stopped: false, value: null };
    }
    const variable = variables[index];
    for (const value of values) {
      assignment[variable] = value;
      const result = visit(index + 1);
      if (result.stopped) return result;
    }
    return { stopped: false, value: null };
  };
  const result = visit(0);
  return { checked, found: result.value, exhausted: checked < budget || !result.stopped };
}

export function findCongruenceObstruction(poly, options = {}) {
  const limits = mergeLimits(options.limits);
  const variables = polynomialVariables(poly);
  const moduli = options.moduli ?? [2, 3, 4, 5, 7, 8, 9, 11, 13, 16, 24, 25];
  const checkedModuli = [];

  for (const modulus of moduli) {
    const combinations = modulus ** variables.length;
    if (!Number.isSafeInteger(combinations) || combinations > limits.maxModularAssignments) continue;
    checkedModuli.push(modulus);
    const values = Array.from({ length: modulus }, (_, index) => index);
    const outcome = enumerateAssignments(
      variables,
      values,
      (assignment) => (evaluatePolynomialModulo(poly, assignment, modulus) === 0 ? assignment : null),
      limits.maxModularAssignments,
    );
    if (!outcome.found) {
      return {
        modulus,
        variables,
        assignmentsChecked: outcome.checked,
        checkedModuli,
      };
    }
  }
  return { modulus: null, variables, assignmentsChecked: 0, checkedModuli };
}

export function searchBoundedSolution(poly, bound = 5, options = {}) {
  const limits = mergeLimits(options.limits);
  const variables = polynomialVariables(poly);
  const values = Array.from({ length: 2 * bound + 1 }, (_, index) => index - bound);
  const combinations = values.length ** variables.length;
  if (!Number.isSafeInteger(combinations) || combinations > limits.maxBoundedAssignments) {
    return {
      found: null,
      checked: 0,
      complete: false,
      reason: `The requested box contains ${combinations.toLocaleString()} assignments, above the safety budget.`,
    };
  }
  const outcome = enumerateAssignments(
    variables,
    values,
    (assignment) => (evaluatePolynomial(poly, assignment) === 0n ? assignment : null),
    limits.maxBoundedAssignments,
  );
  return {
    found: outcome.found,
    checked: outcome.checked,
    complete: true,
    bound,
    variables,
  };
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function attachCertificateHash(payload) {
  const versionedPayload = {
    ...payload,
    version: CERTIFICATE_VERSION,
    schemaVersion: OBLIGATION_SCHEMA_VERSION,
    verifierVersion: VERIFIER_ENGINE_VERSION,
    createdAt: new Date().toISOString(),
    canonicalInput: {
      normalizedEquation: typeof payload.equation === "string"
        ? `${polynomialToString(parseEquation(payload.equation))} = 0`
        : null,
    },
  };
  return {
    ...versionedPayload,
    certificateHash: createHash("sha256").update(stableStringify(versionedPayload)).digest("hex"),
  };
}

function proofResult(status, title, summary, details = {}) {
  if (!PROOFLAB_STATUSES.includes(status)) throw new ProofLabError(`Invalid verifier status ${status}.`);
  return {
    status,
    title,
    summary,
    verifierControlled: true,
    ...details,
  };
}

function normalizeAssignment(assignment) {
  if (Array.isArray(assignment)) {
    return Object.fromEntries(assignment.map(({ variable, value }) => [variable, value]));
  }
  return assignment && typeof assignment === "object" ? assignment : {};
}

function verifyParametricIdentity(obligation, options) {
  const equationPoly = parseEquation(obligation.equation, options);
  const substitutions = normalizeSubstitutions(obligation.substitutions);
  if (Object.keys(substitutions).length === 0) {
    return proofResult("UNKNOWN", "No machine-checkable substitutions", "GPT-5.6 did not extract a substitution map that ProofLab can verify.", {
      certificate: null,
      residual: polynomialToString(equationPoly),
    });
  }

  const parameterSet = new Set(Array.isArray(obligation.parameters) ? obligation.parameters : []);
  const substitutionTargets = new Set(Object.keys(substitutions));
  const dependentSubstitutions = [];
  for (const [target, expression] of Object.entries(substitutions)) {
    const dependencies = polynomialVariables(parsePolynomial(expression, options))
      .filter((variable) => substitutionTargets.has(variable));
    if (dependencies.length > 0) dependentSubstitutions.push({ target, dependencies });
  }
  if (dependentSubstitutions.length > 0) {
    return proofResult(
      "UNKNOWN",
      "Dependent substitution formulas are not supported",
      "A target-variable formula refers to another target variable. Rewrite every formula directly in the independent parameters before requesting a certificate.",
      { certificate: null, dependentSubstitutions },
    );
  }

  const missingTargets = polynomialVariables(equationPoly).filter(
    (variable) => !parameterSet.has(variable) && !(variable in substitutions),
  );
  if (missingTargets.length > 0) {
    return proofResult(
      "UNKNOWN",
      "Incomplete parameterization",
      `No formula was extracted for ${missingTargets.join(", ")}. ProofLab will not treat unspecified equation variables as free parameters.`,
      { certificate: null, missingTargets },
    );
  }

  const residual = substitutePolynomial(equationPoly, substitutions, options);
  const residualText = polynomialToString(residual);
  const residualVariables = polynomialVariables(residual);
  const assumptions = Array.isArray(obligation.assumptions) ? obligation.assumptions.filter(Boolean) : [];

  if (isZeroPolynomial(residual)) {
    const certificate = attachCertificateHash({
      version: 1,
      verifier: "symbolic_identity_v1",
      status: "PROVED",
      equation: obligation.equation,
      substitutions,
      residual: "0",
      residualVariables,
      scope: "The supplied formulas satisfy the equation identically for every integer assignment of the remaining parameters.",
    });
    return proofResult("PROVED", "Exact polynomial identity verified", "After exact substitution and expansion, the residual is identically zero.", {
      residual: "0",
      counterexample: null,
      certificate,
      scope: certificate.scope,
      caveat: "This proves that the formulas produce solutions; it does not prove that they parameterize every solution.",
    });
  }

  const counterexample = findGuaranteedCounterexample(residual, residualVariables, options);
  const certificate = attachCertificateHash({
    version: 1,
    verifier: "symbolic_identity_v1",
    status: assumptions.length === 0 ? "DISPROVED" : "UNKNOWN",
    equation: obligation.equation,
    substitutions,
    residual: residualText,
    residualVariables,
    counterexample,
    assumptions,
    scope: assumptions.length === 0
      ? "The universal polynomial identity is false."
      : "The unrestricted identity is false, but the stated assumptions were not machine-interpreted.",
  });

  if (assumptions.length > 0) {
    return proofResult("UNKNOWN", "Nonzero residual under unverified assumptions", "The formulas are not an unrestricted identity, but ProofLab cannot decide whether the extracted assumptions exclude the counterexample.", {
      residual: residualText,
      counterexample,
      certificate,
      scope: certificate.scope,
      caveat: "Rewrite the assumptions as machine-checkable polynomial constraints before claiming a disproof.",
    });
  }

  return proofResult("DISPROVED", "Claim refuted exactly", "Exact substitution leaves a nonzero polynomial residual, and a certified integer counterexample was constructed.", {
    residual: residualText,
    counterexample,
    certificate,
    scope: certificate.scope,
  });
}

function verifyNoIntegerSolutions(obligation, options) {
  const equationPoly = parseEquation(obligation.equation, options);
  if (isZeroPolynomial(equationPoly)) {
    return proofResult("DISPROVED", "The equation is an identity", "Every integer assignment satisfies the normalized equation 0 = 0.", {
      certificate: attachCertificateHash({
        version: 1,
        verifier: "constant_equation_v1",
        status: "DISPROVED",
        equation: obligation.equation,
        normalizedResidual: "0",
      }),
      counterexample: {},
    });
  }

  const obstruction = findCongruenceObstruction(equationPoly, options);
  if (obstruction.modulus !== null) {
    const certificate = attachCertificateHash({
      version: 1,
      verifier: "congruence_obstruction_v1",
      status: "PROVED",
      equation: obligation.equation,
      normalizedResidual: polynomialToString(equationPoly),
      modulus: obstruction.modulus,
      variables: obstruction.variables,
      assignmentsChecked: obstruction.assignmentsChecked,
      scope: `No residue assignment solves the equation modulo ${obstruction.modulus}; therefore no integer solution exists.`,
    });
    return proofResult("PROVED", `Congruence obstruction modulo ${obstruction.modulus}`, certificate.scope, {
      certificate,
      obstruction,
      scope: certificate.scope,
    });
  }

  const bounded = searchBoundedSolution(equationPoly, 5, options);
  const assumptions = Array.isArray(obligation.assumptions) ? obligation.assumptions.filter(Boolean) : [];
  if (bounded.found && assumptions.length === 0) {
    const certificate = attachCertificateHash({
      version: 1,
      verifier: "exact_assignment_v1",
      status: "DISPROVED",
      equation: obligation.equation,
      assignment: bounded.found,
      residualValue: "0",
    });
    return proofResult("DISPROVED", "An exact integer solution was found", "The non-existence claim is false.", {
      counterexample: bounded.found,
      certificate,
      boundedSearch: bounded,
    });
  }

  if (bounded.found && assumptions.length > 0) {
    return proofResult(
      "UNKNOWN",
      "A solution exists, but side conditions are unverified",
      "The equation has an exact integer solution in the tested box, but ProofLab cannot determine whether it satisfies the extracted side conditions.",
      { certificate: null, candidateSolution: bounded.found, assumptions, boundedSearch: bounded },
    );
  }

  return proofResult("UNKNOWN", "No small congruence obstruction found", "The tested moduli do not prove impossibility, and no solution was found in the small bounded check. Neither fact settles the equation globally.", {
    certificate: null,
    obstruction,
    boundedSearch: bounded,
    scope: "No global conclusion.",
  });
}

function verifyAssignmentClaim(obligation, options) {
  const equationPoly = parseEquation(obligation.equation, options);
  const assignment = normalizeAssignment(obligation.assignment);
  const variables = polynomialVariables(equationPoly);
  for (const variable of variables) {
    if (!(variable in assignment)) {
      return proofResult("UNKNOWN", "Incomplete assignment", `A value for ${variable} is missing.`, { certificate: null });
    }
  }

  const value = evaluatePolynomial(equationPoly, assignment);
  const assumptions = Array.isArray(obligation.assumptions) ? obligation.assumptions.filter(Boolean) : [];
  if (value !== 0n) {
    const certificate = attachCertificateHash({
      version: 1,
      verifier: "exact_assignment_v1",
      status: "DISPROVED",
      equation: obligation.equation,
      assignment,
      residualValue: value.toString(),
    });
    return proofResult(
      "DISPROVED",
      "Assignment is not a solution",
      `Exact integer evaluation gives residual ${value}.`,
      { certificate, residualValue: value.toString(), assignment },
    );
  }

  if (assumptions.length > 0) {
    return proofResult(
      "UNKNOWN",
      "Equation satisfied; side conditions unverified",
      "The concrete assignment satisfies the polynomial equation exactly, but ProofLab cannot certify the extracted side conditions.",
      {
        certificate: null,
        residualValue: "0",
        assignment,
        assumptions,
        scope: "The equation check is exact; the full side-conditioned claim remains unresolved.",
      },
    );
  }

  const certificate = attachCertificateHash({
    version: 1,
    verifier: "exact_assignment_v1",
    status: "PROVED",
    equation: obligation.equation,
    assignment,
    residualValue: "0",
  });
  return proofResult(
    "PROVED",
    "Exact solution verified",
    "Exact integer evaluation gives residual 0.",
    { certificate, residualValue: "0", assignment, scope: "The supplied integer assignment satisfies the equation." },
  );
}

export function verifyClaim(obligation, options = {}) {
  if (!obligation || typeof obligation !== "object") throw new ProofLabError("Proof obligation is missing.");
  if (typeof obligation.equation !== "string" || !obligation.equation.trim()) {
    throw new ProofLabError("A non-empty equation is required.");
  }
  const normalized = {
    ...obligation,
    claimType: obligation.claimType ?? obligation.claim_type ?? "unsupported",
  };

  // The verifier intentionally ignores any status or truth value proposed by the model.
  switch (normalized.claimType) {
    case "parametric_identity":
      return verifyParametricIdentity(normalized, options);
    case "no_integer_solutions":
      return verifyNoIntegerSolutions(normalized, options);
    case "verify_assignment":
      return verifyAssignmentClaim(normalized, options);
    default:
      return proofResult("UNKNOWN", "Unsupported claim type", "GPT-5.6 could not translate this claim into one of ProofLab's deterministic verifier languages.", {
        certificate: null,
        supportedClaimTypes: ["parametric_identity", "no_integer_solutions", "verify_assignment"],
      });
  }
}

function mandatoryAttackKinds(obligation) {
  switch (obligation.claimType) {
    case "parametric_identity":
      return ["counterexample_search", "boundary_values", "assumption_audit", "zero_division_audit", "scope_audit"];
    case "no_integer_solutions":
      return ["congruence_scan", "bounded_solution_search", "assumption_audit", "scope_audit"];
    case "verify_assignment":
      return ["boundary_values", "scope_audit"];
    default:
      return ["assumption_audit", "scope_audit"];
  }
}

function runBoundaryValues(obligation, verification, options) {
  if (obligation.claimType !== "parametric_identity") {
    return { kind: "boundary_values", outcome: "NOT_APPLICABLE", detail: "Boundary evaluation is implemented for parametric identities." };
  }
  const equationPoly = parseEquation(obligation.equation, options);
  const residual = substitutePolynomial(equationPoly, obligation.substitutions, options);
  if (isZeroPolynomial(residual)) {
    return { kind: "boundary_values", outcome: "PASSED", detail: "The exact residual is zero, so all boundary values are already covered by the symbolic proof." };
  }
  const variables = polynomialVariables(residual);
  const values = [-2, -1, 0, 1, 2];
  const outcome = enumerateAssignments(
    variables,
    values,
    (assignment) => {
      const value = evaluatePolynomial(residual, assignment);
      return value !== 0n ? { assignment, residualValue: value.toString() } : null;
    },
    mergeLimits(options.limits).maxBoundedAssignments,
  );
  if (outcome.found) {
    return { kind: "boundary_values", outcome: "FOUND_ISSUE", detail: "A small boundary value refutes the identity.", evidence: outcome.found };
  }
  return { kind: "boundary_values", outcome: "INCONCLUSIVE", detail: `No failure appeared in ${outcome.checked} tested boundary assignments, but the residual is nonzero.` };
}

function runAttackKind(kind, obligation, verification, proposedArgument, options) {
  switch (kind) {
    case "counterexample_search": {
      if (obligation.claimType !== "parametric_identity") {
        return { kind, outcome: "NOT_APPLICABLE", detail: "Guaranteed polynomial counterexample construction applies to parametric identities." };
      }
      const equationPoly = parseEquation(obligation.equation, options);
      const residual = substitutePolynomial(equationPoly, obligation.substitutions, options);
      if (isZeroPolynomial(residual)) {
        return { kind, outcome: "PASSED", detail: "The residual is identically zero; no counterexample exists within the polynomial model." };
      }
      const counterexample = findGuaranteedCounterexample(residual, polynomialVariables(residual), options);
      return { kind, outcome: "FOUND_ISSUE", detail: "A deterministic interpolation argument constructed an exact counterexample.", evidence: counterexample };
    }
    case "boundary_values":
      return runBoundaryValues(obligation, verification, options);
    case "congruence_scan": {
      const equationPoly = parseEquation(obligation.equation, options);
      const obstruction = findCongruenceObstruction(equationPoly, options);
      return obstruction.modulus === null
        ? { kind, outcome: "INCONCLUSIVE", detail: `No obstruction was found for moduli ${obstruction.checkedModuli.join(", ") || "within budget"}.` }
        : { kind, outcome: "PASSED", detail: `A complete residue check proves impossibility modulo ${obstruction.modulus}.`, evidence: obstruction };
    }
    case "assumption_audit": {
      const assumptions = Array.isArray(obligation.assumptions) ? obligation.assumptions.filter(Boolean) : [];
      return assumptions.length === 0
        ? { kind, outcome: "PASSED", detail: "No extra assumptions were extracted." }
        : { kind, outcome: "INCONCLUSIVE", detail: "These assumptions are displayed but not machine-checked.", evidence: assumptions };
    }
    case "zero_division_audit": {
      const text = String(proposedArgument ?? "");
      const suspicious = /\/|divide(?:d|s|ing)?\s+by|denominator|cancel(?:led|s|ing)?/i.test(text);
      return suspicious
        ? { kind, outcome: "FOUND_ISSUE", detail: "The prose appears to divide or cancel. ProofLab's polynomial certificate does not validate nonzero-denominator side conditions." }
        : { kind, outcome: "PASSED", detail: "No division or cancellation was detected in the supplied argument." };
    }
    case "scope_audit": {
      if (obligation.claimType === "parametric_identity" && verification.status === "PROVED") {
        return { kind, outcome: "PASSED", detail: "The certificate proves only that the formulas produce solutions, not that every solution arises from them." };
      }
      if (verification.status === "VERIFIED_IN_RANGE") {
        return { kind, outcome: "FOUND_ISSUE", detail: "A bounded computation must not be described as a global theorem." };
      }
      return { kind, outcome: "PASSED", detail: "The displayed conclusion is no stronger than its deterministic certificate." };
    }
    case "bounded_solution_search": {
      const equationPoly = parseEquation(obligation.equation, options);
      const bounded = searchBoundedSolution(equationPoly, 6, options);
      if (bounded.found) {
        return { kind, outcome: "FOUND_ISSUE", detail: "An exact solution refutes the non-existence claim.", evidence: bounded.found };
      }
      return bounded.complete
        ? { kind, outcome: "INCONCLUSIVE", detail: `No solution occurred in the complete box [-6, 6]^${bounded.variables.length} (${bounded.checked} assignments). This is not a global proof.` }
        : { kind, outcome: "INCONCLUSIVE", detail: bounded.reason };
    }
    default:
      return { kind, outcome: "NOT_APPLICABLE", detail: "Unknown attack type was ignored." };
  }
}

export function runAdversarialChecks({
  obligation,
  verification,
  proposedArgument = "",
  proposedAttacks = /** @type {Array<string | { kind?: string }>} */ ([]),
}, options = {}) {
  const modelKinds = proposedAttacks
    .map((attack) => (typeof attack === "string" ? attack : attack?.kind))
    .filter((kind) => ATTACK_KINDS.includes(kind));
  const kinds = [...new Set([...mandatoryAttackKinds(obligation), ...modelKinds])];
  const checks = kinds.map((kind) => runAttackKind(kind, obligation, verification, proposedArgument, options));
  const issueCount = checks.filter((check) => check.outcome === "FOUND_ISSUE").length;
  const inconclusiveCount = checks.filter((check) => check.outcome === "INCONCLUSIVE").length;
  return {
    checks,
    summary: issueCount > 0
      ? `${issueCount} adversarial check${issueCount === 1 ? "" : "s"} found a concrete issue.`
      : inconclusiveCount > 0
        ? `No concrete contradiction was found, but ${inconclusiveCount} check${inconclusiveCount === 1 ? " remains" : "s remain"} inconclusive.`
        : "All applicable adversarial checks passed within their stated scope.",
    issueCount,
    inconclusiveCount,
  };
}

export function replayCertificate(certificate, options = {}) {
  if (!certificate || typeof certificate !== "object") return { valid: false, reason: "Certificate is missing." };
  const { certificateHash, ...payload } = certificate;
  const expectedHash = createHash("sha256").update(stableStringify(payload)).digest("hex");
  if (certificateHash !== expectedHash) return { valid: false, reason: "Certificate hash mismatch." };

  try {
    if (certificate.version === CERTIFICATE_VERSION) {
      if (certificate.schemaVersion !== OBLIGATION_SCHEMA_VERSION) {
        return { valid: false, reason: "Unsupported obligation schema version." };
      }
      if (certificate.verifierVersion !== VERIFIER_ENGINE_VERSION) {
        return { valid: false, reason: "Unsupported verifier engine version." };
      }
      const normalizedEquation = typeof certificate.equation === "string"
        ? `${polynomialToString(parseEquation(certificate.equation, options))} = 0`
        : null;
      if (certificate.canonicalInput?.normalizedEquation !== normalizedEquation) {
        return { valid: false, reason: "Canonical input does not match the certificate equation." };
      }
      if (Number.isNaN(Date.parse(certificate.createdAt))) {
        return { valid: false, reason: "Certificate timestamp is invalid." };
      }
    } else if (certificate.version !== 1) {
      return { valid: false, reason: `Unsupported certificate version ${certificate.version}.` };
    }

    if (certificate.verifier === "symbolic_identity_v1") {
      const equationPoly = parseEquation(certificate.equation, options);
      const residual = substitutePolynomial(equationPoly, certificate.substitutions, options);
      const residualText = polynomialToString(residual);
      if (residualText !== certificate.residual) return { valid: false, reason: "Residual does not replay." };
      if (certificate.status === "PROVED" && !isZeroPolynomial(residual)) return { valid: false, reason: "Proved certificate has nonzero residual." };
      if (certificate.status === "DISPROVED") {
        if (isZeroPolynomial(residual)) return { valid: false, reason: "Disproved certificate has zero residual." };
        const value = evaluatePolynomial(residual, certificate.counterexample.assignment);
        if (value === 0n || value.toString() !== certificate.counterexample.residualValue) {
          return { valid: false, reason: "Counterexample does not replay." };
        }
      }
      return { valid: true };
    }

    if (certificate.verifier === "congruence_obstruction_v1") {
      const equationPoly = parseEquation(certificate.equation, options);
      const replay = findCongruenceObstruction(equationPoly, { ...options, moduli: [certificate.modulus] });
      return replay.modulus === certificate.modulus
        ? { valid: true }
        : { valid: false, reason: "Modular obstruction does not replay." };
    }

    if (certificate.verifier === "exact_assignment_v1") {
      const equationPoly = parseEquation(certificate.equation, options);
      const value = evaluatePolynomial(equationPoly, certificate.assignment);
      return value.toString() === certificate.residualValue
        ? { valid: true }
        : { valid: false, reason: "Assignment residual does not replay." };
    }

    if (certificate.verifier === "constant_equation_v1") {
      const equationPoly = parseEquation(certificate.equation, options);
      return polynomialToString(equationPoly) === certificate.normalizedResidual
        ? { valid: true }
        : { valid: false, reason: "Constant equation does not replay." };
    }

    return { valid: false, reason: `Unknown verifier ${certificate.verifier}.` };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : "Certificate replay failed." };
  }
}

export function buildEvidenceLedger(
  obligation,
  verification,
  options = /** @type {{ interpreter?: string }} */ ({}),
) {
  const interpreter = options.interpreter ?? "GPT-5.6";
  const rows = [
    {
      step: "Claim interpretation",
      method: `${interpreter} structured extraction`,
      result: obligation.claimType,
      scope: "Interpretive only — cannot assign proof status",
    },
  ];

  if (verification.residual !== undefined) {
    rows.push({
      step: "Exact substitution",
      method: "Deterministic polynomial arithmetic over ℤ",
      result: `Residual: ${verification.residual}`,
      scope: verification.residual === "0" ? "Global polynomial identity" : "Exact symbolic refutation data",
    });
  }
  if (verification.residualValue !== undefined) {
    rows.push({
      step: "Exact assignment",
      method: "Deterministic integer evaluation",
      result: `Residual: ${verification.residualValue}`,
      scope: verification.residualValue === "0"
        ? "The supplied assignment satisfies the polynomial equation"
        : "The supplied assignment does not satisfy the polynomial equation",
    });
  }
  if (verification.obstruction?.modulus) {
    rows.push({
      step: "Local obstruction",
      method: `Complete residue enumeration modulo ${verification.obstruction.modulus}`,
      result: `${verification.obstruction.assignmentsChecked} residue assignments checked`,
      scope: "Global non-existence over the integers",
    });
  }
  if (verification.counterexample) {
    rows.push({
      step: "Counterexample",
      method: "Exact integer evaluation",
      result: JSON.stringify(verification.counterexample),
      scope: "One counterexample disproves a universal claim",
    });
  }
  rows.push({
    step: "Final classification",
    method: "ProofLab deterministic status policy",
    result: verification.status,
    scope: verification.scope ?? "As stated in the result",
  });
  return rows;
}
