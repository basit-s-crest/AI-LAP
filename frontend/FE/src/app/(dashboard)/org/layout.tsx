import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Organization Portal",
  robots: { index: false, follow: false },
};

export default function OrgDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
