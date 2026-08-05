import Link from "next/link";
import "./landing.css";

const paths = [
  {
    number: "01",
    title: "Verify",
    body: "Turn an informal claim into a proof obligation and separate exact proof from computation or conjecture.",
    href: "/prooflab",
    label: "Open ProofLab",
  },
  {
    number: "02",
    title: "Search",
    body: "Find exact integer and rational points on polynomial Diophantine equations and elliptic-curve families.",
    href: "/app",
    label: "Open solver",
  },
  {
    number: "03",
    title: "Investigate",
    body: "Classify equations, inspect congruence obstructions, and explore arithmetic structure before brute force.",
    href: "/explore",
    label: "Open explorer",
  },
];

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <header className="landing-header">
        <Link href="/" className="landing-brand">
          <span aria-hidden="true">∮</span>
          <span>Diophantix</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/prooflab">ProofLab</Link>
          <Link href="/app">Solver</Link>
          <a href="https://github.com/JAgbanwa/Diophantix" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </header>

      <section className="landing-hero">
        <p className="landing-kicker">Number theory · exact computation · trustworthy AI</p>
        <h1>
          Search equations.
          <br />
          Test claims.
          <br />
          <em>Know what is proved.</em>
        </h1>
        <p className="landing-intro">
          Diophantix is an open research environment for polynomial Diophantine equations.
          Search for points, inspect arithmetic structure, and use ProofLab to verify whether an AI-generated argument is a theorem, a counterexample, a bounded computation, or still unknown.
        </p>
        <div className="landing-actions">
          <Link href="/prooflab" className="landing-primary">Try ProofLab <span>→</span></Link>
          <Link href="/app" className="landing-secondary">Open the solver</Link>
        </div>
      </section>

      <section className="landing-prooflab-band">
        <div>
          <span className="landing-band-index">New / Build Week</span>
          <h2>GPT-5.6 interprets. Exact mathematics decides.</h2>
        </div>
        <p>
          ProofLab is a deterministic proof firewall for mathematical AI: it compiles informal claims into structured obligations, runs exact polynomial and modular verifiers, produces replayable certificates, and adversarially tries to break the argument.
        </p>
        <Link href="/prooflab">Inspect the evidence ledger <span>↗</span></Link>
      </section>

      <section className="landing-paths" aria-label="Diophantix workflows">
        {paths.map((path) => (
          <article key={path.number}>
            <span>{path.number}</span>
            <h2>{path.title}</h2>
            <p>{path.body}</p>
            <Link href={path.href}>{path.label} <span>→</span></Link>
          </article>
        ))}
      </section>

      <section className="landing-trust">
        <div>
          <span className="landing-kicker">The evidence boundary</span>
          <h2>A language model never awards itself a proof.</h2>
        </div>
        <div className="landing-trust-grid">
          <article>
            <strong>Interpretive</strong>
            <p>GPT-5.6 extracts formulas, assumptions, variables, and the intended claim type.</p>
          </article>
          <article>
            <strong>Deterministic</strong>
            <p>Exact integer polynomial arithmetic and complete residue enumeration decide supported obligations.</p>
          </article>
          <article>
            <strong>Replayable</strong>
            <p>Every proved or disproved result carries an integrity-checksummed certificate whose exact evidence can be replayed independently.</p>
          </article>
        </div>
      </section>

      <footer className="landing-footer">
        <div>
          <strong>Diophantix</strong>
          <span>Free and open-source mathematical infrastructure.</span>
        </div>
        <nav>
          <Link href="/prooflab">ProofLab</Link>
          <Link href="/app">Solver</Link>
          <Link href="/explore">Explorer</Link>
          <a href="https://github.com/JAgbanwa/Diophantix" target="_blank" rel="noreferrer">Source</a>
        </nav>
      </footer>
    </main>
  );
}
