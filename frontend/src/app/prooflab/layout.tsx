import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ProofLab — Diophantix",
  description:
    "An evidence-first AI mathematics laboratory: GPT-5.6 interprets Diophantine claims, while deterministic exact arithmetic proves, disproves, or leaves them honestly unknown.",
};

export default function ProofLabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
