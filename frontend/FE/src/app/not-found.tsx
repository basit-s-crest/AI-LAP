import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page isn’t available. Return to Azadi Health to continue.",
};

export default function NotFound() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse at 20% 20%, rgba(78,140,88,.14) 0%, transparent 55%), radial-gradient(ellipse at 85% 75%, rgba(179,90,56,.1) 0%, transparent 50%), radial-gradient(ellipse at 50% 100%, rgba(58,110,153,.08) 0%, transparent 45%)",
        }}
      />
      <div className="relative z-[1] mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16 text-center md:max-w-xl md:px-8">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow-soft ring-1 ring-line">
          <Compass className="h-8 w-8 text-sage" strokeWidth={1.5} aria-hidden />
        </div>
        <p className="font-mono text-[13px] font-medium uppercase tracking-[0.2em] text-dim">
          Error 404
        </p>
        <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight text-ink md:text-5xl">
          This path isn&apos;t on the map
        </h1>
        <p className="mt-4 text-base leading-relaxed text-mid md:text-[17px]">
          The page may have moved, or the link could be mistyped. Let&apos;s get you back to
          something familiar and supportive.
        </p>
        <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-[9px] bg-sage px-6 py-3 text-[15px] font-semibold text-white shadow-[0_3px_12px_rgba(78,140,88,0.25)] transition-all duration-150 hover:bg-[#3E7248] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to home
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-[9px] border-[1.5px] border-sage bg-transparent px-6 py-3 text-[15px] font-semibold text-sage transition-all duration-150 hover:bg-sage-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-12 text-sm text-dim">
          Need help?{" "}
          <Link href="/login" className="font-medium text-sage underline-offset-4 hover:underline">
            Contact your coach or admin
          </Link>{" "}
          through the platform.
        </p>
      </div>
    </div>
  );
}
