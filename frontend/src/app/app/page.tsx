"use client";
import "./solver.css";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useI18n, LANG_OPTIONS } from "@/hooks/useI18n";
import { I18N } from "@/lib/i18n-translations";
import Link from "next/link";
import InsightPanel from "@/components/InsightPanel";

/* ── SVG icon components ─────────────────────────────────────────────────── */
const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
  </svg>
);
const PlayIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21"/>
  </svg>
);
const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="18" height="18"/>
  </svg>
);
const DiceIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/>
    <circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/>
    <circle cx="16" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
  </svg>
);
const PinIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const LinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);
const DownloadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const GithubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.17c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.31-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 0z"/>
  </svg>
);
const TypeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4,7 4,4 20,4 20,7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
);
const TrophyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="8,21 12,17 16,21"/><line x1="12" y1="17" x2="12" y2="11"/>
    <path d="M7 4H17l-1 7a5 5 0 0 1-8 0L7 4z"/>
    <path d="M17 4h2a2 2 0 0 1 2 2v1a5 5 0 0 1-5 4.9"/><path d="M7 4H5a2 2 0 0 0-2 2v1a5 5 0 0 0 5 4.9"/>
  </svg>
);
const LightbulbIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/>
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
);
const ResetIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
  </svg>
);
const CoffeeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
    <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
  </svg>
);

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Solution  { n: string | number; x: string | number; y: string | number; }
interface ArithObs  { icon: string; text: string; }
interface ProofResult {
  ok: boolean;
  proved?: boolean;
  type?: string;
  modulus?: number | null;
  is_weierstrass?: boolean;
  lhs_residues?: number[];
  rhs_residues?: number[];
  variables?: string[];
  steps?: string[];
  conclusion?: string;
  reason?: string;
  message?: string;
  suggestion?: string;
  error?: string;
}
interface DemographicRow { country: string; count: number; }

/* ── Arithmetic observation engine (client-side, no backend call) ──────── */
function computeArithObs(solutions: Solution[], expr: string, isEllipticMode: boolean): ArithObs[] {
  if (!solutions.length) return [];

  /* local fraction helpers */
  function parseFrac(v: string | number): { num: number; den: number } | null {
    if (typeof v === "number") return { num: v, den: 1 };
    const s = String(v).trim();
    if (/^-?\d+$/.test(s)) return { num: parseInt(s, 10), den: 1 };
    const m = s.match(/^(-?\d+)\/(\d+)$/);
    if (m) return { num: parseInt(m[1], 10), den: parseInt(m[2], 10) };
    return null;
  }
  const isInt = (v: string | number) => { const f = parseFrac(v); return f !== null && f.den === 1; };
  const toFlt = (v: string | number): number | null => { const f = parseFrac(v); return f ? f.num / f.den : null; };

  const obs: ArithObs[] = [];
  const intSols = solutions.filter(s => isInt(s.n) && isInt(s.x) && isInt(s.y));
  const ratSols = solutions.filter(s => !isInt(s.n) || !isInt(s.x) || !isInt(s.y));

  /* 1 ── count summary (only when both types exist) */
  if (intSols.length > 0 && ratSols.length > 0) {
    obs.push({
      icon: "∑",
      text: `${intSols.length} integer point${intSols.length !== 1 ? "s" : ""} and ${ratSols.length} rational point${ratSols.length !== 1 ? "s" : ""} found in search range.`,
    });
  }

  /* 2 ── symmetric ±y pairs */
  const posY = intSols.filter(s => (toFlt(s.y) ?? 0) > 0);
  if (isEllipticMode && posY.length > 0) {
    const allPaired = posY.every(s => {
      const y = toFlt(s.y)!;
      return intSols.some(
        t => String(t.n) === String(s.n)
          && toFlt(t.x) === toFlt(s.x)
          && toFlt(t.y) === -y,
      );
    });
    if (allPaired) {
      obs.push({ icon: "↕", text: "Solutions appear in symmetric ±y pairs — consistent with the y² symmetry of the curve." });
    }
  }

  /* 3 ── rational points with small denominators */
  if (ratSols.length > 0) {
    const denoms: number[] = [];
    for (const s of ratSols) {
      const fn = parseFrac(s.n), fx = parseFrac(s.x), fy = parseFrac(s.y);
      if (fn && fn.den > 1) denoms.push(fn.den);
      if (fx && fx.den > 1) denoms.push(fx.den);
      if (fy && fy.den > 1) denoms.push(fy.den);
    }
    if (denoms.length > 0) {
      const minD = Math.min(...denoms);
      obs.push({
        icon: "ℚ",
        text: `${ratSols.length} exact rational solution${ratSols.length !== 1 ? "s" : ""} found; the smallest observed non-unit denominator is ${minD}.`,
      });
    }
  }

  /* 4 ── unusually large integer point */
  if (intSols.length > 0) {
    let maxAbsX = 0;
    let bestSol: Solution | null = null;
    for (const s of intSols) {
      const ax = Math.abs(toFlt(s.x) ?? 0);
      if (ax > maxAbsX) { maxAbsX = ax; bestSol = s; }
    }
    if (maxAbsX > 1000 && bestSol) {
      const xFmt = Number(bestSol.x).toLocaleString();
      const yFmt = Math.abs(Number(bestSol.y)).toLocaleString();
      obs.push({
        icon: "⬆",
        text: `An unusually large exact integer witness was found — (${xFmt}, ${yFmt}).`,
      });
    }
  }

  /* 5 ── singularity check for short Weierstrass y² = x³ + ax + b */
  try {
    const t = expr.trim().replace(/\s+/g, "");
    const prefix = t.startsWith("x**3") ? "x**3" : t.startsWith("x^3") ? "x^3" : null;
    if (isEllipticMode && prefix) {
      const rest = t.slice(prefix.length);
      let a = 0, b = 0, matched = false;
      if (rest === "") {
        matched = true;
      } else if (/^([+-]\d+\.?\d*)$/.test(rest)) {
        matched = true;
        b = parseFloat(rest);
      } else {
        const mL = rest.match(/^([+-]\d*\.?\d*)\*?x([+-]\d+\.?\d*)?$/);
        if (mL) {
          matched = true;
          const ac = mL[1];
          a = ac === "+" || ac === "" ? 1 : ac === "-" ? -1 : parseFloat(ac);
          if (mL[2]) b = parseFloat(mL[2]);
        }
      }
      if (matched) {
        const delta = -16 * (4 * a ** 3 + 27 * b ** 2);
        if (delta === 0) {
          obs.push({ icon: "△", text: "Curve is singular — discriminant Δ = 0. Proceed with caution." });
        } else {
          obs.push({ icon: "○", text: `No singularities detected — discriminant Δ = ${Math.round(Math.abs(delta)).toLocaleString()} ≠ 0.` });
        }
      }
    }
  } catch (_) { /* skip if expression can't be parsed */ }

  return obs;
}
interface HistoryItem {
  id: string; equation: string; nMin: string; nMax: string; nDenom: string;
  xMode: string; xMin: string; xMax: string; pinned: boolean;
  solCount: number; timestamp: number; mode: string;
  xScaleFactor?: string; xCenterExpr?: string; xHalfWidth?: string;
  xDivisorPoly?: string; xDivisorMax?: string;
  xStartExpr?: string; xEndExpr?: string; xStepExpr?: string;
  genEq?: string; genXMin?: string; genXMax?: string; genYMin?: string; genYMax?: string;
  genPointType?: "integer" | "rational" | "all";
  genRationalHeight?: string; genSolutionLimit?: string;
  genProjectionMode?: "adaptive" | "all";
  genPreferIntegerY?: boolean;
  deepEngine?: "off" | "native" | "auto" | "sage";
  descentDepth?: string;
  skipZeroN?: boolean; skipZeroX?: boolean;
}

/* ── Constants ──────────────────────────────────────────────────────────── */
const HISTORY_KEY = "ecs-search-history";
const MAX_HISTORY = 50;
const BMC_KEY     = "ecs-bmc-hidden-until";

const MATH_FACTS = [
  "The Birch and Swinnerton-Dyer conjecture, one of the Millennium Prize Problems, predicts that the rank of an elliptic curve equals the order of vanishing of its L-function at s=1.",
  "Andrew Wiles proved Fermat's Last Theorem in 1995 by proving the modularity theorem for semistable elliptic curves.",
  "Every elliptic curve over ℚ has a finitely generated abelian group of rational points (Mordell's theorem, 1922).",
  "The congruent number problem asks which positive integers are areas of right triangles with rational sides — it is equivalent to asking when y²=x³−n²x has a rational point with y≠0.",
  "The j-invariant classifies elliptic curves up to isomorphism over an algebraically closed field.",
  "Hasse's theorem bounds the number of points on an elliptic curve over 𝔽ₚ: |#E(𝔽ₚ) − (p+1)| ≤ 2√p.",
  "The group law on an elliptic curve is given by the chord-tangent process, making it the only smooth projective curve with a group structure.",
  "Nagell-Lutz theorem: if (x,y) is a torsion point of an elliptic curve y²=x³+ax+b with integer a,b, then x,y are integers and either y=0 or y² divides 4a³+27b².",
  "The Taniyama-Shimura conjecture (now the modularity theorem) states every elliptic curve over ℚ is modular.",
  "Mazur's torsion theorem: the torsion subgroup of an elliptic curve over ℚ is isomorphic to ℤ/nℤ for n∈{1,…,10,12} or ℤ/2ℤ × ℤ/2nℤ for n∈{1,2,3,4}.",
  "NumPy evaluates millions of integers per second using SIMD CPU instructions — perfect-square detection over a vector is O(n) in practice.",
  "SymPy's symbolic engine converts your Python expression to a compiled NumPy lambda in a single call.",
  "Server-Sent Events (SSE) use a persistent HTTP connection to push data from server to browser without WebSockets.",
];

const EXAMPLES = [
  { name:"Congruent Number Curve", expr:"x**3 - n**2*x", nm:"-10", nx:"10", xm:"-100", xx:"100", nd:"1", desc:"y²=x³−n²x. Integer points exist iff n is a congruent number.", mode:"ec" },
  { name:"Weierstrass y²=x³+n", expr:"x**3 + n", nm:"-5", nx:"20", xm:"-50", xx:"50", nd:"1", desc:"Classic family. For n=1: Fermat's last theorem case.", mode:"ec" },
  { name:"y²=x³−x+n", expr:"x**3 - x + n", nm:"-8", nx:"8", xm:"-30", xx:"30", nd:"1", desc:"Varies the constant shift n across a fixed cubic.", mode:"ec" },
  { name:"Congruent (rational n)", expr:"x**3 - n**2*x", nm:"0", nx:"6", xm:"-200", xx:"200", nd:"6", desc:"Same curve but n runs over multiples of 1/6.", mode:"ec" },
  { name:"y²=x³+n²x+n", expr:"x**3 + n**2*x + n", nm:"-5", nx:"5", xm:"-50", xx:"50", nd:"1", desc:"Both linear and quadratic n-dependence.", mode:"ec" },
  { name:"y²=x³−n³", expr:"x**3 - n**3", nm:"-6", nx:"6", xm:"-80", xx:"80", nd:"1", desc:"Related to Fermat: asks when x³−n³ is a perfect square.", mode:"ec" },
  { name:"Hardy–Ramanujan 1729", expr:"x**3 - 1729*n**3", nm:"1", nx:"50", nd:"1", xMode:"window", xCenterExpr:"icbrt(1729*n**3)", xHalfWidth:"5000", desc:"1729=12³+1³=10³+9³. Smart Window mode.", mode:"ec" },
  { name:"Pythagorean triples", eq:"x**2 + y**2 = n**2", nm:"1", nx:"30", xm:"0", xx:"30", ym:"-100", yx:"100", desc:"All triples with legs ≤30.", mode:"gen" },
  { name:"Sum of two cubes", eq:"x**3 + y**3 = n", nm:"1", nx:"2000", xm:"-15", xx:"15", ym:"-100", yx:"100", desc:"Which n=sum of two integer cubes? Finds 1729.", mode:"gen" },
  { name:"y³−y=x⁴−2x−2", eq:"y**3 - y = x**4 - 2*x - 2", nm:"0", nx:"0", xm:"-100", xx:"100", ym:"-100", yx:"100", desc:"Degree 3 in y, degree 4 in x.", mode:"gen" },
];

