import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/RoleGate";

export const metadata: Metadata = {
  title: "Azadi Health — Select your portal",
  description: "Explore the Azadi Health platform as a member, coach, organization, or administrator.",
};

export default function HomePage() {
  return <RoleGate />;
}
