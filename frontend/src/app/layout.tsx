import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diophantix",
  description:
    "Search polynomial Diophantine equations, explore elliptic curves, and verify mathematical claims with ProofLab's GPT-5.6 interpretation and deterministic proof certificates.",
  icons: {
    icon: [
      { url: "/diophantix-integral-v2.ico", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/diophantix-integral-v2.png", type: "image/png" },
    ],
    shortcut: "/diophantix-integral-v2.ico",
    apple: "/diophantix-apple-v2.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/diophantix-integral-v2.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        {/* Prevent theme flash before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(!t)t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';if(t==='dark')document.documentElement.setAttribute('data-theme','dark');})()`,
          }}
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
