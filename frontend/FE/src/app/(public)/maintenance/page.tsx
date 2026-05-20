import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maintenance",
  description: "The platform is temporarily under maintenance.",
};

async function getBranding(): Promise<{ brandTitle: string; brandTagline: string }> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/auth/platform-settings`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed");
    const data = (await res.json()) as { brandTitle?: string; brandTagline?: string };
    return {
      brandTitle: data.brandTitle?.trim() || "Azadi Health",
      brandTagline: data.brandTagline?.trim() || "Mental Wellness Platform",
    };
  } catch {
    return {
      brandTitle: "Azadi Health",
      brandTagline: "Mental Wellness Platform",
    };
  }
}

export default async function MaintenancePage() {
  const { brandTitle, brandTagline } = await getBranding();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-[620px] rounded-card border border-line bg-card p-8 text-center shadow-soft">
        <div className="mb-1 text-xs font-bold uppercase tracking-[2px] text-sage">{brandTitle}</div>
        <div className="mb-2 text-[11px] text-dim">{brandTagline}</div>
        <h1 className="font-serif text-3xl font-semibold text-ink">Site Under Maintenance</h1>
        <p className="mt-3 text-sm text-mid">
          We are currently performing scheduled updates. Please try again shortly.
        </p>
      </div>
    </div>
  );
}

