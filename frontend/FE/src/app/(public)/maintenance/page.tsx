import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maintenance",
  description: "Azadi Health is temporarily under maintenance.",
};

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-[620px] rounded-card border border-line bg-card p-8 text-center shadow-soft">
        <div className="mb-2 text-xs font-bold uppercase tracking-[2px] text-sage">Azadi Health</div>
        <h1 className="font-serif text-3xl font-semibold text-ink">Site Under Maintenance</h1>
        <p className="mt-3 text-sm text-mid">
          We are currently performing scheduled updates. Please try again shortly.
        </p>
      </div>
    </div>
  );
}