const FONT_OPTIONS = [
  // sans-serif
  { id:"helvetica",  label:"Helvetica Neue",   stack:'"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { id:"opendyslexic", label:"OpenDyslexic",   stack:'"OpenDyslexic", "Comic Sans MS", Arial, sans-serif' },
  { id:"trebuchet",  label:"Trebuchet MS",      stack:'"Trebuchet MS", "Gill Sans", sans-serif' },
  { id:"verdana",    label:"Verdana",           stack:'Verdana, Geneva, Tahoma, sans-serif' },
  { id:"tahoma",     label:"Tahoma",            stack:'Tahoma, Geneva, sans-serif' },
  { id:"optima",     label:"Optima",            stack:'Optima, Candara, "Noto Sans", sans-serif' },
  { id:"futura",     label:"Futura / Century",  stack:'"Century Gothic", "Futura", Futura, sans-serif' },
  // serif
  { id:"georgia",    label:"Georgia",           stack:'Georgia, "Times New Roman", serif' },
  { id:"palatino",   label:"Palatino",          stack:'Palatino, "Palatino Linotype", "Book Antiqua", serif' },
  { id:"garamond",   label:"Garamond",          stack:'"EB Garamond", Garamond, "Adobe Garamond Pro", serif' },
  { id:"baskerville",label:"Baskerville",       stack:'"Baskerville Old Face", Baskerville, "Book Antiqua", serif' },
  { id:"times",      label:"Times New Roman",   stack:'"Times New Roman", Times, serif' },
  { id:"didot",      label:"Didot / Bodoni",    stack:'Didot, "Bodoni MT", "Bodoni 72", serif' },
  // monospace
  { id:"courier",    label:"Courier New",       stack:'"Courier New", Courier, monospace' },
  { id:"menlo",      label:"Menlo / Consolas",  stack:'Menlo, Consolas, "DejaVu Sans Mono", monospace' },
  { id:"monaco",     label:"Monaco / SF Mono",  stack:'Monaco, "SF Mono", "Fira Mono", monospace' },
  { id:"lucida",     label:"Lucida Console",    stack:'"Lucida Console", "Lucida Sans Typewriter", monospace' },
  // system
  { id:"system",     label:"System UI",         stack:'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' },
  { id:"ui-serif",   label:"UI Serif",          stack:'"ui-serif", Georgia, serif' },
  { id:"ui-mono",    label:"UI Monospace",      stack:'"ui-monospace", "SFMono-Regular", monospace' },
];

const FONT_SIZES = [
  { id:"xs",  label:"XS",  px:"12px" },
  { id:"sm",  label:"SM",  px:"13px" },
  { id:"md",  label:"MD",  px:"14px" },
  { id:"lg",  label:"LG",  px:"15px" },
  { id:"xl",  label:"XL",  px:"16px" },
  { id:"xxl", label:"XXL", px:"18px" },
];

/* ── Utility ─────────────────────────────────────────────────────────────── */
function escHtml(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function fmtNum(v: number) {
  if (!Number.isFinite(v)) return "";
  const a = Math.abs(v);
  if (a >= 1e15) return v.toExponential(2);
  if (a >= 10000) return v.toExponential(1);
  if (a >= 100) return Math.round(v).toString();
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(1);
}
function parseRationalToFloat(v: string | number): number {
  const s = String(v).trim();
  const slash = s.indexOf("/");
  if (slash === -1) return Number(s);
  const num = Number(s.slice(0, slash));
  const den = Number(s.slice(slash + 1));
  return den !== 0 ? num / den : NaN;
}
function isIntegerLiteral(v: string | number): boolean {
  const s = String(v).trim();
  if (s.includes("/")) return false;
  const n = Number(s);
  return Number.isFinite(n) && Number.isInteger(n);
}
function computeHeight(...coordinates: (string | number)[]): string {
  try {
    let m = 1n;
    for (const coordinate of coordinates) {
      const [numerator, denominator = "1"] = String(coordinate).replace(/^-/, "").split("/");
      const numeratorAbs = BigInt(numerator);
      const denominatorAbs = BigInt(denominator);
      if (numeratorAbs > m) m = numeratorAbs;
      if (denominatorAbs > m) m = denominatorAbs;
    }
    if (m <= 1n) return "0";
    let bits = 0; let v = m;
    while (v > 0n) { v >>= 1n; bits++; }
    return bits.toString();
  } catch { return ""; }
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */
export default function SolverPage() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const isDark = theme === "dark";

  /* ── Form state ──────────────────────────────────────────────────────── */
  const [solverMode, setSolverMode] = useState<"ec"|"gen">("ec");
  const [ecVarMode, setEcVarMode]   = useState<"2var"|"3var">("3var");
  const [genVarMode, setGenVarMode] = useState<"2var"|"3var">("3var");
  const [expr, setExpr]   = useState("x**3 - n**2*x");
  const [nMin, setNMin]   = useState("-10");
  const [nMax, setNMax]   = useState("10");
  const [nDenom, setNDenom] = useState("1");
  const [nSingle, setNSingle] = useState("1");
  const [xMode, setXMode] = useState("fixed");
  const [xMin, setXMin]   = useState("-1000");
  const [xMax, setXMax]   = useState("1000");
  const [xScaleFactor, setXScaleFactor]   = useState("15");
  const [xCenterExpr, setXCenterExpr]     = useState("12*n");
  const [xHalfWidth, setXHalfWidth]       = useState("5000");
  const [xDivisorPoly, setXDivisorPoly]   = useState("");
  const [xDivisorMax, setXDivisorMax]     = useState("1000000");
  const [xStartExpr, setXStartExpr]       = useState("-1000");
  const [xEndExpr, setXEndExpr]           = useState("1000");
  const [xStepExpr, setXStepExpr]         = useState("1");
  const [skipZeroN, setSkipZeroN] = useState(false);
  const [skipZeroX, setSkipZeroX] = useState(false);
  // Gen mode
  const [genEq, setGenEq]     = useState("y**3 - y = x**4 - 2*x - 2");
  const [genXMin, setGenXMin] = useState("-50");
  const [genXMax, setGenXMax] = useState("50");
  const [genYMin, setGenYMin] = useState("-1000");
  const [genYMax, setGenYMax] = useState("1000");
  const [genPointType, setGenPointType] = useState<"integer"|"rational"|"all">("all");
  const [genRationalHeight, setGenRationalHeight] = useState("12");
  const [genSolutionLimit, setGenSolutionLimit] = useState("2000");
  const [genProjectionMode, setGenProjectionMode] = useState<"adaptive"|"all">("all");
  const [genPreferIntegerY, setGenPreferIntegerY] = useState(true);
  const [deepEngine, setDeepEngine] = useState<"off"|"native"|"auto"|"sage">("auto");
  const [descentDepth, setDescentDepth] = useState("6");
  const [proofCertificate, setProofCertificate] = useState(true);
  const [threeDescent, setThreeDescent] = useState(false);
  // LaTeX
  const [latexPreview, setLatexPreview] = useState("");
  const [latexError, setLatexError]     = useState(false);
  const [latexPaste, setLatexPaste]     = useState("");
  const [latexStatus, setLatexStatus]   = useState("");
  const [latexStatusOk, setLatexStatusOk] = useState(false);

  /* ── Search state ─────────────────────────────────────────────────────── */
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress]       = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [statusMsg, setStatusMsg]     = useState(I18N.en["status-idle"] || "Enter a curve expression and click Run Search.");
  const [statusCls, setStatusCls]     = useState("status-idle");
  const [solutions, setSolutions]     = useState<Solution[]>([]);
  const [showTable, setShowTable]     = useState(false);
  const [showEmpty, setShowEmpty]     = useState(false);
  const [warning, setWarning]         = useState("");
  const [searchScope, setSearchScope] = useState("");
  const [nSummary, setNSummary]       = useState<string[]>([]);
  const [nTested, setNTested]         = useState(0);
  const [pointFilter, setPointFilter] = useState<"all"|"integer"|"rational">("all");
  const [curveInfoRows, setCurveInfoRows] = useState<any[]>([]);
  const [curveClassification, setCurveClassification] = useState<any>(null);
  const [showExactMap, setShowExactMap] = useState(false);
  const [solverCertificates, setSolverCertificates] = useState<any[]>([]);
  const [rankReports, setRankReports] = useState<any[]>([]);

  /* ── Infeasibility proof state ───────────────────────────────────── */
  const [proofState, setProofState] = useState<"idle"|"loading"|"proved"|"failed">("idle");
  const [proofData,  setProofData]  = useState<ProofResult | null>(null);

  /* ── Plot state ───────────────────────────────────────────────────────── */
  const [plotData, setPlotData]   = useState<any>(null);
  const [viewport, setViewport]   = useState<{xMin:number;xMax:number;yMin:number;yMax:number}|null>(null);
  const [showPlot, setShowPlot]   = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [plotN, setPlotN]         = useState("");
  const [plotCaption, setPlotCaption] = useState("");
  const [plotView, setPlotView] = useState<"slice2d"|"cloud3d"|"surface3d">("slice2d");
  const [plotSupports3D, setPlotSupports3D] = useState(false);
  const [plot3DCamera, setPlot3DCamera] = useState({ yaw: -0.7, pitch: 0.45, zoom: 1.0 });
  const [plot3DWireData, setPlot3DWireData] = useState<any>(null);
  const [groupLawResult, setGroupLawResult] = useState("");
  const [glP, setGlP] = useState("O");
  const [glQ, setGlQ] = useState("O");
  const [showSymmetry, setShowSymmetry] = useState(false);
  const [showConstruction, setShowConstruction] = useState(false);
  const [groupLawPoint, setGroupLawPoint] = useState<{x: number, y: number} | null>(null);

  /* ── UI state ─────────────────────────────────────────────────────────── */
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory]         = useState<HistoryItem[]>([]);
  const wpTheme = "elliptic";
  const [toast, setToast]             = useState("");
  const [showBmc, setShowBmc]         = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggText, setSuggText]       = useState("");
  const [showDemographics, setShowDemographics] = useState(false);
  const [demographicsRows, setDemographicsRows] = useState<DemographicRow[]>([]);
  const [demographicsTotal, setDemographicsTotal] = useState(0);
  const [demographicsLoading, setDemographicsLoading] = useState(false);
  const [demographicsErr, setDemographicsErr] = useState("");
  const [factIdx, setFactIdx]         = useState(0);

  /* ── Font picker state ────────────────────────────────────────────────── */
  const [fontId, setFontId]           = useState("helvetica");
  const [fontSizeId, setFontSizeId]   = useState("md");
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [fontPickerPos, setFontPickerPos]   = useState({ top: 0, right: 0 });

  /* ── Refs ─────────────────────────────────────────────────────────────── */
  const evtSourceRef  = useRef<EventSource|null>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef   = useRef<HTMLCanvasElement>(null);
  const allSolsRef    = useRef<Solution[]>([]);
  const nTotalRef     = useRef(0);
  const searchMetaRef = useRef<any>({});
  const rafRef        = useRef<number>(0);
  const canvasEventsRef = useRef(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const plotSolsRef   = useRef<{n:string;x:string;y:string}[]>([]);
  const plotSliceSolsRef = useRef<{n:string;x:string;y:string}[]>([]);
  const viewportRef   = useRef<{xMin:number;xMax:number;yMin:number;yMax:number}|null>(null);
  const plotDataRef   = useRef<any>(null);
  const plotViewRef   = useRef<"slice2d"|"cloud3d"|"surface3d">("slice2d");
  const plotSupports3DRef = useRef(false);
  const plot3DCameraRef = useRef({ yaw: -0.7, pitch: 0.45, zoom: 1.0 });
  const plot3DWireDataRef = useRef<any>(null);
  const showLabelsRef = useRef(true);
  const filterRef     = useRef<"all"|"integer"|"rational">("all");
  const showSymmetryRef    = useRef(false);
  const showConstructionRef = useRef(false);
  const groupLawPointRef   = useRef<{x: number, y: number} | null>(null);
  const glPRef = useRef("O");
  const glQRef = useRef("O");

  /* ── Apply font preference to entire page ────────────────────────────── */
  useEffect(() => {
    const font = FONT_OPTIONS.find(f => f.id === fontId);
    const size = FONT_SIZES.find(s => s.id === fontSizeId);
    const html = document.documentElement;
    // rem units are relative to <html> font-size — must set here, not body
    if (size) html.style.fontSize = size.px;
    // Every element uses var(--font-mono) or var(--font-sans) explicitly,
    // so override both CSS variables so they all pick up the chosen font
    if (font) {
      html.style.setProperty("--font-mono", font.stack);
      html.style.setProperty("--font-sans", font.stack);
    }
    return () => {
      html.style.fontSize = "";
      html.style.removeProperty("--font-mono");
      html.style.removeProperty("--font-sans");
    };
  }, [fontId, fontSizeId]);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { plotDataRef.current = plotData; }, [plotData]);
  useEffect(() => { plotViewRef.current = plotView; }, [plotView]);
  useEffect(() => { plotSupports3DRef.current = plotSupports3D; }, [plotSupports3D]);
  useEffect(() => { plot3DCameraRef.current = plot3DCamera; }, [plot3DCamera]);
  useEffect(() => { plot3DWireDataRef.current = plot3DWireData; }, [plot3DWireData]);
  useEffect(() => { showLabelsRef.current = showLabels; }, [showLabels]);
  useEffect(() => { filterRef.current = pointFilter; }, [pointFilter]);
  useEffect(() => { showSymmetryRef.current = showSymmetry; }, [showSymmetry]);
  useEffect(() => { showConstructionRef.current = showConstruction; }, [showConstruction]);
  useEffect(() => { glPRef.current = glP; }, [glP]);
  useEffect(() => { glQRef.current = glQ; }, [glQ]);

  /* ── Load persisted data on mount ────────────────────────────────────── */
  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")); } catch {}
    const fid = localStorage.getItem("ecs-font") || "helvetica";
    const fsid = localStorage.getItem("ecs-font-size") || "md";
    setFontId(fid); setFontSizeId(fsid);
    const hideUntil = parseInt(localStorage.getItem(BMC_KEY) || "0", 10);
    setShowBmc(Date.now() > hideUntil);
    const p = new URLSearchParams(window.location.search);
    if (p.get("expr")) {
      setExpr(p.get("expr")!);
      if (p.get("n_min")) setNMin(p.get("n_min")!);
      if (p.get("n_max")) setNMax(p.get("n_max")!);
      if (p.get("n_denom")) setNDenom(p.get("n_denom")!);
    }
  }, []);

  useEffect(() => {
    if (statusCls === "status-idle" && !isSearching) {
      setStatusMsg(t("status-idle"));
    }
  }, [lang, t, statusCls, isSearching]);

  // Track visit country for demographics aggregation.
  useEffect(() => {
    fetch("/api/demographics/track", { method: "POST" }).catch(() => {});
  }, []);

  // Product decision: keep only fixed x-search mode in UI.
  useEffect(() => {
    if (xMode !== "fixed") setXMode("fixed");
  }, [xMode]);

  /* ── Math facts rotator ──────────────────────────────────────────────── */
  useEffect(() => {
    const id = setInterval(() => setFactIdx(i => (i + 1) % MATH_FACTS.length), 9000);
    return () => clearInterval(id);
  }, []);

  /* ── Wallpaper canvas animation ──────────────────────────────────────── */
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0, t = 0;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas!.width  = W * dpr; canvas!.height = H * dpr;
      canvas!.style.width = W + "px"; canvas!.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);
    const dark = () => document.documentElement.getAttribute("data-theme") === "dark";

    const strands = Array.from({length:7}, (_, i) => ({
      a: [-1,-2.5,0,-3,1,-1.5,0.5][i],
      b: [1,2,-1,4,-2,0.5,1.5][i],
      ox: Math.random(), oy: 0.15 + Math.random()*0.7,
      dx: [0.018,-0.012,0.009,-0.016,0.011,-0.007,0.014][i]*(0.7+Math.random()*0.6),
      dy: [0.011,0.008,-0.014,0.006,0.013,-0.009,-0.010][i]*(0.7+Math.random()*0.6),
      scale: 0.22 + Math.random()*0.28,
    }));

    function drawElliptic() {
      const d = dark();
      ctx.clearRect(0, 0, W, H);
      const colors = d
        ? ["rgba(163,113,247,0.12)","rgba(88,166,255,0.09)","rgba(63,185,80,0.08)"]
        : ["rgba(130,80,223,0.10)","rgba(9,105,218,0.08)","rgba(26,127,55,0.07)"];
      strands.forEach((s, i) => {
        s.ox = (s.ox + s.dx / W + 1) % 1;
        s.oy = Math.max(0.1, Math.min(0.9, s.oy + s.dy / H));
        if (s.oy < 0.12 || s.oy > 0.88) s.dy *= -1;
        const cx = s.ox * W, cy = s.oy * H, sc = s.scale * Math.min(W, H);
        ctx.beginPath(); ctx.strokeStyle = colors[i % 3]; ctx.lineWidth = 1.5;
        for (let xi = -sc; xi <= sc; xi += sc / 120) {
          const rhs = xi*xi*xi + s.a*xi + s.b;
          if (rhs >= 0) {
            const y = Math.sqrt(rhs);
            ctx.moveTo(cx + xi, cy - y * sc / 2);
            ctx.lineTo(cx + xi, cy + y * sc / 2);
          }
        }
        ctx.stroke();
      });
    }

    function drawLattice() {
      const d = dark();
      ctx.clearRect(0, 0, W, H);
      const sp = 48; const off = t * 0.3 % sp;
      ctx.strokeStyle = d ? "rgba(88,166,255,0.07)" : "rgba(9,105,218,0.06)";
      ctx.lineWidth = 0.8;
      for (let x = -off; x < W + sp; x += sp) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = -off; y < H + sp; y += sp) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.fillStyle = d ? "rgba(163,113,247,0.15)" : "rgba(130,80,223,0.12)";
      for (let x = -off; x < W + sp; x += sp)
        for (let y2 = -off; y2 < H + sp; y2 += sp) {
          ctx.beginPath(); ctx.arc(x, y2, 2, 0, Math.PI*2); ctx.fill();
        }
    }

    function drawRoses() {
      const d = dark();
      ctx.clearRect(0, 0, W, H);
      const pts: [number,number,number,number][] = [[W*0.25,H*0.4,5,0.6],[W*0.7,H*0.6,3,0.8],[W*0.5,H*0.25,7,0.4]];
      pts.forEach(([cx,cy,k,sc]) => {
        ctx.beginPath(); ctx.strokeStyle = d ? "rgba(163,113,247,0.12)" : "rgba(130,80,223,0.10)"; ctx.lineWidth = 1.2;
        for (let th = 0; th < Math.PI * 2; th += 0.01) {
          const r = (sc * Math.min(W,H) * 0.22) * Math.cos(k * (th + t * 0.005));
          const x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
          th === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
    }

    function drawLissajous() {
      const d = dark();
      ctx.clearRect(0, 0, W, H);
      const segs: [number,number,number][] = [[3,2,0],[5,4,1],[4,3,2]];
      segs.forEach(([a,b,phi]) => {
        ctx.beginPath(); ctx.strokeStyle = d ? `rgba(88,166,255,0.11)` : `rgba(9,105,218,0.09)`; ctx.lineWidth = 1.2;
        const R = Math.min(W,H) * 0.28;
        for (let i = 0; i <= 1000; i++) {
          const th = (i / 1000) * Math.PI * 2;
          const x = W/2 + R * Math.sin(a * th + t*0.003 + phi);
          const y = H/2 + R * Math.sin(b * th);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
    }

    function drawSpirals() {
      const d = dark();
      ctx.clearRect(0, 0, W, H);
      const centers: [number,number][] = [[W*0.3,H*0.5],[W*0.7,H*0.4]];
      centers.forEach(([cx,cy]) => {
        ctx.beginPath(); ctx.strokeStyle = d ? "rgba(63,185,80,0.10)" : "rgba(26,127,55,0.08)"; ctx.lineWidth = 1.2;
        for (let th = 0; th < 16 * Math.PI; th += 0.05) {
          const r = th * 5 + t * 0.08;
          const x = cx + r * Math.cos(th); const y = cy + r * Math.sin(th);
          th === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          if (r > Math.min(W,H) * 0.5) break;
        }
        ctx.stroke();
      });
    }

    const drawFns: Record<string, ()=>void> = {
      elliptic: drawElliptic, lattice: drawLattice,
      roses: drawRoses, lissajous: drawLissajous, spirals: drawSpirals,
    };

    function loop() {
      t++;
      (drawFns[wpTheme] || drawElliptic)();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize); };
  }, [wpTheme, theme]);

  /* ── LaTeX preview ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!expr) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => fetchLatexPreview(expr), 400);
    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  }, [expr]);

  async function fetchLatexPreview(e: string) {
    try {
      const r = await fetch("/api/latex", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({expr:e}) });
      const d = await r.json();
      if (d.ok) { setLatexPreview(d.latex); setLatexError(false); }
      else { setLatexPreview(d.error); setLatexError(true); }
    } catch { setLatexPreview("Preview unavailable"); setLatexError(false); }
  }

  async function convertLatex() {
    if (!latexPaste.trim()) { setLatexStatus("Paste a LaTeX expression first."); setLatexStatusOk(false); return; }
    setLatexStatus("Converting…"); setLatexStatusOk(false);
    try {
      const r = await fetch("/api/from_latex", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({latex: latexPaste, mode: solverMode}) });
      const d = await r.json();
      if (d.ok) {
        if (d.auto_gen) {
          // Backend detected a full equation with y — switch to gen mode automatically
          setSolverMode("gen"); setGenEq(d.eq);
          setLatexStatus("Loaded as General Diophantine (equation uses y)."); setLatexStatusOk(true);
        } else if (solverMode === "gen") {
          setGenEq(d.eq || d.expr);
          setLatexStatus("Loaded!"); setLatexStatusOk(true);
        } else {
          setExpr(d.expr);
          setLatexStatus("Loaded!"); setLatexStatusOk(true);
        }
      } else { setLatexStatus("Error: " + d.error); setLatexStatusOk(false); }
    } catch { setLatexStatus("Request failed — is the server running?"); setLatexStatusOk(false); }
  }

  /* ── Build search URL ─────────────────────────────────────────────────── */
  function buildSearchURL(): string {
    const is2var = ecVarMode === "2var";
    const p = new URLSearchParams({
      expr: expr.trim(),
      n_min: is2var ? nSingle : nMin,
      n_max: is2var ? nSingle : nMax,
      n_denom: is2var ? "1" : nDenom,
    });
    if (xMode === "autoscale") p.set("x_scale", xScaleFactor);
    else if (xMode === "window") { p.set("x_center_expr", xCenterExpr); p.set("x_window", xHalfWidth); }
    else if (xMode === "divisor") { p.set("x_divisor_poly", xDivisorPoly); p.set("x_divisor_max", xDivisorMax); }
    else if (xMode === "exprrange") { p.set("x_start_expr", xStartExpr); p.set("x_end_expr", xEndExpr); p.set("x_step_expr", xStepExpr || "1"); }
    else { p.set("x_min", xMin); p.set("x_max", xMax); }
    if (skipZeroN) p.set("skip_zero_n", "1");
    if (skipZeroX) p.set("skip_zero_x", "1");
    p.set("point_type", "all"); // fetch both integer and rational; frontend filter splits them
    p.set("deep_engine", deepEngine);
    p.set("descent_depth", descentDepth);
    p.set("proof_certificate", proofCertificate ? "1" : "0");
    p.set("three_descent", threeDescent ? "1" : "0");
    return "/api/search?" + p.toString();
  }

  function buildDiophURL(): string {
    const p = new URLSearchParams({
      eq: genEq.trim(), x_min: genXMin, x_max: genXMax,
      y_min: genYMin, y_max: genYMax,
      n_min: nMin, n_max: nMax, n_denom: nDenom,
      point_type: genPointType,
      rational_height: genRationalHeight,
      solution_limit: genSolutionLimit,
      projection_mode: genProjectionMode,
      prefer_integer_y: genPreferIntegerY ? "1" : "0",
      deep_engine: deepEngine,
      descent_depth: descentDepth,
      proof_certificate: proofCertificate ? "1" : "0",
      three_descent: threeDescent ? "1" : "0",
    });
    if (skipZeroN) p.set("skip_zero_n", "1");
    if (skipZeroX) p.set("skip_zero_x", "1");
    return "/api/diophantine?" + p.toString();
  }

  /* ── Stop search ─────────────────────────────────────────────────────── */
  const stopSearch = useCallback(() => {
    if (evtSourceRef.current) { evtSourceRef.current.close(); evtSourceRef.current = null; }
    setIsSearching(false);
    setStatusMsg(t("status-stopped")); setStatusCls("status-idle");
    setProgress(0);
  }, []);

  /* ── Infeasibility proof ────────────────────────────────────────── */
  const attemptProof = useCallback(async () => {
    setProofState("loading");
    setProofData(null);
    try {
      const equation = solverMode === "ec" ? `y**2 = ${expr}` : genEq;
      const res = await fetch("/api/prove-infeasible", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equation }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const d: ProofResult = await res.json();
      setProofData(d);
      setProofState(d.proved ? "proved" : "failed");
    } catch (e) {
      setProofData({ ok: false, error: String(e) });
      setProofState("failed");
    }
  }, [solverMode, expr, genEq]);

  /* ── Start search ────────────────────────────────────────────────────── */
  const startSearch = useCallback(() => {
    if (evtSourceRef.current) { evtSourceRef.current.close(); evtSourceRef.current = null; }
    allSolsRef.current = [];
    nTotalRef.current = 0;
    setSolutions([]); setShowTable(false); setShowEmpty(false);
    setProofState("idle"); setProofData(null);
    setProgress(0); setProgressMsg(""); setWarning("");
    setSearchScope("");
    setCurveClassification(null);
    setShowExactMap(false);
    setSolverCertificates([]);
    setRankReports([]);
    setNSummary([]); setNTested(0);
    setShowPlot(false); setPlotData(null); setViewport(null);
    setPlotSupports3D(false); setPlotView("slice2d");
    setPlot3DCamera({ yaw: -0.7, pitch: 0.45, zoom: 1.0 });
    setPlot3DWireData(null);
    plotSolsRef.current = []; plotSliceSolsRef.current = [];
    plotDataRef.current = null; viewportRef.current = null;
    setCurveInfoRows([]);

    searchMetaRef.current = {
      mode: solverMode, equation: solverMode==="gen" ? genEq.trim() : `y² = ${expr.trim()}`,
      threeUnknowns: solverMode === "ec" ? ecVarMode === "3var" : genVarMode === "3var",
      nMin: ecVarMode==="2var" ? nSingle : nMin,
      nMax: ecVarMode==="2var" ? nSingle : nMax,
      nDenom: ecVarMode==="2var" ? "1" : nDenom,
      xMode, xMin, xMax, xScaleFactor, xCenterExpr, xHalfWidth,
      xDivisorPoly, xDivisorMax, xStartExpr, xEndExpr, xStepExpr,
      genEq: genEq.trim(), genXMin, genXMax, genYMin, genYMax,
      genPointType, genRationalHeight, genSolutionLimit,
      genProjectionMode, genPreferIntegerY,
      deepEngine, descentDepth, proofCertificate, threeDescent,
      skipZeroN, skipZeroX, startedAt: Date.now(),
    };

    setIsSearching(true);
    setStatusMsg(t("status-starting")); setStatusCls("status-running");

    const url = solverMode === "gen" ? buildDiophURL() : buildSearchURL();
    const es = new EventSource(url);
    evtSourceRef.current = es;

    es.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }
      switch (msg.type) {
        case "heartbeat": return;
        case "warning": setWarning(msg.message); break;
        case "start":
          nTotalRef.current = msg.n_count;
          if (msg.scope) setSearchScope(msg.scope);
          if (msg.curve_classification) {
            setCurveClassification(msg.curve_classification);
            setShowExactMap(false);
          }
          setStatusMsg(t("progress-searching"));
          setStatusCls("status-running");
          break;
        case "engine": {
          const engines = Array.isArray(msg.engines_used)
            ? msg.engines_used.join(" + ")
            : "";
          const generated = (msg.native_points || 0) + (msg.sage_points || 0);
          setProgressMsg(
            engines
              ? `${engines} generated ${generated.toLocaleString()} exact candidates`
              : "Deep elliptic engine completed with no additional candidates"
          );
          if (Array.isArray(msg.certificates)) {
            setSolverCertificates(msg.certificates);
          }
          if (Array.isArray(msg.rank_reports)) {
            setRankReports(msg.rank_reports);
          }
          break;
        }
        case "progress":
          setProgress(msg.pct);
          setProgressMsg(
            msg.assignments_checked
              ? `${msg.pct}%  |  ${msg.assignments_checked.toLocaleString()} exact assignments${msg.projection ? `  |  solve ${msg.projection}` : ""}  |  ${msg.solutions} solutions`
              : `${msg.pct}%  |  n = ${msg.n}  |  ${msg.solutions}`
          );
          break;
        case "solutions":
          if (!msg.data?.length) break;
          setShowTable(true);
          allSolsRef.current = [...allSolsRef.current, ...msg.data];
          setSolutions(allSolsRef.current);
          break;
        case "curve_info":
          setCurveInfoRows(prev => [...prev, msg]);
          break;
        case "done":
          es.close(); evtSourceRef.current = null;
          setIsSearching(false);
          if (msg.complete !== false) setProgress(100);
          if (msg.scope) setSearchScope(msg.scope);
          if (msg.complete === false) {
            const reason = msg.stop_reason === "solution_limit"
              ? "The result cap was reached. Raise the cap to continue this bounded search."
              : "The server time limit was reached before the displayed exact scope was exhausted.";
            setWarning(reason);
          }
          if (msg.n_with_solutions) { setNSummary(msg.n_with_solutions); setNTested(nTotalRef.current); }
          if (allSolsRef.current.length === 0) {
            if (msg.complete === false) {
              setStatusMsg("Search stopped before the exact scope was exhausted.");
              setStatusCls("status-warn");
            } else {
              setShowEmpty(true);
              setStatusMsg(
                solverMode === "gen" && genPointType !== "integer"
                  ? "Search complete — no rational solutions found in the exact scope."
                  : t("status-no-results"),
              );
              setStatusCls("status-done");
            }
          } else {
            setStatusMsg(
              `${t("done-found")} ${allSolsRef.current.length} ${allSolsRef.current.length!==1 ? t("sol-plural") : t("sol-singular")}.`
            );
            setStatusCls("status-done");
            setProgressMsg(`${allSolsRef.current.length} ${allSolsRef.current.length!==1 ? t("sol-plural") : t("sol-singular")}`);
          }
          saveToHistory(allSolsRef.current.length);
          setTimeout(() => loadPlot(), 80);
          break;
        case "error":
          es.close(); evtSourceRef.current = null;
          setIsSearching(false);
          setStatusMsg("Error: " + msg.message); setStatusCls("status-error");
          break;
      }
    };

    es.onerror = () => {
      const cap = es;
      setTimeout(() => {
        if (evtSourceRef.current === cap) {
          cap.close(); evtSourceRef.current = null;
          setIsSearching(false);
          setStatusMsg(t("status-conn-error"));
          setStatusCls("status-error");
        }
      }, 0);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solverMode, ecVarMode, genVarMode, expr, nMin, nMax, nDenom, nSingle, xMode, xMin, xMax,
      xScaleFactor, xCenterExpr, xHalfWidth, xDivisorPoly, xDivisorMax,
      xStartExpr, xEndExpr, xStepExpr, skipZeroN, skipZeroX,
      genEq, genXMin, genXMax, genYMin, genYMax,
      genPointType, genRationalHeight, genSolutionLimit,
      genProjectionMode, genPreferIntegerY, deepEngine, descentDepth,
      proofCertificate, threeDescent]);

  /* ── Save to history ──────────────────────────────────────────────────── */
  function saveToHistory(solCount: number) {
    const meta = searchMetaRef.current;
    const item: HistoryItem = {
      id: Date.now().toString(),
      equation: meta.equation,
      nMin: meta.nMin, nMax: meta.nMax, nDenom: meta.nDenom,
      xMode: meta.xMode, xMin: meta.xMin, xMax: meta.xMax,
      xScaleFactor: meta.xScaleFactor, xCenterExpr: meta.xCenterExpr,
      xHalfWidth: meta.xHalfWidth, xDivisorPoly: meta.xDivisorPoly,
      xDivisorMax: meta.xDivisorMax, xStartExpr: meta.xStartExpr,
      xEndExpr: meta.xEndExpr, xStepExpr: meta.xStepExpr,
      pinned: false, solCount, timestamp: Date.now(), mode: meta.mode,
      genEq: meta.genEq, genXMin: meta.genXMin, genXMax: meta.genXMax,
      genYMin: meta.genYMin, genYMax: meta.genYMax,
      genPointType: meta.genPointType,
      genRationalHeight: meta.genRationalHeight,
      genSolutionLimit: meta.genSolutionLimit,
      genProjectionMode: meta.genProjectionMode,
      genPreferIntegerY: meta.genPreferIntegerY,
      deepEngine: meta.deepEngine,
      descentDepth: meta.descentDepth,
      skipZeroN: meta.skipZeroN, skipZeroX: meta.skipZeroX,
    };
    setHistory(prev => {
      const next = [item, ...prev.filter(h => h.equation !== item.equation).slice(0, MAX_HISTORY - 1)];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function loadHistoryItem(h: HistoryItem) {
    if (h.mode === "gen") {
      setSolverMode("gen"); setGenEq(h.genEq || "");
      setGenXMin(h.genXMin || "-50"); setGenXMax(h.genXMax || "50");
      setGenYMin(h.genYMin || "-1000"); setGenYMax(h.genYMax || "1000");
      setGenPointType(h.genPointType || "all");
      setGenRationalHeight(h.genRationalHeight || "12");
      setGenSolutionLimit(h.genSolutionLimit || "2000");
      setGenProjectionMode(h.genProjectionMode || "all");
      setGenPreferIntegerY(h.genPreferIntegerY ?? true);
    } else {
      setSolverMode("ec");
      if (h.equation.startsWith("y²")) setExpr(h.equation.replace("y² = ","").trim());
      setXMode(h.xMode || "fixed"); setXMin(h.xMin); setXMax(h.xMax);
      if (h.xScaleFactor) setXScaleFactor(h.xScaleFactor);
      if (h.xCenterExpr) setXCenterExpr(h.xCenterExpr);
      if (h.xHalfWidth) setXHalfWidth(h.xHalfWidth);
      if (h.xDivisorPoly) setXDivisorPoly(h.xDivisorPoly);
      if (h.xDivisorMax) setXDivisorMax(h.xDivisorMax);
      if (h.xStartExpr) setXStartExpr(h.xStartExpr);
      if (h.xEndExpr) setXEndExpr(h.xEndExpr);
      if (h.xStepExpr) setXStepExpr(h.xStepExpr);
    }
    setNMin(h.nMin); setNMax(h.nMax); setNDenom(h.nDenom);
    setDeepEngine(h.deepEngine || "auto");
    setDescentDepth(h.descentDepth || "6");
    if (h.skipZeroN !== undefined) setSkipZeroN(h.skipZeroN);
    if (h.skipZeroX !== undefined) setSkipZeroX(h.skipZeroX);
    setShowHistory(false);
  }

  function deleteHistoryItem(id: string) {
    setHistory(prev => { const next = prev.filter(h => h.id !== id); localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); return next; });
  }
  function pinHistoryItem(id: string) {
    setHistory(prev => { const next = prev.map(h => h.id===id ? {...h, pinned: !h.pinned} : h); localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); return next; });
  }
  function clearHistory() {
    setHistory([]); localStorage.removeItem(HISTORY_KEY);
  }

  /* ── Load random / example curve ──────────────────────────────────────── */
  function loadRandomCurve() {
    const ecExamples = EXAMPLES.filter(e => e.mode === "ec");
    const pick = ecExamples[Math.floor(Math.random() * ecExamples.length)];
    loadExample(pick);
    showToast(t("ex-load"));
  }

  function loadExample(ex: typeof EXAMPLES[0]) {
    if (ex.mode === "gen") {
      setSolverMode("gen");
      if ((ex as any).eq) setGenEq((ex as any).eq);
      if (ex.nm) setNMin(String(ex.nm)); if (ex.nx) setNMax(String(ex.nx));
      if ((ex as any).xm) setGenXMin(String((ex as any).xm));
      if ((ex as any).xx) setGenXMax(String((ex as any).xx));
      if ((ex as any).ym) setGenYMin(String((ex as any).ym));
      if ((ex as any).yx) setGenYMax(String((ex as any).yx));
    } else {
      setSolverMode("ec");
      if (ex.expr) setExpr(ex.expr);
      if (ex.nm) setNMin(String(ex.nm)); if (ex.nx) setNMax(String(ex.nx));
      if ((ex as any).nd) setNDenom(String((ex as any).nd));
      if ((ex as any).xMode) {
        setXMode((ex as any).xMode);
        if ((ex as any).xCenterExpr) setXCenterExpr((ex as any).xCenterExpr);
        if ((ex as any).xHalfWidth) setXHalfWidth(String((ex as any).xHalfWidth));
      } else {
        setXMode("fixed");
        if ((ex as any).xm) setXMin(String((ex as any).xm));
        if ((ex as any).xx) setXMax(String((ex as any).xx));
      }
    }
  }

  /* ── Plot ─────────────────────────────────────────────────────────────── */
  async function loadPlot() {
    const sols = allSolsRef.current;
    const isGen = searchMetaRef.current.mode === "gen";
    const isThreeUnknown = Boolean(searchMetaRef.current.threeUnknowns);
    let xMinP = isGen ? parseFloat(searchMetaRef.current.genXMin||"-50")||(-50) : parseFloat(searchMetaRef.current.xMin||"-1000")||(-1000);
    let xMaxP = isGen ? parseFloat(searchMetaRef.current.genXMax||"50")||(50) : parseFloat(searchMetaRef.current.xMax||"1000")||(1000);
    const solXs = sols.map(s => parseFloat(String(s.x))).filter(Number.isFinite);
    if (solXs.length) {
      const lo = Math.min(...solXs), hi = Math.max(...solXs);
      const pad = Math.max(5, (hi-lo)*0.15);
      xMinP = Math.min(xMinP, lo-pad); xMaxP = Math.max(xMaxP, hi+pad);
    }
    const span = xMaxP - xMinP;
    if (span > 4000) { const cx = (xMinP+xMaxP)/2; xMinP=cx-200; xMaxP=cx+200; }

    let pN: string;
    let solsForN: {n:string;x:string;y:string}[];
    if (sols.length > 0) {
      pN = String(sols[0].n);
      solsForN = sols.filter(s => String(s.n) === pN).map(s => ({ n: String(s.n), x: String(s.x), y: String(s.y) }));
    } else {
      pN = searchMetaRef.current.nMin || "0";
      solsForN = [];
    }
    plotSliceSolsRef.current = solsForN;
    plotSolsRef.current = (isThreeUnknown ? sols : solsForN).map(s => ({
      n: String(s.n),
      x: String(s.x),
      y: String(s.y),
    }));
    setPlotSupports3D(isThreeUnknown);
    setPlotView(isThreeUnknown ? "surface3d" : "slice2d");
    setPlot3DWireData(null);

    const body: any = {
      mode: isGen?"gen":"ec",
      n_val: pN,
      x_min: xMinP,
      x_max: xMaxP,
      solutions: solsForN.map(s => ({ x: s.x, y: s.y })),
    };
    if (isGen) body.eq = searchMetaRef.current.genEq;
    else body.expr = searchMetaRef.current.equation?.replace("y² = ","").trim() || expr.trim();

    try {
      const r = await fetch("/api/plot", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.ok) {
        const hasSomething = d.pos_segments?.length || d.neg_segments?.length || solsForN.length > 0;
        if (hasSomething) {
          setPlotData(d); plotDataRef.current = d;
          const vp = { xMin: d.x_min, xMax: d.x_max, yMin: d.y_min, yMax: d.y_max };
          setViewport(vp); viewportRef.current = vp;
          setPlotN(pN);
          setShowPlot(true);
        }
      }
    } catch {}

    if (isThreeUnknown) {
      const body3d: any = {
        mode: isGen ? "gen" : "ec",
        n_min: searchMetaRef.current.nMin,
        n_max: searchMetaRef.current.nMax,
        x_min: xMinP,
        x_max: xMaxP,
        samples_n: 26,
        samples_x: 58,
      };
      if (isGen) body3d.eq = searchMetaRef.current.genEq;
      else body3d.expr = searchMetaRef.current.equation?.replace("y² = ","").trim() || expr.trim();
      try {
        const r3 = await fetch("/api/plot3d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body3d),
        });
        const d3 = await r3.json();
        if (d3?.ok) {
          setPlot3DWireData(d3);
          plot3DWireDataRef.current = d3;
        }
      } catch {}
    }
  }

  /* ── Render plot ──────────────────────────────────────────────────────── */
  const renderPlot = useCallback(() => {
    const canvas = canvasRef.current;
    const pd = plotDataRef.current;
    const vp = viewportRef.current;
    if (!canvas || !pd || !vp) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const container = canvas.parentElement;
    const W = Math.max(300, Math.min(container ? container.clientWidth - 2 : 700, 900));
    const H = Math.round(W * 0.5);
    canvas.width = W*dpr; canvas.height = H*dpr;
    canvas.style.width = W+"px"; canvas.style.height = H+"px";
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const PAD = { L:52, R:20, T:22, B:36 };
    const PW = W-PAD.L-PAD.R, PH = H-PAD.T-PAD.B;
    const { xMin:x_min, xMax:x_max, yMin:y_min, yMax:y_max } = vp;
    const { pos_segments=[], neg_segments=[] } = pd;
    const darkMode = document.documentElement.getAttribute("data-theme") === "dark";

    const tx = (x: number) => PAD.L + (x - x_min)/(x_max - x_min)*PW;
    const ty = (y: number) => PAD.T + (1 - (y - y_min)/(y_max - y_min))*PH;

    ctx.fillStyle = darkMode ? "#161b22" : "#ffffff";
    ctx.fillRect(0,0,W,H);

    if (plotViewRef.current !== "slice2d" && plotSupports3DRef.current) {
      const view = plotViewRef.current;
      const toPts = plotSolsRef.current.map(s => {
        const n = parseRationalToFloat(s.n);
        const x = parseRationalToFloat(s.x);
        const y = parseRationalToFloat(s.y);
        const isInt = isIntegerLiteral(s.n) && isIntegerLiteral(s.x) && isIntegerLiteral(s.y);
        return Number.isFinite(n) && Number.isFinite(x) && Number.isFinite(y)
          ? { n, x, y, raw: s, isInt }
          : null;
      }).filter((p): p is { n:number; x:number; y:number; raw:{n:string;x:string;y:string}; isInt:boolean } => p !== null)
        .filter(p => {
          const f = filterRef.current;
          if (f === "all") return true;
          return f === "integer" ? p.isInt : !p.isInt;
        });

      const wireSegsRaw = (plot3DWireDataRef.current?.wire_segments ?? []) as number[][][];
      const wireSegs = (view === "surface3d")
        ? wireSegsRaw
            .map(seg => seg
              .map(p => [Number(p[0]), Number(p[1]), Number(p[2])] as [number, number, number])
              .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])))
            .filter(seg => seg.length > 1)
        : [];

      const spacePts = [
        ...toPts.map(p => [p.n, p.x, p.y] as [number, number, number]),
        ...wireSegs.flat(),
      ];
      if (!spacePts.length) {
        setPlotCaption(view === "surface3d"
          ? "3D surface view: no sampled real branches in this range."
          : "3D cloud view: no points available for current filter.");
        return;
      }

      const nVals = spacePts.map(p => p[0]), xVals = spacePts.map(p => p[1]), yVals = spacePts.map(p => p[2]);
      const nMin = Math.min(...nVals), nMax = Math.max(...nVals);
      const xMin3 = Math.min(...xVals), xMax3 = Math.max(...xVals);
      const yMin3 = Math.min(...yVals), yMax3 = Math.max(...yVals);
      const spanN = Math.max(1e-9, nMax - nMin);
      const spanX = Math.max(1e-9, xMax3 - xMin3);
      const spanY = Math.max(1e-9, yMax3 - yMin3);
      const half = (v: number, lo: number, span: number) => ((v - lo) / span - 0.5) * 2;

      const cam = plot3DCameraRef.current;
      const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const cx = W / 2;
      const cyScreen = H / 2;
      const scale = Math.min(W, H) * 0.34 * cam.zoom;

      const project = (pn: number, px: number, py: number) => {
        const x0 = half(px, xMin3, spanX);
        const y0 = half(py, yMin3, spanY);
        const z0 = half(pn, nMin, spanN); // z axis is n
        const x1 = x0 * cy - z0 * sy;
        const z1 = x0 * sy + z0 * cy;
        const y2 = y0 * cp - z1 * sp;
        const z2 = y0 * sp + z1 * cp;
        const depth = 1 / (1 + (z2 + 1.5) * 0.42);
        return { x: cx + x1 * scale * depth, y: cyScreen - y2 * scale * depth, z: z2, depth };
      };

      const drawLine3 = (a: [number, number, number], b: [number, number, number], color: string, w = 1, dash: number[] = []) => {
        const pa = project(a[0], a[1], a[2]);
        const pb = project(b[0], b[1], b[2]);
        ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        ctx.setLineDash([]);
      };

      const corners: [number, number, number][] = [
        [nMin, xMin3, yMin3], [nMin, xMax3, yMin3], [nMin, xMax3, yMax3], [nMin, xMin3, yMax3],
        [nMax, xMin3, yMin3], [nMax, xMax3, yMin3], [nMax, xMax3, yMax3], [nMax, xMin3, yMax3],
      ];
      const edges: [number, number][] = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
      for (const [a, b] of edges) drawLine3(corners[a], corners[b], darkMode ? "#2f3942" : "#d1d5db", 1);

      drawLine3([nMin, xMin3, yMin3], [nMax, xMin3, yMin3], darkMode ? "#a78bfa" : "#6d28d9", 1.8);
      drawLine3([nMin, xMin3, yMin3], [nMin, xMax3, yMin3], darkMode ? "#60a5fa" : "#1d4ed8", 1.8);
      drawLine3([nMin, xMin3, yMin3], [nMin, xMin3, yMax3], darkMode ? "#34d399" : "#047857", 1.8);

      const axisLabel = (pt: [number, number, number], txt: string, col: string) => {
        const p = project(pt[0], pt[1], pt[2]);
        ctx.fillStyle = col;
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(txt, p.x + 5, p.y - 5);
      };
      axisLabel([nMax, xMin3, yMin3], "n", darkMode ? "#c4b5fd" : "#6d28d9");
      axisLabel([nMin, xMax3, yMin3], "x", darkMode ? "#93c5fd" : "#1d4ed8");
      axisLabel([nMin, xMin3, yMax3], "y", darkMode ? "#6ee7b7" : "#047857");

      if (view === "surface3d" && wireSegs.length > 0) {
        const wireColor = darkMode ? "rgba(96,165,250,0.34)" : "rgba(37,99,235,0.30)";
        const orderedSegs = wireSegs
          .map(seg => {
            const proj = seg.map(p => project(p[0], p[1], p[2]));
            const avgZ = proj.reduce((a, p) => a + p.z, 0) / proj.length;
            return { seg, proj, avgZ };
          })
          .sort((a, b) => a.avgZ - b.avgZ);
        for (const ws of orderedSegs) {
          ctx.strokeStyle = wireColor;
          ctx.lineWidth = 1.05;
          ctx.beginPath();
          ctx.moveTo(ws.proj[0].x, ws.proj[0].y);
          for (let i = 1; i < ws.proj.length; i++) ctx.lineTo(ws.proj[i].x, ws.proj[i].y);
          ctx.stroke();
        }
      }

      const plotted = toPts.map(p => ({ ...project(p.n, p.x, p.y), p })).sort((a, b) => a.z - b.z);
      for (const dp of plotted) {
        const r = Math.max(2.8, Math.min(7, 4.1 * dp.depth + 1.9));
        ctx.globalAlpha = view === "surface3d" ? 0.82 : 1;
        if (dp.p.isInt) {
          ctx.fillStyle = "#ef4444";
          ctx.strokeStyle = darkMode ? "#161b22" : "#fff";
          const s = r * 1.4;
          ctx.fillRect(dp.x - s/2, dp.y - s/2, s, s);
          ctx.lineWidth = 1;
          ctx.strokeRect(dp.x - s/2, dp.y - s/2, s, s);
        } else {
          ctx.strokeStyle = darkMode ? "#60a5fa" : "#2563eb";
          ctx.fillStyle = darkMode ? "rgba(96,165,250,0.16)" : "rgba(37,99,235,0.1)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(dp.x, dp.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      if (showLabelsRef.current && plotted.length <= 35) {
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        for (const dp of plotted) {
          const lbl = `(${dp.p.raw.n}, ${dp.p.raw.x}, ${dp.p.raw.y})`;
          const tw = ctx.measureText(lbl).width;
          const lx = dp.x + 8;
          const ly = dp.y - 7;
          ctx.fillStyle = darkMode ? "rgba(22,27,34,.85)" : "rgba(255,255,255,.85)";
          ctx.fillRect(lx - 2, ly - 10, tw + 4, 12);
          ctx.fillStyle = darkMode ? "#f0f6fc" : "#111827";
          ctx.fillText(lbl, lx, ly);
        }
      }

      ctx.fillStyle = darkMode ? "#8b949e" : "#6b7280";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`n: [${fmtNum(nMin)}, ${fmtNum(nMax)}]`, 12, H - 36);
      ctx.fillText(`x: [${fmtNum(xMin3)}, ${fmtNum(xMax3)}]`, 12, H - 22);
      ctx.fillText(`y: [${fmtNum(yMin3)}, ${fmtNum(yMax3)}]`, 12, H - 8);

      const wireCount = wireSegs.length;
      if (view === "surface3d") {
        setPlotCaption(
          `3D sampled implicit wireframe (n, x, y) | ${wireCount} segment${wireCount !== 1 ? "s" : ""}, `
          + `${plotted.length} highlighted point${plotted.length !== 1 ? "s" : ""}`,
        );
      } else {
        setPlotCaption(`3D cloud over (n, x, y) | ${plotted.length} point${plotted.length !== 1 ? "s" : ""} shown`);
      }
      return;
    }

    ctx.strokeStyle = darkMode ? "#21262d" : "#e5e7eb";
    ctx.lineWidth = 1; ctx.setLineDash([3,4]);
    for (let i=0;i<=8;i++) { const gx=PAD.L+(i/8)*PW; ctx.beginPath(); ctx.moveTo(gx,PAD.T); ctx.lineTo(gx,PAD.T+PH); ctx.stroke(); }
    for (let i=0;i<=6;i++) { const gy=PAD.T+(i/6)*PH; ctx.beginPath(); ctx.moveTo(PAD.L,gy); ctx.lineTo(PAD.L+PW,gy); ctx.stroke(); }
    ctx.setLineDash([]);

    ctx.strokeStyle = darkMode ? "#8b949e" : "#9ca3af"; ctx.lineWidth = 1.2;
    if (x_min<=0 && 0<=x_max) { const ax=tx(0); ctx.beginPath(); ctx.moveTo(ax,PAD.T); ctx.lineTo(ax,PAD.T+PH); ctx.stroke(); }
    if (y_min<=0 && 0<=y_max) { const ay=ty(0); ctx.beginPath(); ctx.moveTo(PAD.L,ay); ctx.lineTo(PAD.L+PW,ay); ctx.stroke(); }

    ctx.fillStyle = darkMode ? "#8b949e" : "#6b7280";
    ctx.font = "11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let i=0;i<=8;i+=2) ctx.fillText(fmtNum(x_min+(i/8)*(x_max-x_min)), PAD.L+(i/8)*PW, PAD.T+PH+4);
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let i=0;i<=6;i+=2) ctx.fillText(fmtNum(y_max-(i/6)*(y_max-y_min)), PAD.L-4, PAD.T+(i/6)*PH);

    ctx.save();
    ctx.beginPath(); ctx.rect(PAD.L,PAD.T,PW,PH); ctx.clip();
    ctx.strokeStyle = darkMode ? "#60a5fa" : "#2563eb"; ctx.lineWidth = 2; ctx.lineJoin = "round";
    const drawSeg = (seg: number[][]) => {
      if (seg.length < 2) return;
      ctx.beginPath(); ctx.moveTo(tx(seg[0][0]), ty(seg[0][1]));
      for (let i=1;i<seg.length;i++) ctx.lineTo(tx(seg[i][0]), ty(seg[i][1]));
      ctx.stroke();
    };
    for (const seg of pos_segments) drawSeg(seg);
    for (const seg of neg_segments) drawSeg(seg);

    const f = filterRef.current;
    const visSols = plotSliceSolsRef.current.filter(s => {
      if (f === "all") return true;
      const ii = isIntegerLiteral(s.n) && isIntegerLiteral(s.x) && isIntegerLiteral(s.y);
      return f === "integer" ? ii : !ii;
    });

    /* ── Symmetry mirror (y → −y) ── */
    if (showSymmetryRef.current) {
      if (y_min < 0 && 0 < y_max) {
        const ay = ty(0);
        ctx.strokeStyle = darkMode ? "#f59e0b" : "#d97706";
        ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(PAD.L, ay); ctx.lineTo(PAD.L+PW, ay); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 0.32;
      for (const { x, y } of visSols) {
        const fx = parseRationalToFloat(x), fy = parseRationalToFloat(y);
        if (!Number.isFinite(fx) || !Number.isFinite(fy) || fy === 0) continue;
        const rpx = tx(fx), rpy = ty(-fy);
        if (rpy < PAD.T || rpy > PAD.T+PH) continue;
        ctx.strokeStyle = darkMode ? "#60a5fa" : "#9ca3af"; ctx.lineWidth = 1; ctx.setLineDash([2,3]);
        ctx.beginPath(); ctx.moveTo(tx(fx), ty(fy)); ctx.lineTo(rpx, rpy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = darkMode ? "#60a5fa" : "#9ca3af";
        ctx.beginPath(); ctx.arc(rpx, rpy, 3, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* ── Points: integer (■) vs rational (○) ── */
    for (const { x, y } of visSols) {
      const fx = parseRationalToFloat(x), fy = parseRationalToFloat(y);
      if (!Number.isFinite(fx) || !Number.isFinite(fy)) continue;
      const px = tx(fx), py = ty(fy);
      const isIntPt = isIntegerLiteral(x) && isIntegerLiteral(y);
      if (isIntPt) {
        const sz = 8;
        ctx.fillStyle = "#ef4444";
        ctx.strokeStyle = darkMode ? "#161b22" : "#fff"; ctx.lineWidth = 1.5;
        ctx.fillRect(px-sz/2, py-sz/2, sz, sz); ctx.strokeRect(px-sz/2, py-sz/2, sz, sz);
      } else {
        ctx.strokeStyle = darkMode ? "#60a5fa" : "#2563eb";
        ctx.fillStyle = darkMode ? "rgba(96,165,250,0.15)" : "rgba(37,99,235,0.08)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, 5.5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
      if (showLabelsRef.current) {
        // For rational non-integers, preserve the exact fraction string in the label
        const lx_str = isIntPt ? fmtNum(fx) : String(x);
        const ly_str = isIntPt ? fmtNum(fy) : String(y);
        const label = `(${lx_str}, ${ly_str})`;
        ctx.font = "bold 11px sans-serif";
        const tw = ctx.measureText(label).width;
        let lx = px+10, ly = py-10;
        if (lx+tw+4 > PAD.L+PW) lx = px-tw-10;
        ctx.fillStyle = darkMode ? "rgba(22,27,34,.85)" : "rgba(255,255,255,.85)";
        ctx.fillRect(lx-2, ly-11, tw+4, 14);
        ctx.fillStyle = darkMode ? "#f0f6fc" : "#111827";
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillText(label, lx, ly);
      }
    }

    /* ── Chord / tangent construction ── */
    if (showConstructionRef.current && groupLawPointRef.current) {
      const sols = plotSliceSolsRef.current;
      const getCoord = (v: string) => {
        if (v === "O") return null;
        const i = parseInt(v, 10);
        if (isNaN(i) || !sols[i]) return null;
        return { x: parseFloat(String(sols[i].x)), y: parseFloat(String(sols[i].y)) };
      };
      const P = getCoord(glPRef.current), Q = getCoord(glQRef.current);
      const R = groupLawPointRef.current;           // P⊕Q (final reflected result)
      const Ri = { x: R.x, y: -R.y };              // pre-reflection intersection on curve
      if (P && Number.isFinite(P.x) && Number.isFinite(P.y) && Number.isFinite(R.x)) {
        const isDoubling = !Q || (Math.abs(P.x-Q.x)<1e-9 && Math.abs(P.y-Q.y)<1e-9);
        // The chord/tangent line passes through P and Ri
        const L1x=P.x, L1y=P.y, L2x=Ri.x, L2y=Ri.y;
        if (Math.abs(L2x-L1x) > 1e-10) {
          const slope = (L2y-L1y)/(L2x-L1x);
          ctx.strokeStyle = darkMode ? "#f59e0b" : "#b45309"; ctx.lineWidth = 1.5; ctx.setLineDash([7,4]);
          ctx.beginPath();
          ctx.moveTo(tx(x_min), ty(L1y+slope*(x_min-L1x)));
          ctx.lineTo(tx(x_max), ty(L1y+slope*(x_max-L1x)));
          ctx.stroke(); ctx.setLineDash([]);
        }
        // Highlight Q when chord (different points)
        if (!isDoubling && Q && Number.isFinite(Q.x)) {
          ctx.fillStyle = darkMode ? "#fbbf24" : "#d97706";
          ctx.beginPath(); ctx.arc(tx(Q.x), ty(Q.y), 7, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = darkMode ? "#161b22" : "#fff"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(tx(Q.x), ty(Q.y), 7, 0, Math.PI*2); ctx.stroke();
        }
        // Vertical reflection line Ri → R
        if (Number.isFinite(Ri.y)) {
          ctx.strokeStyle = darkMode ? "#a78bfa" : "#7c3aed"; ctx.lineWidth = 1.5; ctx.setLineDash([4,3]);
          ctx.beginPath(); ctx.moveTo(tx(Ri.x), ty(Ri.y)); ctx.lineTo(tx(R.x), ty(R.y));
          ctx.stroke(); ctx.setLineDash([]);
          // Ri: pre-reflection intersection point (amber)
          ctx.fillStyle = darkMode ? "#f59e0b" : "#b45309";
          ctx.beginPath(); ctx.arc(tx(Ri.x), ty(Ri.y), 5, 0, Math.PI*2); ctx.fill();
          // R = P⊕Q: final result (violet)
          ctx.fillStyle = darkMode ? "#a78bfa" : "#7c3aed";
          ctx.beginPath(); ctx.arc(tx(R.x), ty(R.y), 7, 0, Math.PI*2); ctx.fill();
          ctx.font = "bold 11px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
          ctx.fillStyle = darkMode ? "#a78bfa" : "#7c3aed";
          ctx.fillText(`P⊕Q=(${fmtNum(R.x)},${fmtNum(R.y)})`, tx(R.x)+9, ty(R.y)-7);
        }
      }
    }

    ctx.restore();

    ctx.strokeStyle = darkMode ? "#30363d" : "#d1d5db"; ctx.lineWidth = 1;
    ctx.strokeRect(PAD.L,PAD.T,PW,PH);
      setPlotCaption(`Curve slice at n = ${pd.n_val}  |  ${visSols.length} point${visSols.length!==1?"s":""} highlighted`);
  }, []);

  useEffect(() => {
    if (showPlot && plotData && viewport) renderPlot();
  }, [showPlot, plotData, plot3DWireData, viewport, showLabels, pointFilter, plotView, plotSupports3D, plot3DCamera, showSymmetry, showConstruction, groupLawPoint, renderPlot]);

  /* ── Canvas zoom / pan ────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasEventsRef.current) return;
    canvasEventsRef.current = true;
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (plotViewRef.current !== "slice2d") {
        const cam = plot3DCameraRef.current;
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const nv = { ...cam, zoom: Math.max(0.45, Math.min(2.8, cam.zoom * factor)) };
        plot3DCameraRef.current = nv;
        setPlot3DCamera(nv);
        renderPlot();
        return;
      }
      const vp = viewportRef.current; if (!vp) return;
      const rect = canvas.getBoundingClientRect();
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      const PW = W-72, PH = H-58;
      const mx = e.clientX-rect.left, my = e.clientY-rect.top;
      const cx = vp.xMin + (mx-52)/PW*(vp.xMax-vp.xMin);
      const cy = vp.yMax - (my-22)/PH*(vp.yMax-vp.yMin);
      const ff = e.deltaY > 0 ? 1.25 : 0.8;
      const nv = { xMin:cx-(cx-vp.xMin)*ff, xMax:cx+(vp.xMax-cx)*ff, yMin:cy-(cy-vp.yMin)*ff, yMax:cy+(vp.yMax-cy)*ff };
      viewportRef.current = nv; setViewport(nv); renderPlot();
    }, {passive:false});
    let drag: any = null;
    canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (plotViewRef.current !== "slice2d") {
        drag = { x: e.clientX, y: e.clientY, mode: "3d", cam: { ...plot3DCameraRef.current } };
      } else {
        drag = { x:e.clientX, y:e.clientY, mode: "2d", vp:{...viewportRef.current!} };
      }
    });
    canvas.addEventListener("mousemove", (e) => {
      if (!drag) return;
      if (drag.mode === "3d") {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        const nv = {
          ...drag.cam,
          yaw: drag.cam.yaw + dx * 0.008,
          pitch: Math.max(-1.25, Math.min(1.25, drag.cam.pitch + dy * 0.008)),
        };
        plot3DCameraRef.current = nv;
        setPlot3DCamera(nv);
        renderPlot();
      } else {
        const vp = drag.vp;
        const W = canvas.offsetWidth, H = canvas.offsetHeight, PW = W-72, PH = H-58;
        const dx = (e.clientX-drag.x)/PW*(vp.xMax-vp.xMin);
        const dy = (e.clientY-drag.y)/PH*(vp.yMax-vp.yMin);
        const nv = {xMin:vp.xMin-dx,xMax:vp.xMax-dx,yMin:vp.yMin+dy,yMax:vp.yMax+dy};
        viewportRef.current = nv; setViewport(nv); renderPlot();
      }
    });
    const end = () => { drag = null; };
    canvas.addEventListener("mouseup", end); canvas.addEventListener("mouseleave", end);
  }, [showPlot, renderPlot]);

  /* ── Group law calculator ─────────────────────────────────────────────── */
  async function computeGroupLaw() {
    const sols = allSolsRef.current;
    const getPoint = (v: string) => {
      if (v === "O") return null;
      const idx = parseInt(v, 10);
      if (!isNaN(idx) && sols[idx]) return { x: String(sols[idx].x), y: String(sols[idx].y) };
      return null; // treat unknown as O
    };
    // Derive n from whichever point is a real solution; fall back to plotN or "0"
    const getNFromSel = (v: string) => {
      const idx = parseInt(v, 10);
      if (!isNaN(idx) && sols[idx]) return String(sols[idx].n);
      return null;
    };
    const nVal = (getNFromSel(glP) ?? getNFromSel(glQ) ?? plotN) || "0";
    const P = getPoint(glP), Q = getPoint(glQ);
    try {
      const r = await fetch("/api/group_law", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ expr: expr.trim(), n_val: nVal, p1: P, p2: Q }),
      });
      const d = await r.json();
      if (d.ok) {
        if (d.is_infinity) {
          setGroupLawResult("P ⊕ Q = O (point at infinity)");
          setGroupLawPoint(null); groupLawPointRef.current = null;
        } else {
          setGroupLawResult(`P ⊕ Q = (${d.result.x}, ${d.result.y})`);
          const rx = parseFloat(d.result.x), ry = parseFloat(d.result.y);
          if (Number.isFinite(rx) && Number.isFinite(ry)) {
            const pt = { x: rx, y: ry };
            setGroupLawPoint(pt); groupLawPointRef.current = pt;
          }
        }
      }
      else setGroupLawResult("Error: " + d.error);
    } catch { setGroupLawResult("Request failed."); }
  }

  /* ── Export ───────────────────────────────────────────────────────────── */
  function exportCSV() {
    const rows = ["#,n,x,y", ...solutions.map((s,i) => `${i+1},${s.n},${s.x},${s.y}`)];
    const blob = new Blob([rows.join("\n")], {type:"text/csv"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "elliptic_solutions.csv"; a.click();
  }

  function exportSolverCertificates() {
    const payload = {
      schema: "diophantix.solver-certificate-bundle.v1",
      equation: searchMetaRef.current.equation,
      classification: curveClassification,
      rank_reports: rankReports,
      certificates: solverCertificates,
      replay_endpoint: "/api/solver-certificate/replay",
    };
    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      {type:"application/json"},
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "diophantix-elliptic-certificates.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportLatex() {
    const meta = searchMetaRef.current;
    const eq   = meta.equation || `y^2 = ${expr.trim()}`;
    // Escape the equation for LaTeX: replace ** with ^, * with \cdot, etc.
    const eqTex = eq
      .replace(/\*\*/g, "^")
      .replace(/\*/g, " \\cdot ")
      .replace(/y²/g, "y^2");
    const year = new Date().getFullYear();
    const date = new Date().toLocaleDateString("en-GB", {day:"2-digit", month:"long", year:"numeric"});

    // Table rows grouped by n
    const tableRows = filteredSols.map((s, i) =>
      `  ${i+1} & $${s.n}$ & $${s.x}$ & $${s.y}$ \\\\`
    ).join("\n");

    const tex = `\\documentclass[12pt,a4paper]{article}
\\usepackage[margin=2.5cm]{geometry}
\\usepackage{amsmath,amssymb}
\\usepackage{booktabs}
\\usepackage{longtable}
\\usepackage{hyperref}

\\title{Integer Points on Elliptic Curve\\\\
  \\large $${eqTex}$}
\\author{Diophantix}
\\date{${date}}

\\begin{document}
\\maketitle

\\section*{Curve}
\\[
  ${eqTex}
\\]

\\section*{Search Parameters}
\\begin{tabular}{ll}
  \\toprule
  Parameter & Value \\\\
  \\midrule
  $n$ range & $[${meta.nMin ?? "?"},\\;${meta.nMax ?? "?"}]$ \\\\
  $x$ range & $[${meta.xMin ?? "?"},\\;${meta.xMax ?? "?"}]$ \\\\
  Total solutions found & ${filteredSols.length} \\\\
  \\bottomrule
\\end{tabular}

\\section*{Solutions}
\\begin{longtable}{rrrr}
  \\toprule
  \\# & $n$ & $x$ & $y$ \\\\
  \\midrule
  \\endfirsthead
  \\toprule
  \\# & $n$ & $x$ & $y$ \\\\
  \\midrule
  \\endhead
  \\bottomrule
  \\endlastfoot
${tableRows}
\\end{longtable}

\\vfill
\\noindent\\small Generated by \\href{https://www.diophantix.com/app}{Diophantix}, ${year}.

\\end{document}
`;
    const blob = new Blob([tex], {type:"text/plain"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "elliptic_solutions.tex"; a.click();
  }

  function exportPDF() {
    try {
      const meta    = searchMetaRef.current;
      const eq      = meta.equation || `y² = ${expr.trim()}`;
      const date    = new Date().toLocaleDateString("en-GB", {day:"2-digit", month:"long", year:"numeric"});

      // Guard against tainted-canvas SecurityError
      let graphImg: string | null = null;
      try {
        if (canvasRef.current) graphImg = canvasRef.current.toDataURL("image/png");
      } catch { graphImg = null; }

      const sols = filteredSols;
      const tableRows = sols.map((s, i) =>
        `<tr><td>${i+1}</td><td>${escHtml(String(s.n))}</td><td>${escHtml(String(s.x))}</td><td>${escHtml(String(s.y))}</td></tr>`
      ).join("\n");

      const graphSection = graphImg
        ? `<section class="graph-section">
             <h2>Graph (n = ${escHtml(String(plotN))})</h2>
             <img src="${graphImg}" alt="Elliptic curve graph" />
           </section>`
        : "";

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Elliptic Curve Solutions</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 11pt; color: #000; padding: 2cm; }
    h1 { font-size: 18pt; margin-bottom: 4pt; }
    h2 { font-size: 13pt; margin: 18pt 0 6pt; border-bottom: 1px solid #ccc; padding-bottom: 3pt; }
    .meta { font-size: 10pt; color: #444; margin-bottom: 16pt; }
    .eq  { font-size: 13pt; font-family: "Courier New", monospace; background: #f5f5f5; padding: 8pt 12pt; display: inline-block; margin-bottom: 8pt; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 6pt; }
    th { background: #111; color: #fff; padding: 5pt 8pt; text-align: left; }
    td { padding: 4pt 8pt; border-bottom: 1px solid #e0e0e0; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .params td:first-child { font-weight: bold; width: 40%; }
    .graph-section img { max-width: 100%; border: 1px solid #ddd; margin-top: 6pt; }
    footer { margin-top: 24pt; font-size: 9pt; color: #888; border-top: 1px solid #ddd; padding-top: 8pt; }
    @media print {
      body { padding: 0; }
      @page { margin: 2cm; }
    }
  </style>
</head>
<body>
  <h1>Integer Points on Elliptic Curve</h1>
  <p class="meta">Generated by <strong>Diophantix</strong> &mdash; ${date}</p>

  <h2>Curve</h2>
  <div class="eq">${escHtml(eq)}</div>

  <h2>Search Parameters</h2>
  <table class="params">
    <tr><td>n range</td><td>[${escHtml(String(meta.nMin ?? "?"))}, ${escHtml(String(meta.nMax ?? "?"))}]</td></tr>
    <tr><td>x range</td><td>[${escHtml(String(meta.xMin ?? "?"))}, ${escHtml(String(meta.xMax ?? "?"))}]</td></tr>
    <tr><td>Solutions found</td><td>${sols.length}</td></tr>
  </table>

  ${graphSection}

  <h2>Solutions (${sols.length})</h2>
  <table>
    <thead><tr><th>#</th><th>n</th><th>x</th><th>y</th></tr></thead>
    <tbody>
${tableRows}
    </tbody>
  </table>

  <footer>Diophantix</footer>
</body>
</html>`;

      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) { showToast("Allow pop-ups to export PDF"); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
      // Small delay so the image loads before the print dialog opens
      setTimeout(() => { win.print(); }, 500);
    } catch (err) {
      showToast("PDF export failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  function exportBibTeX() {
    const bib = `@misc{diophantix-${Date.now()},\n  title  = {Integer points on ${escHtml(searchMetaRef.current.equation||"parametric elliptic curve")}},\n  author = {{Diophantix}},\n  year   = {${new Date().getFullYear()}},\n  note   = {Found by Diophantix},\n  url    = {https://www.diophantix.com/app}\n}`;
    const blob = new Blob([bib], {type:"text/plain"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "elliptic_solutions.bib"; a.click();
  }

  function shareURL() {
    const p = new URLSearchParams({ expr: expr.trim(), n_min: nMin, n_max: nMax, n_denom: nDenom, x_min: xMin, x_max: xMax });
    const url = window.location.origin + "/app?" + p.toString();
    navigator.clipboard.writeText(url).then(() => showToast("URL copied to clipboard!")).catch(() => showToast("Copy failed"));
  }

  /* ── Toast ────────────────────────────────────────────────────────────── */
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function loadDemographics(promptForKey = true) {
    setDemographicsLoading(true);
    setDemographicsErr("");
    try {
      const key = sessionStorage.getItem("demo-admin-key") || "";
      let r = await fetch("/api/demographics", {
        headers: key ? { "x-admin-key": key } : {},
      });

      if (r.status === 403 && promptForKey) {
        const entered = window.prompt("Developer key");
        if (entered && entered.trim()) {
          sessionStorage.setItem("demo-admin-key", entered.trim());
          r = await fetch("/api/demographics", {
            headers: { "x-admin-key": entered.trim() },
          });
        }
      }

      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Could not load demographics");
      setDemographicsRows(Array.isArray(d.countries) ? d.countries : []);
      setDemographicsTotal(Number(d.total_visits || 0));
    } catch (err: any) {
      setDemographicsErr(err?.message || "Failed to load demographics");
    } finally {
      setDemographicsLoading(false);
    }
  }

  /* ── Filtered solutions ──────────────────────────────────────────────── */
  const filteredSols = solutions.filter(s => {
    if (pointFilter === "all") return true;
    const isInt = (v: string | number) => { const vs = String(v); return !vs.includes("/") && Number.isFinite(Number(vs)) && Number.isInteger(Number(vs)); };
    const ii = isInt(s.n) && isInt(s.x) && isInt(s.y);
    return pointFilter === "integer" ? ii : !ii;
  });

  /* ── Arithmetic observations (client-side, instant) ─────────────────── */
  const arithmeticObs = useMemo(
    () => computeArithObs(solutions, solverMode === "ec" ? expr : genEq, solverMode === "ec"),
    [solutions, solverMode, expr, genEq],
  );

  /* ── Solutions table rows ─────────────────────────────────────────────── */
  function renderSolutionsTable() {
    const rows: React.ReactNode[] = [];
    let lastN: string | null = null;
    filteredSols.forEach((sol, i) => {
      if (String(sol.n) !== lastN) {
        lastN = String(sol.n);
        rows.push(<tr key={"g"+sol.n+i} className="n-group-row"><td colSpan={6}>n = {sol.n}</td></tr>);
      }
      rows.push(
        <tr key={i} className="new-row">
          <td>{i+1}</td>
          <td>{sol.n}</td>
          <td>{sol.x}</td>
          <td>{sol.y}</td>
          <td className="cell-height">{computeHeight(sol.n, sol.x, sol.y)}</td>
          <td className="cell-valid"><CheckIcon /> {t("cell-verified")}</td>
        </tr>
      );
    });
    return rows;
  }

  /* ── Curve info ───────────────────────────────────────────────────────── */
  function renderCurveInfoRow(ci: any, idx: number) {
    const def = (v: any) => v !== undefined && v !== null ? String(v) : "—";
    return (
      <tr key={"ci"+idx} className="curve-info-row">
        <td colSpan={6}>
          <details className="curve-info-card">
            <summary className="ci-summary">
              <span className="ci-label">Curve invariants — n = {def(ci.n)}</span>
              {ci.curve_class && <span className="ci-badge">{ci.curve_class}</span>}
            </summary>
            <div className="ci-body">
              {ci.A !== undefined && (
                <div className="ci-section">
                  <div className="ci-sh">Short Weierstrass</div>
                  <div className="ci-kv"><span className="ci-key">Equation</span><span className="ci-val">{def(ci.short_weierstrass)}</span></div>
                  <div className="ci-kv"><span className="ci-key">A</span><span className="ci-val">{def(ci.A)}</span></div>
                  <div className="ci-kv"><span className="ci-key">B</span><span className="ci-val">{def(ci.B)}</span></div>
                </div>
              )}
              {ci.discriminant !== undefined && (
                <div className="ci-section">
                  <div className="ci-sh">Invariants</div>
                  <div className="ci-kv"><span className="ci-key">Discriminant Δ</span><span className="ci-val">{def(ci.discriminant)}</span></div>
                  <div className="ci-kv"><span className="ci-key">j-invariant</span><span className="ci-val">{def(ci.j_invariant)}</span></div>
                </div>
              )}
            </div>
          </details>
        </td>
      </tr>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Animated background canvas ── */}
      <canvas ref={bgCanvasRef} className="bg-canvas" aria-hidden />

      {/* ── BMC floating button ── */}
      {showBmc && (
        <a className="bmc-float" href="https://www.buymeacoffee.com/placeholder" target="_blank" rel="noopener noreferrer" aria-label="Buy me a coffee">
          <CoffeeIcon />
          <span>Buy me a coffee</span>
          <button className="bmc-close" type="button" aria-label="Dismiss" onClick={(e) => {
            e.preventDefault(); e.stopPropagation();
            setShowBmc(false);
            localStorage.setItem(BMC_KEY, String(Date.now() + 7*24*60*60*1000));
          }}><CloseIcon /></button>
        </a>
      )}

      {/* ── Font picker menu ── */}
      {showFontPicker && (
        <div className="wp-picker-menu" style={{top: fontPickerPos.top + "px", right: fontPickerPos.right + "px", minWidth:220}}>
          <div className="wp-picker-label">Sans-serif</div>
          {FONT_OPTIONS.filter(f => ["helvetica","opendyslexic","trebuchet","verdana","tahoma","optima","futura"].includes(f.id)).map(f => (
            <button key={f.id} className={"wp-opt" + (fontId===f.id?" active":"")} type="button"
              style={{fontFamily: f.stack}}
              onClick={() => { setFontId(f.id); localStorage.setItem("ecs-font", f.id); }}>
              {f.label}
            </button>
          ))}
          <div className="wp-picker-label" style={{marginTop:4}}>Serif</div>
          {FONT_OPTIONS.filter(f => ["georgia","palatino","garamond","baskerville","times","didot"].includes(f.id)).map(f => (
            <button key={f.id} className={"wp-opt" + (fontId===f.id?" active":"")} type="button"
              style={{fontFamily: f.stack}}
              onClick={() => { setFontId(f.id); localStorage.setItem("ecs-font", f.id); }}>
              {f.label}
            </button>
          ))}
          <div className="wp-picker-label" style={{marginTop:4}}>Monospace</div>
          {FONT_OPTIONS.filter(f => ["courier","menlo","monaco","lucida"].includes(f.id)).map(f => (
            <button key={f.id} className={"wp-opt" + (fontId===f.id?" active":"")} type="button"
              style={{fontFamily: f.stack}}
              onClick={() => { setFontId(f.id); localStorage.setItem("ecs-font", f.id); }}>
              {f.label}
            </button>
          ))}
          <div className="wp-picker-label" style={{marginTop:4}}>System</div>
          {FONT_OPTIONS.filter(f => ["system","ui-serif","ui-mono"].includes(f.id)).map(f => (
            <button key={f.id} className={"wp-opt" + (fontId===f.id?" active":"")} type="button"
              style={{fontFamily: f.stack}}
              onClick={() => { setFontId(f.id); localStorage.setItem("ecs-font", f.id); }}>
              {f.label}
            </button>
          ))}
          <div className="wp-picker-label" style={{marginTop:6}}>Size</div>
          <div style={{display:"flex", gap:3, padding:"4px 8px 6px"}}>
            {FONT_SIZES.map(s => (
              <button key={s.id}
                type="button"
                onClick={() => { setFontSizeId(s.id); localStorage.setItem("ecs-font-size", s.id); }}
                style={{
                  flex:1, padding:"4px 2px", border: "1px solid var(--border)",
                  background: fontSizeId===s.id ? "var(--text)" : "transparent",
                  color: fontSizeId===s.id ? "var(--bg)" : "var(--text-dim)",
                  fontSize:".65rem", cursor:"pointer", fontFamily:"var(--font-mono)",
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="site-header above-canvas">
        <div className="header-inner">
          <Link href="/" className="logo-group" style={{textDecoration:"none",color:"inherit"}}>
            <span className="logo-icon">∮</span>
            <div>
              <div className="site-title">{t("brand-title")}</div>
              <div className="site-sub">{t("brand-sub")}</div>
            </div>
          </Link>
          <nav className="header-nav">
            <Link className="nav-link" href="/">{t("nav-home")}</Link>
            <Link className="nav-link" href="/explore">{t("nav-explore")}</Link>
            <Link className="nav-link" href="/conjecture">{t("nav-conjecture")}</Link>
            <Link className="nav-link" href="/memory">{t("nav-memory")}</Link>
            <a className="btn-github" href="https://github.com/JAgbanwa/elliptic-curve-solver-app-or-website" target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:"5px",textDecoration:"none"}}>
              <GithubIcon /> {t("nav-github")}
            </a>
            <select
              className="lang-select"
              title="Language"
              aria-label="Language"
              value={lang}
              onChange={(e) => setLang(e.target.value as typeof lang)}
            >
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>{opt.label}</option>
              ))}
            </select>
            <button className="btn-icon" type="button" title="Font & size" onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setFontPickerPos({top: r.bottom+6, right: window.innerWidth-r.right});
              setShowFontPicker(!showFontPicker);
            }}>
              <TypeIcon />
            </button>
            <button className="btn-theme" type="button" onClick={toggleTheme} title={isDark ? t("theme-light") : t("theme-dark")}>
              {isDark ? <SunIcon /> : <MoonIcon />}
              {isDark ? t("theme-light") : t("theme-dark")}
            </button>
          </nav>
        </div>
      </header>

      {/* ── History Drawer ── */}
      {showHistory && (
        <>
          <div className="history-backdrop" onClick={() => setShowHistory(false)} />
          <div className="history-drawer" role="dialog" aria-modal aria-label={t("history-title")}>
            <div className="history-drawer-header">
              <span className="history-drawer-title">{t("history-title")}</span>
              <button className="history-clear-btn" type="button" onClick={clearHistory}>{t("history-clear-all")}</button>
              <button className="history-close-btn" type="button" aria-label={t("btn-clear")} onClick={() => setShowHistory(false)}><CloseIcon /></button>
            </div>
            <div className="history-list">
              {history.length === 0 && <p style={{color:"var(--text-dim)",padding:"20px",fontSize:".82rem"}}>{t("history-empty")}</p>}
              {history.map(h => (
                <div key={h.id} className="history-item" onClick={() => loadHistoryItem(h)}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div className="history-item-eq">{h.equation}</div>
                    <div className="history-item-actions" onClick={e => e.stopPropagation()}>
                      <button className={"history-action-btn"+(h.pinned?" pinned":"")} type="button" title={t("btn-history")} onClick={() => pinHistoryItem(h.id)}><PinIcon /></button>
                      <button className="history-action-btn del" type="button" title={t("history-delete")} onClick={() => deleteHistoryItem(h.id)}><TrashIcon /></button>
                    </div>
                  </div>
                  <div className="history-item-meta">
                    n: [{h.nMin}, {h.nMax}] · {h.solCount} {h.solCount!==1?t("sol-plural"):t("sol-singular")} · {new Date(h.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Main App ── */}
      <main className="main-grid above-canvas" id="app">

        {/* ─── Left panel: inputs ─────────────────────────────────────────── */}
        <aside className="panel">
          <div className="panel-title">{t("panel-title")}</div>

          {/* Solver mode tabs */}
          <div className="solver-tabs">
            <button className={"solver-tab"+(solverMode==="ec"?" active":"")} type="button" onClick={() => setSolverMode("ec")}>{t("tab-ec")}</button>
            <button className={"solver-tab"+(solverMode==="gen"?" active":"")} type="button" onClick={() => setSolverMode("gen")}>{t("tab-gen")}</button>
          </div>

          {/* EC mode */}
          {solverMode === "ec" && (
            <>
              <div className="var-tabs">
                <button className={"var-tab"+(ecVarMode==="2var"?" active":"")} type="button" onClick={() => setEcVarMode("2var")}><span dangerouslySetInnerHTML={{ __html: t("ec-tab-2var-html") }} /></button>
                <button className={"var-tab"+(ecVarMode==="3var"?" active":"")} type="button" onClick={() => setEcVarMode("3var")}><span dangerouslySetInnerHTML={{ __html: t("ec-tab-3var-html") }} /></button>
              </div>

              <div className="param-section">
                <label className="param-label" htmlFor="expr-input">{t("label-expr")} — y² = <strong>{ecVarMode==="3var"?"f(n, x)":"f(x)"}</strong></label>
                <textarea
                  id="expr-input"
                  className="text-input equation-textarea"
                  rows={5}
                  value={expr}
                  onChange={event => setExpr(event.target.value)}
                  placeholder={t("placeholder-expr")}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className={"preview-box"+(latexError?" error":"")}>
                  {latexPreview
                    ? <span style={{fontSize:"1.05rem"}}>y² = {latexPreview}</span>
                    : <span className="dim">{t("latex-preview-dim")}</span>
                  }
                </div>
                <details className="latex-import">
                  <summary>{t("latex-import-sum")}</summary>
                  <div className="latex-import-body">
                    <label className="param-label" htmlFor="latex-paste">{t("label-latex-paste")}</label>
                    <textarea id="latex-paste" className="latex-textarea" rows={3} spellCheck={false} placeholder={t("ph-latex-paste")} value={latexPaste} onChange={e => setLatexPaste(e.target.value)} />
                    <div className="latex-import-row">
                      <button className="btn btn-ghost btn-sm" type="button" onClick={convertLatex}>{t("btn-convert-latex")}</button>
                      {latexStatus && <span className={"latex-status"+(latexStatusOk?" ok":" err")}>{latexStatus}</span>}
                    </div>
                  </div>
                </details>
                <p className="hint">{t("hint-expr")}</p>
              </div>

              {ecVarMode === "2var" ? (
                <div className="param-section">
                  <label className="param-label" htmlFor="n-single">{t("label-ec-n-single")}</label>
                  <input id="n-single" className="num-input" type="text" value={nSingle} onChange={e => setNSingle(e.target.value)} />
                </div>
              ) : (
                <div className="param-section">
                  <div className="range-group">
                    <div className="range-field"><label className="param-label">{t("label-n-min")}</label><input className="num-input" type="text" value={nMin} onChange={e => setNMin(e.target.value)} /></div>
                    <div className="range-field"><label className="param-label">{t("label-n-max")}</label><input className="num-input" type="text" value={nMax} onChange={e => setNMax(e.target.value)} /></div>
                    <div className="range-field"><label className="param-label">{t("label-n-denom")}</label><input className="num-input" type="number" value={nDenom} min={1} max={100} onChange={e => setNDenom(e.target.value)} /></div>
                  </div>
                </div>
              )}

              <div className="param-section">
                <label className="param-label" htmlFor="x-mode">{t("label-x-mode")}</label>
                <select id="x-mode" className="mode-select" value={xMode} onChange={e => setXMode(e.target.value)}>
                  <option value="fixed">{t("xmode-fixed")}</option>
                </select>
                {xMode === "fixed" && (
                  <div style={{marginTop:8}}>
                    <div className="range-group two-col">
                      <div className="range-field"><label className="param-label">{t("label-x-min")}</label><input className="num-input" type="number" value={xMin} onChange={e => setXMin(e.target.value)} /></div>
                      <div className="range-field"><label className="param-label">{t("label-x-max")}</label><input className="num-input" type="number" value={xMax} onChange={e => setXMax(e.target.value)} /></div>
                    </div>
                  </div>
                )}
                {xMode === "autoscale" && (
                  <div style={{marginTop:8}}>
                    <label className="param-label">{t("label-scale-factor")}</label>
                    <input className="num-input" type="number" value={xScaleFactor} min={1} max={500} onChange={e => setXScaleFactor(e.target.value)} />
                  </div>
                )}
                {xMode === "window" && (
                  <div style={{marginTop:8}}>
                    <label className="param-label">{t("label-x-center")}</label>
                    <input className="text-input" type="text" value={xCenterExpr} onChange={e => setXCenterExpr(e.target.value)} placeholder="e.g. 12*n" style={{marginBottom:6}} />
                    <label className="param-label">{t("label-half-width")}</label>
                    <input className="num-input" type="number" value={xHalfWidth} min={1} onChange={e => setXHalfWidth(e.target.value)} />
                    <p className="hint">{t("hint-window")}</p>
                  </div>
                )}
                {xMode === "divisor" && (
                  <div style={{marginTop:8}}>
                    <label className="param-label">{t("label-divisor-poly")}</label>
                    <input className="text-input" type="text" value={xDivisorPoly} onChange={e => setXDivisorPoly(e.target.value)} placeholder="e.g. 36*n**3 + 54*n**2" spellCheck={false} />
                    <label className="param-label" style={{marginTop:8}}>{t("label-divisor-max")}</label>
                    <input className="num-input" type="number" value={xDivisorMax} min={1} onChange={e => setXDivisorMax(e.target.value)} />
                  </div>
                )}
                {xMode === "exprrange" && (
                  <div style={{marginTop:8}}>
                    <label className="param-label">{t("label-x-start")}</label>
                    <input className="text-input" type="text" value={xStartExpr} onChange={e => setXStartExpr(e.target.value)} placeholder="e.g. n**2" spellCheck={false} style={{marginBottom:6}} />
                    <label className="param-label">{t("label-x-end")}</label>
                    <input className="text-input" type="text" value={xEndExpr} onChange={e => setXEndExpr(e.target.value)} placeholder="e.g. n**2 + 1000" spellCheck={false} style={{marginBottom:6}} />
                    <label className="param-label">{t("label-x-step")}</label>
                    <input className="text-input" type="text" value={xStepExpr} onChange={e => setXStepExpr(e.target.value)} placeholder="1" spellCheck={false} />
                    <p className="hint">{t("hint-exprrange")}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Gen mode */}
          {solverMode === "gen" && (
            <>
              <div className="var-tabs">
                <button className={"var-tab"+(genVarMode==="2var"?" active":"")} type="button" onClick={() => setGenVarMode("2var")}><span dangerouslySetInnerHTML={{ __html: t("gen-tab-2var-html") }} /></button>
                <button className={"var-tab"+(genVarMode==="3var"?" active":"")} type="button" onClick={() => setGenVarMode("3var")}><span dangerouslySetInnerHTML={{ __html: t("gen-tab-3var-html") }} /></button>
              </div>
              <div className="param-section">
                <label className="param-label" htmlFor="gen-eq">{t("label-gen-eq")}</label>
                <textarea
                  id="gen-eq"
                  className="text-input equation-textarea"
                  rows={6}
                  value={genEq}
                  onChange={event => setGenEq(event.target.value)}
                  placeholder={t("ph-gen-eq")}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="hint">{t("hint-gen")}</p>
              </div>
              <div className="param-section exact-domain-control">
                <label className="param-label">Point domain and engine</label>
                <div className="exact-domain-tabs" role="group" aria-label="General equation point domain">
                  {([
                    ["integer", "ℤ fast"],
                    ["rational", "ℚ non-integer"],
                    ["all", "ℤ + ℚ exact"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={"exact-domain-tab" + (genPointType === value ? " active" : "")}
                      aria-pressed={genPointType === value}
                      onClick={() => {
                        setGenPointType(value);
                        setPointFilter(value === "all" ? "all" : value);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {genPointType === "integer" ? (
                  <p className="hint">
                    Fast integer engine: vectorised enumeration plus exact arbitrary-precision verification.
                  </p>
                ) : (
                  <>
                    <div className="range-group two-col exact-rational-settings">
                      <div className="range-field">
                        <label className="param-label" htmlFor="gen-rational-height">Rational height H</label>
                        <input
                          id="gen-rational-height"
                          className="num-input"
                          type="number"
                          min={1}
                          max={250}
                          value={genRationalHeight}
                          onChange={event => setGenRationalHeight(event.target.value)}
                        />
                      </div>
                      <div className="range-field">
                        <label className="param-label" htmlFor="gen-solution-limit">Result cap</label>
                        <input
                          id="gen-solution-limit"
                          className="num-input"
                          type="number"
                          min={1}
                          max={10000}
                          value={genSolutionLimit}
                          onChange={event => setGenSolutionLimit(event.target.value)}
                        />
                      </div>
                    </div>
                    <label className="param-label">Coordinate coverage</label>
                    <div
                      className="exact-domain-tabs exact-projection-tabs"
                      role="group"
                      aria-label="Exact coordinate coverage"
                    >
                      {([
                        ["adaptive", "Adaptive fast"],
                        ["all", "3-way deep"],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={"exact-domain-tab" + (genProjectionMode === value ? " active" : "")}
                          aria-pressed={genProjectionMode === value}
                          onClick={() => setGenProjectionMode(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="chk-label exact-y-priority">
                      <input
                        type="checkbox"
                        checked={genPreferIntegerY}
                        onChange={event => setGenPreferIntegerY(event.target.checked)}
                      />
                      <span>Search integral y values first</span>
                    </label>
                    <p className="hint exact-rational-hint">
                      {genProjectionMode === "all"
                        ? "Runs exact x, n, and y projections in turn. Each projection bounds two coordinates by H and solves the third with no magnitude bound, so any one coordinate may be enormous. Rational denominators are cleared exactly and poles are rejected."
                        : "Enumerates reduced fractions p/q with max(|p|, q) ≤ H for two coordinates, then solves the lowest-degree third coordinate exactly over ℚ with no magnitude bound."}
                    </p>
                  </>
                )}
              </div>
              <div className="param-section">
                <div className="range-group">
                  <div className="range-field"><label className="param-label">{t("label-n-min")}</label><input className="num-input" type="text" value={nMin} onChange={e => setNMin(e.target.value)} /></div>
                  <div className="range-field"><label className="param-label">{t("label-n-max")}</label><input className="num-input" type="text" value={nMax} onChange={e => setNMax(e.target.value)} /></div>
                  {genPointType === "integer" && (
                    <div className="range-field"><label className="param-label">{t("label-n-denom")}</label><input className="num-input" type="number" value={nDenom} min={1} onChange={e => setNDenom(e.target.value)} /></div>
                  )}
                </div>
              </div>
              <div className="param-section">
                <div className="range-group two-col">
                  <div className="range-field"><label className="param-label">{t("label-gen-x-min")}</label><input className="num-input" type="number" value={genXMin} onChange={e => setGenXMin(e.target.value)} /></div>
                  <div className="range-field"><label className="param-label">{t("label-gen-x-max")}</label><input className="num-input" type="number" value={genXMax} onChange={e => setGenXMax(e.target.value)} /></div>
                </div>
              </div>
              {genVarMode === "3var" && (
                <div className="param-section">
                  <div className="range-group two-col">
                    <div className="range-field"><label className="param-label">{t("label-gen-y-min")}</label><input className="num-input" type="number" value={genYMin} onChange={e => setGenYMin(e.target.value)} /></div>
                    <div className="range-field"><label className="param-label">{t("label-gen-y-max")}</label><input className="num-input" type="number" value={genYMax} onChange={e => setGenYMax(e.target.value)} /></div>
                  </div>
                </div>
              )}
            </>
          )}

          {(solverMode === "ec" || genPointType !== "integer") && (
            <div className="param-section">
              <label className="param-label" htmlFor="deep-engine">
                Deep elliptic engine
              </label>
              <select
                id="deep-engine"
                className="mode-select"
                value={deepEngine}
                onChange={event => setDeepEngine(
                  event.target.value as "off" | "native" | "auto" | "sage"
                )}
              >
                <option value="auto">Auto — Sage + native fallback</option>
                <option value="native">Native Mordell–Weil expansion</option>
                <option value="sage">Prefer SageMath descent</option>
                <option value="off">Off — bounded search only</option>
              </select>
              {deepEngine !== "off" && (
                <div style={{marginTop:8}}>
                  <label className="param-label" htmlFor="descent-depth">
                    Generator multiple depth
                  </label>
                  <input
                    id="descent-depth"
                    className="num-input"
                    type="number"
                    min={2}
                    max={12}
                    value={descentDepth}
                    onChange={event => setDescentDepth(event.target.value)}
                  />
                  <div className="checkbox-row" style={{marginTop:10}}>
                    <label className="chk-label">
                      <input
                        type="checkbox"
                        checked={proofCertificate}
                        onChange={event => {
                          setProofCertificate(event.target.checked);
                          if (!event.target.checked) setThreeDescent(false);
                        }}
                      />
                      <span>Rank bounds + replayable certificate</span>
                    </label>
                    <label className="chk-label">
                      <input
                        type="checkbox"
                        checked={threeDescent}
                        disabled={!proofCertificate}
                        onChange={event => setThreeDescent(event.target.checked)}
                      />
                      <span>Attempt 3-descent (requires Magma)</span>
                    </label>
                  </div>
                </div>
              )}
              <p className="hint">
                Automatically classifies affine cubic-square, polynomial cubic,
                and rational-root quartic families. Certificates replay exact
                curve arithmetic locally; SageMath 2-descent and optional
                Magma-backed 3-descent are clearly attributed external evidence.
              </p>
            </div>
          )}

          {/* Exclude checkboxes */}
          <div className="param-section">
            <label className="param-label">{t("label-exclude")}</label>
            <div className="checkbox-row">
              <label className="chk-label"><input type="checkbox" checked={skipZeroN} onChange={e => setSkipZeroN(e.target.checked)} /><span>{t("chk-skip-n")}</span></label>
              <label className="chk-label"><input type="checkbox" checked={skipZeroX} onChange={e => setSkipZeroX(e.target.checked)} /><span>{t("chk-skip-x")}</span></label>
            </div>
          </div>

          {/* Examples accordion */}
          <details className="examples-accordion">
            <summary className="examples-accordion-summary">{t("ex-accordion")}</summary>
            <div className="examples-accordion-body">
              {EXAMPLES.map((ex, i) => (
                <button key={i} type="button" className="example-quick-btn"
                  onClick={() => { loadExample(ex); }}
                  title={ex.desc}>
                  <span className="eqb-name">{ex.name}</span>
                  <span className="eqb-expr">{ex.expr || (ex as any).eq}</span>
                </button>
              ))}
            </div>
          </details>

          {/* Action buttons */}
          <div className="btn-row">
            <button className="btn btn-ghost btn-sm" type="button" onClick={loadRandomCurve} title={t("ex-load")} style={{display:"flex",alignItems:"center",gap:"5px"}}>
              <DiceIcon /> {t("ex-load")}
            </button>
            <button className="btn btn-primary" type="button" disabled={isSearching} onClick={startSearch}>
              {t("btn-run")}
            </button>
            <button className="btn btn-danger btn-sm" type="button" disabled={!isSearching} onClick={stopSearch}>
              {t("btn-stop")}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => {
              stopSearch();
              setSolutions([]); setShowTable(false); setShowEmpty(false);
              setProofState("idle"); setProofData(null);
              setStatusMsg(t("status-idle"));
              setStatusCls("status-idle"); setProgress(0); setShowPlot(false);
              setShowExactMap(false);
              setPlotSupports3D(false); setPlotView("slice2d");
              setPlot3DWireData(null);
              setNSummary([]); setCurveInfoRows([]);
            }}>{t("btn-clear")}</button>
            <button className="btn-history" type="button" onClick={() => setShowHistory(true)}>
              <ClockIcon /> {t("btn-history")}
              {history.length > 0 && <span className="history-badge">{history.length}</span>}
            </button>
          </div>
        </aside>

        {/* ─── Right panel: results ────────────────────────────────────────── */}
        <section className="panel panel-results">
          {/* Progress bar */}
          {(isSearching || progress > 0) && (
            <div className="progress-header">
              <div className="progress-bar-wrap"><div className="progress-bar-fill" style={{width:progress+"%"}} /></div>
              <div className="progress-stats">{progressMsg || t("progress-searching")}</div>
            </div>
          )}

          {/* Warning */}
          {warning && <div className="warning-banner">⚠ {warning}</div>}
          {searchScope && (
            <div className="exact-scope-banner">
              <strong>Exact search scope</strong>
              <span>{searchScope}</span>
            </div>
          )}
          {curveClassification && (
            <div className="curve-classification-banner">
              <div>
                <strong>Automatic curve classification</strong>
                <span>
                  {String(curveClassification.equation_kind || "unclassified")}
                  {curveClassification.genus !== null
                    && curveClassification.genus !== undefined
                    ? ` · genus ${curveClassification.genus}`
                    : ""}
                  {curveClassification.exact_birational_model?.family
                    ? ` · ${curveClassification.exact_birational_model.family}`
                    : ""}
                </span>
              </div>
              {curveClassification.exact_birational_model ? (
                <button
                  className="classification-badge supported"
                  type="button"
                  aria-label="View exact birational map"
                  aria-expanded={showExactMap}
                  aria-controls="exact-map-details"
                  title={showExactMap ? "Hide exact birational map" : "View exact birational map"}
                  onClick={() => setShowExactMap(value => !value)}
                >
                  EXACT MAP {showExactMap ? "−" : "+"}
                </button>
              ) : (
                <span className="classification-badge">CLASSIFIED</span>
              )}
            </div>
          )}
          {curveClassification?.exact_birational_model && showExactMap && (
            <div
              className="exact-map-panel"
              id="exact-map-details"
              role="region"
              aria-label="Exact birational map"
              aria-live="polite"
            >
              <div className="exact-map-panel-header">
                <div>
                  <strong>Exact birational map</strong>
                  <span>
                    {String(
                      curveClassification.exact_birational_model.family
                      || "verified exact model"
                    )}
                  </span>
                </div>
                <button
                  className="exact-map-close"
                  type="button"
                  aria-label="Close exact map"
                  onClick={() => setShowExactMap(false)}
                >
                  <CloseIcon />
                </button>
              </div>
              <dl className="exact-map-grid">
                {([
                  ["Forward", curveClassification.exact_birational_model.forward],
                  ["Inverse", curveClassification.exact_birational_model.inverse],
                  ["Weierstrass model", curveClassification.exact_birational_model.weierstrass_equation],
                  ["Torsion section", curveClassification.exact_birational_model.torsion_section],
                  ["Discriminant", curveClassification.exact_birational_model.discriminant],
                  ["Validity condition", curveClassification.exact_birational_model.condition],
                  ["Strategy", curveClassification.exact_birational_model.strategy],
                ] as Array<[string, unknown]>)
                  .filter(([, value]) => value !== null && value !== undefined && value !== "")
                  .map(([label, value]) => (
                    <div className="exact-map-row" key={label}>
                      <dt>{label}</dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
              </dl>
              {!curveClassification.exact_birational_model.forward && (
                <p className="exact-map-note">
                  The classifier verified this map family. Fiber-specific
                  formulas are included in the downloadable replay certificate.
                </p>
              )}
              {curveClassification.exact_birational_model.scope && (
                <p className="exact-map-note">
                  {String(curveClassification.exact_birational_model.scope)}
                </p>
              )}
              {curveClassification.exact_birational_model.source && (
                <a
                  className="exact-map-source"
                  href={String(curveClassification.exact_birational_model.source)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Source and seed catalog ↗
                </a>
              )}
            </div>
          )}
          {solverCertificates.length > 0 && (
            <div className="solver-certificate-panel">
              <div className="solver-certificate-copy">
                <strong>
                  {solverCertificates.length} replayable elliptic-fiber
                  certificate{solverCertificates.length === 1 ? "" : "s"}
                </strong>
                <span>
                  SHA-256 integrity, discriminants, nonsingularity, maps, and
                  reported curve points replay exactly.
                  {rankReports.length > 0
                    ? ` External rank evidence: ${rankReports.map(report => {
                        const rank = report.rank || {};
                        return rank.lower !== null && rank.upper !== null
                          ? `[${rank.lower}, ${rank.upper}] ${rank.status}`
                          : String(rank.status || "unavailable");
                      }).join("; ")}.`
                    : " No external rank bound was available in this runtime."}
                </span>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={exportSolverCertificates}
              >
                <DownloadIcon /> Certificate JSON
              </button>
            </div>
          )}

          {/* Status */}
          <div className={"status-area "+statusCls}>{statusMsg}</div>

          {/* N summary */}
          {nSummary.length > 0 && (
            <div style={{marginBottom:14}}>
              <div className="n-summary-title">
                {solverMode === "gen" && genPointType !== "integer"
                  ? "n values represented in exact rational solutions"
                  : t("n-summary-title")}
              </div>
              {!(solverMode === "gen" && genPointType !== "integer") && (
                <div className="n-summary-header"><span className="n-summary-count">{nSummary.length}</span> / {nTested.toLocaleString()}</div>
              )}
              <div className="n-chips-row">{nSummary.map((n,i) => <span key={i} className="n-chip">{String(n)}</span>)}</div>
            </div>
          )}

          {/* Arithmetic Observations */}
          {arithmeticObs.length > 0 && (
            <div className="arith-obs-panel">
              <div className="arith-obs-header"><span>◇</span> {t("math-title")}</div>
              <ul className="arith-obs-list">
                {arithmeticObs.map((ob, i) => (
                  <li key={i} className="arith-obs-item">
                    <span className="arith-obs-icon">{ob.icon}</span>
                    <span className="arith-obs-text">{ob.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Results table */}
          {showTable && (
            <div>
              <div className="table-header-row">
                <div className="table-title">
                  {pointFilter==="rational"?"ℚ":pointFilter==="integer"?"ℤ":"ℚ+ℤ"}{" "}
                  {solverMode === "gen" && genPointType !== "integer" ? "Exact Solutions Found" : t("table-title")}
                </div>
                <div className="table-actions">
                  <span className="badge">{filteredSols.length} {filteredSols.length!==1?t("sol-plural"):t("sol-singular")}</span>
                  <div className="export-group">
                    <button className="btn btn-ghost btn-sm" type="button" onClick={exportCSV}><DownloadIcon /> {t("btn-export-csv")}</button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={exportLatex}><DownloadIcon /> {t("btn-export-latex")}</button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={exportPDF}><DownloadIcon /> {t("btn-export-pdf")}</button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={exportBibTeX}><DownloadIcon /> {t("btn-export-bibtex")}</button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={shareURL} style={{display:"flex",alignItems:"center",gap:"4px"}}><LinkIcon /> URL</button>
                    <button className="btn btn-ghost btn-sm" type="button" style={{display:"flex",alignItems:"center",gap:"4px"}} onClick={() => { saveToHistory(solutions.length); showToast(t("history-restore-note")); }}><PinIcon /> {t("btn-history")}</button>
                  </div>
                  <div className="pt-filter-group">
                    {(["all","integer","rational"] as const).map(f => (
                      <button key={f} className={"pt-filter-btn"+(pointFilter===f?" active":"")} type="button" onClick={() => setPointFilter(f)}>
                        {f==="all"?"All":f==="integer"?"ℤ":"ℚ"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>{t("th-index")}</th><th>{t("th-n")}</th><th>{t("th-x")}</th><th>{t("th-y")}</th><th title="Projective coordinate height in bits, including numerators and denominators">h(P) bits</th><th>{t(solverMode === "gen" ? "th-verify-gen" : "th-verify-ec")}</th></tr>
                  </thead>
                  <tbody>
                    {renderSolutionsTable()}
                    {curveInfoRows.map((ci, i) => renderCurveInfoRow(ci, i))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Curve visualization */}
          {showPlot && plotData && viewport && (
            <div className="plot-section">
              <div className="plot-header">
                <div className="plot-title">{t("export-curve-viz")}</div>
                <span className="plot-n-label">n = {plotN}</span>
                {plotSupports3D && (
                  <div className="plot-view-toggle" role="group" aria-label="Plot view mode">
                    <button className={"pt-filter-btn"+(plotView==="slice2d"?" active":"")} type="button" onClick={() => setPlotView("slice2d")}>2D slice</button>
                    <button className={"pt-filter-btn"+(plotView==="cloud3d"?" active":"")} type="button" onClick={() => setPlotView("cloud3d")}>3D cloud</button>
                    <button className={"pt-filter-btn"+(plotView==="surface3d"?" active":"")} type="button" onClick={() => setPlotView("surface3d")}>3D surface</button>
                  </div>
                )}
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowPlot(false)}>{t("btn-toggle-plot-hide")}</button>
              </div>
              <div className="plot-toolbar">
                <button className="btn btn-ghost btn-xs" type="button" onClick={() => {
                  if (plotView !== "slice2d") {
                    const cam = plot3DCameraRef.current;
                    const nv = { ...cam, zoom: Math.min(2.8, cam.zoom * 1.12) };
                    setPlot3DCamera(nv); plot3DCameraRef.current = nv; renderPlot();
                  } else {
                    const vp = viewportRef.current; if (!vp) return;
                    const cx=(vp.xMin+vp.xMax)/2,cy=(vp.yMin+vp.yMax)/2;
                    const nv={xMin:cx-(cx-vp.xMin)*.8,xMax:cx+(vp.xMax-cx)*.8,yMin:cy-(cy-vp.yMin)*.8,yMax:cy+(vp.yMax-cy)*.8};
                    setViewport(nv); viewportRef.current=nv; renderPlot();
                  }
                }}>＋</button>
                <button className="btn btn-ghost btn-xs" type="button" onClick={() => {
                  if (plotView !== "slice2d") {
                    const cam = plot3DCameraRef.current;
                    const nv = { ...cam, zoom: Math.max(0.45, cam.zoom * 0.9) };
                    setPlot3DCamera(nv); plot3DCameraRef.current = nv; renderPlot();
                  } else {
                    const vp = viewportRef.current; if (!vp) return;
                    const cx=(vp.xMin+vp.xMax)/2,cy=(vp.yMin+vp.yMax)/2;
                    const nv={xMin:cx-(cx-vp.xMin)*1.25,xMax:cx+(vp.xMax-cx)*1.25,yMin:cy-(cy-vp.yMin)*1.25,yMax:cy+(vp.yMax-cy)*1.25};
                    setViewport(nv); viewportRef.current=nv; renderPlot();
                  }
                }}>－</button>
                <button className="btn btn-ghost btn-xs" type="button" onClick={() => {
                  if (plotView !== "slice2d") {
                    const cam = { yaw: -0.7, pitch: 0.45, zoom: 1.0 };
                    setPlot3DCamera(cam); plot3DCameraRef.current = cam; renderPlot();
                  } else {
                    const vp={xMin:plotData.x_min,xMax:plotData.x_max,yMin:plotData.y_min,yMax:plotData.y_max};
                    setViewport(vp); viewportRef.current=vp; renderPlot();
                  }
                }}><ResetIcon /> {t("btn-zoom-reset")}</button>
                {plotView === "slice2d" && (
                  <button className="btn btn-ghost btn-xs" type="button" onClick={() => {
                  const sols = plotSliceSolsRef.current; if (!sols.length) return;
                  const xs = sols.map(s => parseFloat(String(s.x))).filter(Number.isFinite);
                  const ys = sols.map(s => parseFloat(String(s.y))).filter(Number.isFinite);
                  if (!xs.length || !ys.length) return;
                  const xMn=Math.min(...xs),xMx=Math.max(...xs),yMn=Math.min(...ys),yMx=Math.max(...ys);
                  const padX=(xMx-xMn)*0.25||3, padY=(yMx-yMn)*0.25||3;
                  const nv={xMin:xMn-padX,xMax:xMx+padX,yMin:yMn-padY,yMax:yMx+padY};
                  setViewport(nv); viewportRef.current=nv; renderPlot();
                  }}>◎</button>
                )}
                <button className="btn btn-ghost btn-xs" type="button" onClick={() => { setShowLabels(v => !v); showLabelsRef.current = !showLabelsRef.current; renderPlot(); }}>
                  {showLabels ? t("btn-hide-labels") : t("btn-show-labels")}
                </button>
                {plotView === "slice2d" && (
                  <button className={"btn btn-ghost btn-xs"+(showSymmetry?" btn-active":"")} type="button" onClick={() => { const v=!showSymmetry; setShowSymmetry(v); showSymmetryRef.current=v; renderPlot(); }}>↕</button>
                )}
                {plotView === "slice2d" && groupLawPoint && (
                  <button className={"btn btn-ghost btn-xs"+(showConstruction?" btn-active":"")} type="button" onClick={() => { const v=!showConstruction; setShowConstruction(v); showConstructionRef.current=v; renderPlot(); }}>⌇</button>
                )}
                <div className="pt-filter-group" style={{marginLeft:"auto"}}>
                  {(["all","integer","rational"] as const).map(f => (
                    <button key={f} className={"pt-filter-btn"+(pointFilter===f?" active":"")} type="button" onClick={() => { setPointFilter(f); filterRef.current=f; renderPlot(); }}>
                      {f==="all"?"All":f==="integer"?"ℤ":"ℚ"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="plot-container">
                <canvas ref={canvasRef} id="curve-canvas" />
              </div>
              <p className="plot-caption">{plotCaption}</p>
              <div className="plot-legend">
                <span className="plot-legend-item">
                  <span className="plot-legend-swatch-sq" />
                  {solverMode === "gen" && genPointType !== "integer" ? "Exact solutions" : t("plot-legend-pts")}
                </span>
                <span className="plot-legend-item"><span className="plot-legend-swatch-circ" />ℚ</span>
                {plotSupports3D && plotView !== "slice2d" && (
                  <span className="plot-legend-item">
                    Drag: rotate · Wheel: zoom · Axes: (n, x, y){plotView==="surface3d" ? " · sampled wireframe" : ""}
                  </span>
                )}
              </div>

              {/* Mathematician's Lens */}
              {solutions.length > 0 && solverMode === "ec" && (
                <InsightPanel expr={expr} solutions={solutions} nMin={nMin} nMax={nMax} />
              )}

              {/* Group law calculator */}
              {solutions.length > 0 && solverMode === "ec" && (
                <div className="group-law-section">
                  <div className="group-law-title">Group Law Calculator</div>
                  <p className="hint">Compute P ⊕ Q on this elliptic curve using exact rational arithmetic.</p>
                  <div className="group-law-inputs">
                    <div>
                      <label className="param-label">Point P</label>
                      <select className="mode-select" value={glP} onChange={e => setGlP(e.target.value)}>
                        <option value="O">O (point at infinity)</option>
                        {solutions.slice(0,200).map((s,i) => <option key={i} value={String(i)}>({s.x}, {s.y}) n={s.n}</option>)}
                      </select>
                    </div>
                    <span className="gl-op-badge">⊕</span>
                    <div>
                      <label className="param-label">Point Q</label>
                      <select className="mode-select" value={glQ} onChange={e => setGlQ(e.target.value)}>
                        <option value="O">O (point at infinity)</option>
                        {solutions.slice(0,200).map((s,i) => <option key={i} value={String(i)}>({s.x}, {s.y}) n={s.n}</option>)}
                      </select>
                    </div>
                    <button className="btn btn-primary btn-sm" type="button" onClick={computeGroupLaw}>Compute</button>
                  </div>
                  {groupLawResult && <div className="gl-result">{groupLawResult}</div>}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="empty-state">
              <span className="empty-icon">∅</span>
              <p>
                {solverMode === "gen" && genPointType !== "integer"
                  ? "No rational solutions were found in the displayed exact scope."
                  : t("empty-icon-msg")}
              </p>
              <p className="dim" style={{marginTop:6}}>
                {solverMode === "gen" && genPointType !== "integer"
                  ? "Raise the rational height or widen a scanned coordinate interval to search a larger finite scope."
                  : t("empty-hint")}
              </p>
              <div className="math-fact-card">
                <div className="math-fact-label"><LightbulbIcon /> Did you know?</div>
                <div className="math-fact-text">{MATH_FACTS[factIdx]}</div>
              </div>

              {/* ── Infeasibility proof ── */}
              {proofState === "idle" && (
                <button className="proof-trigger-btn" type="button" onClick={attemptProof}>
                  Attempt rigorous proof of infeasibility →
                </button>
              )}
              {proofState === "loading" && (
                <div className="proof-loading">
                  <span className="proof-spinner">◐</span>
                  Searching for a congruence obstruction…
                </div>
              )}
              {(proofState === "proved" || proofState === "failed") && proofData && (
                <div className={`proof-panel${proofData.proved ? " proof-panel--proved" : ""}`}>
                  <div className="proof-panel-header">
                    {proofData.proved
                      ? `✓  Proved — Congruence Obstruction (mod ${proofData.modulus})`
                      : "─  No Simple Proof Found"}
                  </div>
                  {proofData.proved && proofData.steps && (
                    <ol className="proof-steps">
                      {proofData.steps.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  )}
                  {proofData.proved && proofData.lhs_residues && proofData.rhs_residues && (
                    <div className="proof-residues">
                      <span className="proof-residue-label">y² mod {proofData.modulus}</span>
                      <span className="proof-residue-set">{"{"}{proofData.lhs_residues.join(", ")}{"}"}</span>
                      <span className="proof-residue-op">∩</span>
                      <span className="proof-residue-set">{"{"}{proofData.rhs_residues.join(", ")}{"}"}</span>
                      <span className="proof-residue-op">=</span>
                      <span className="proof-residue-empty">∅</span>
                    </div>
                  )}
                  {!proofData.proved && (
                    <div style={{padding: "10px 14px"}}>
                      <p className="proof-message">{proofData.message ?? proofData.error}</p>
                      {proofData.suggestion && (
                        <p className="proof-suggestion">
                          <Link
                            href={`/explore?eq=${encodeURIComponent(solverMode === "ec" ? `y**2 = ${expr}` : genEq)}`}
                            className="proof-suggestion-link"
                          >
                            {proofData.suggestion}
                          </Link>
                        </p>
                      )}
                    </div>
                  )}
                  <button className="proof-retry-btn" type="button"
                    onClick={() => { setProofState("idle"); setProofData(null); }}>
                    ← Try again
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* ── Suggestion Box ── */}
      <div className="suggest-band above-canvas">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="suggest-toggle" onClick={() => setShowSuggest(s => !s)}>
            {showSuggest ? "▲" : "▼"}&nbsp; Suggest a feature
          </button>
          <button
            className="suggest-toggle"
            onClick={() => {
              const next = !showDemographics;
              setShowDemographics(next);
              if (next) loadDemographics();
            }}
          >
            {showDemographics ? "▲" : "▼"}&nbsp; Demographics
          </button>
        </div>
        {showSuggest && (
          <div className="suggest-form">
            <p className="suggest-desc">
              Have an idea, a missing curve family, or a bug to report? Describe it below — it opens a pre-filled GitHub issue.
            </p>
            <textarea
              className="suggest-area"
              placeholder="e.g. Add support for genus-2 curves, show a Cremona label, ..."
              value={suggText}
              onChange={e => setSuggText(e.target.value)}
              rows={4}
            />
            <div className="suggest-actions">
              <span className="suggest-hint">Requires a free GitHub account to submit.</span>
              <button
                className="btn-ghost"
                disabled={!suggText.trim()}
                onClick={() => {
                  const body = `**Suggestion from a Diophantix user**\n\n${suggText.trim()}`;
                  const url = `https://github.com/JAgbanwa/Diophantix/issues/new?labels=suggestion&title=User+Suggestion&body=${encodeURIComponent(body)}`;
                  window.open(url, "_blank", "noopener");
                }}
              >
                Open on GitHub →
              </button>
            </div>
          </div>
        )}
        {showDemographics && (
          <div className="suggest-form" style={{ marginTop: 8 }}>
            <p className="suggest-desc">Country distribution from tracked visits.</p>
            {demographicsLoading && <p className="dim">Loading…</p>}
            {demographicsErr && <p className="dim">{demographicsErr}</p>}
            {!demographicsLoading && !demographicsErr && (
              <>
                <p className="dim" style={{ marginBottom: 10 }}>Total tracked visits: {demographicsTotal}</p>
                <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)" }}>
                  {demographicsRows.length === 0 && <p className="dim" style={{ padding: 10 }}>No data yet.</p>}
                  {demographicsRows.map((r, i) => (
                    <div key={r.country + i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
                      <span>{r.country}</span>
                      <strong>{r.count}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="site-footer above-canvas">
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-icon" style={{fontSize:"1.2rem"}}>∮</span><span className="footer-name">{t("brand-title")}</span></div>
          <div className="footer-links">
            <Link href="/">{t("nav-home")}</Link>
            <a href="https://github.com/JAgbanwa/elliptic-curve-solver-app-or-website" target="_blank" rel="noopener">{t("nav-github")}</a>
            <a href="https://en.wikipedia.org/wiki/Elliptic_curve" target="_blank" rel="noopener">{t("footer-wiki")}</a>
            <button className="footer-suggest-btn" onClick={() => { setShowSuggest(true); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}>Suggest a feature</button>
            <button className="footer-suggest-btn" onClick={() => { setShowDemographics(true); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); loadDemographics(); }}>Demographics</button>
          </div>
          <p className="footer-copy">Flask · SymPy · NumPy · Next.js</p>
        </div>
      </footer>

      {/* ── Toast ── */}
      {toast && <div className="copy-toast">{toast}</div>}

      {showFontPicker && <div style={{position:"fixed",inset:0,zIndex:190}} onClick={() => setShowFontPicker(false)} />}

    </>
  );
}
