"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  coachRegisterSchema,
  memberRegisterSchema,
  organizationRegisterSchema,
  superadminRegisterSchema,
} from "@/validations/auth.validation";
import { RHFInput } from "@/components/form/RHFInput";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useRegisterMutation } from "@/hooks/api/use-auth-mutations";
import { getAuthRoleOption, parseAuthRole } from "@/lib/auth-roles";
import type { RegisterPayload } from "@/types/auth";
import type { Role } from "@/types/role";
import { toast } from "sonner";

type RoleRegisterConfig = {
  role: Role;
  schema:
    | typeof memberRegisterSchema
    | typeof organizationRegisterSchema
    | typeof coachRegisterSchema
    | typeof superadminRegisterSchema;
  fields: Array<{
    name: keyof RegisterPayload;
    label: string;
    placeholder: string;
    type?: string;
  }>;
};

type FormValues = z.infer<RoleRegisterConfig["schema"]>;

const REGISTER_CONFIG: Record<Role, RoleRegisterConfig> = {
  user: {
    role: "user",
    schema: memberRegisterSchema,
    fields: [],
  },
  organization: {
    role: "organization",
    schema: organizationRegisterSchema,
    fields: [
      {
        name: "organizationName",
        label: "Organization Name",
        placeholder: "State University Wellness Center",
      },
      {
        name: "organizationType",
        label: "Organization Type",
        placeholder: "University, nonprofit, clinic",
      },
    ],
  },
  coach: {
    role: "coach",
    schema: coachRegisterSchema,
    fields: [
      {
        name: "licenseNumber",
        label: "License Number",
        placeholder: "LCSW-123456",
      },
      {
        name: "specialties",
        label: "Specialties",
        placeholder: "Trauma care, anxiety, student wellness",
      },
    ],
  },
  superadmin: {
    role: "superadmin",
    schema: superadminRegisterSchema,
    fields: [
      {
        name: "adminCode",
        label: "Admin Invite Code",
        placeholder: "AZADI-ADMIN",
      },
    ],
  },
};

function buildDefaultValues(role: Role): FormValues {
  return {
    role,
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    organizationName: "",
    organizationType: "",
    licenseNumber: "",
    specialties: "",
    adminCode: "",
  } as FormValues;
}

function RoleRegisterScreen({ role }: { role: Role }) {
  const registerMutation = useRegisterMutation();
  const router = useRouter();
  const config = REGISTER_CONFIG[role];
  const roleOption = getAuthRoleOption(role);

  const methods = useForm<FormValues>({
    resolver: zodResolver(config.schema),
    defaultValues: buildDefaultValues(role),
  });

  const onSubmit = methods.handleSubmit(async (data) => {
    try {
      await registerMutation.mutateAsync(data);
      toast.success("Account created");
      router.push("/verify");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Registration failed");
    }
  });

  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="relative hidden flex-1 flex-col justify-center overflow-hidden bg-sidebar p-[60px] lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 50%, rgba(78,140,88,.2) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(179,90,56,.12) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-[1]">
          <h1 className="font-serif text-[60px] font-bold leading-none tracking-wide text-[#FDFAF5]">
            Azadi
            <br />
            Health
          </h1>
          <p className="mt-2.5 text-xs uppercase tracking-[3px] text-[#FDFAF5]/40">
            Mental Wellness Platform
          </p>
        </div>
        <div className="relative z-[1] mt-[52px]">
          <h2 className="max-w-lg font-serif text-[28px] font-normal italic leading-snug text-[#FDFAF5]/80">
            &quot;Healing is not linear, but you don&apos;t have to walk the path alone.&quot;
          </h2>
        </div>
        <ul className="relative z-[1] mt-11 space-y-3 text-[13.5px] text-[#FDFAF5]/60">
          {[
            "Culturally responsive care",
            "Private and HIPAA-compliant",
            "Community-centered healing",
            "Available 7 days a week",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2.5">
              <span className="text-sage-light">OK</span>
              {f}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex w-full max-w-[640px] items-center justify-center bg-card px-10 py-14 lg:w-[640px]">
        <FormProvider {...methods}>
          <form onSubmit={onSubmit} className="w-full animate-fadeIn">
            <p className="mb-2 text-xs font-bold uppercase tracking-[2px] text-sage">
              {roleOption.label}
            </p>
            <h3 className="mb-1 font-serif text-[28px] font-semibold text-ink">
              {roleOption.registerTitle}
            </h3>
            <p className="mb-7 text-[13.5px] text-mid">{roleOption.registerSubtitle}</p>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>First Name</Label>
                <RHFInput name="firstName" placeholder="Amara" />
              </div>
              <div>
                <Label>Last Name</Label>
                <RHFInput name="lastName" placeholder="Johnson" />
              </div>
            </div>
            <div className="mb-4">
              <Label>Email</Label>
              <RHFInput name="email" type="email" placeholder="you@example.com" />
            </div>
            {config.fields.map((field) => (
              <div key={field.name} className="mb-4">
                <Label>{field.label}</Label>
                <RHFInput name={field.name} type={field.type} placeholder={field.placeholder} />
              </div>
            ))}
            <div className="mb-4">
              <Label>Password</Label>
              <Controller
                name="password"
                control={methods.control}
                render={({ field, fieldState }) => (
                  <PasswordInput
                    {...field}
                    placeholder="Create a strong password"
                    error={fieldState.error?.message}
                  />
                )}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              fullWidth
              className="mt-2"
              disabled={registerMutation.isPending}
            >
              Create Account -&gt;
            </Button>
            <div className="my-4 flex items-center gap-3 text-xs text-dim">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
            <p className="text-center text-sm text-mid">
              Have an account?{" "}
              <Link href={`/login?role=${role}`} className="font-bold text-sage hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

export function MemberRegisterScreen() {
  return <RoleRegisterScreen role="user" />;
}

export function OrganizationRegisterScreen() {
  return <RoleRegisterScreen role="organization" />;
}

export function CoachRegisterScreen() {
  return <RoleRegisterScreen role="coach" />;
}

export function SuperadminRegisterScreen() {
  return <RoleRegisterScreen role="superadmin" />;
}

export function RegisterScreen() {
  const search = useSearchParams();
  const role = parseAuthRole(search.get("role"));

  switch (role) {
    case "organization":
      return <OrganizationRegisterScreen />;
    case "coach":
      return <CoachRegisterScreen />;
    case "superadmin":
      return <SuperadminRegisterScreen />;
    default:
      return <MemberRegisterScreen />;
  }
}
