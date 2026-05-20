import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/RoleGate";

export const metadata: Metadata = {
  title: "Select your portal",
  description: "Explore the mental wellness platform as a member, coach, organization, or administrator.",
};

export default function HomePage() {
  return <RoleGate />;
}
