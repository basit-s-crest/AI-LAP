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
import { getAuthRoleOption } from "@/lib/auth-roles";
import { useAuthRoleParam } from "@/hooks/useAuthRoleParam";
import type { RegisterPayload } from "@/types/auth";
import type { Role } from "@/types/role";
import { toast } from "sonner";
import { useEffect } from "react";
import { useHydratedPlatformBranding, getLogoUrl } from "@/hooks/useHydratedPlatformBranding";
import { usePublicPlatformSettings } from "@/hooks/usePublicPlatformSettings";
import { useMaintenanceRedirect } from "@/hooks/useMaintenanceRedirect";

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
        placeholder: "SAFECIRCLE-ADMIN",
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
  const router = useRouter();
  const { data: platformSettings } = usePublicPlatformSettings();
  const { brandTitle, brandTagline, logoUrl } = useHydratedPlatformBranding();
  const registerMutation = useRegisterMutation(role);
  const config = REGISTER_CONFIG[role];
  const roleOption = getAuthRoleOption(role);

  const methods = useForm<FormValues>({
    resolver: zodResolver(config.schema),
    defaultValues: buildDefaultValues(role),
  });

  useEffect(() => {
    if (role === "user" && platformSettings?.allowSelfRegistration === false) {
      router.replace("/login?role=user");
    }
  }, [platformSettings?.allowSelfRegistration, role, router]);

  const onSubmit = methods.handleSubmit(async (data) => {
    try {
      await registerMutation.mutateAsync(data);
      if (role === "organization") {
        toast.success("Organization account created. Please sign in.");
      } else {
        toast.success("Check your email for the verification code");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Registration failed");
    }
  });

  return (
    <div className="auth-screen">
      {/* ── Left panel ── */}
      <div className="auth-panel">
        <div className="auth-panel-bg" />
        <div className="flex items-center gap-3" style={{ position: "relative", zIndex: 1 }}>
          <img src={getLogoUrl(logoUrl)} alt="SafeCircle Logo" style={{ height: "96px", width: "96px", objectFit: "contain", marginLeft: "-16px", marginRight: "-12px" }} />
          <div className="auth-logo" style={{ marginBottom: 0 }}>{brandTitle}</div>
        </div>
        <div className="auth-logo-sub">{brandTagline}</div>
        <div className="auth-quote">
          &quot;A safe place to share, grow, and belong.&quot;
          <cite>— SafeCircle Mission</cite>
        </div>
        <div className="auth-checks">
          {[
            "Culturally responsive care",
            "Private & HIPAA-compliant",
            "Community-centered healing",
            "Available 7 days a week",
          ].map((f) => (
            <div key={f} className="auth-check">
              <span className="auth-check-icon">✓</span>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-inner anim-scale">
          <FormProvider {...methods}>
            <form onSubmit={onSubmit} className="w-full">
              <p className="mb-2 text-xs font-bold uppercase tracking-[2px] text-sage">
                {roleOption.label}
              </p>
              <h3 className="auth-form-title">
                {roleOption.registerTitle}
              </h3>
              <p className="auth-form-sub">{roleOption.registerSubtitle}</p>
              
              <div className="form-row">
                <div className="form-group">
                  <Label className="form-label">First Name</Label>
                  <RHFInput name="firstName" placeholder="Amara" className="input" />
                </div>
                <div className="form-group">
                  <Label className="form-label">Last Name</Label>
                  <RHFInput name="lastName" placeholder="Johnson" className="input" />
                </div>
              </div>

              <div className="form-group">
                <Label className="form-label">Email</Label>
                <RHFInput name="email" type="email" placeholder="you@example.com" className="input" />
              </div>

              {config.fields.map((field) => (
                <div key={field.name} className="form-group">
                  <Label className="form-label">{field.label}</Label>
                  <RHFInput name={field.name} type={field.type} placeholder={field.placeholder} className="input" />
                </div>
              ))}

              <div className="form-group">
                <Label className="form-label">Password</Label>
                <Controller
                  name="password"
                  control={methods.control}
                  render={({ field, fieldState }) => (
                    <PasswordInput
                      {...field}
                      placeholder="Create a strong password"
                      error={fieldState.error?.message}
                      className="input"
                    />
                  )}
                />
              </div>

              <Button
                type="submit"
                className="btn btn-primary w-full mt-2"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "Creating Account…" : "Create Account →"}
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

type RegisterScreenProps = {
  initialRole?: Role;
};

export function RegisterScreen({ initialRole }: RegisterScreenProps) {
  const { role } = useAuthRoleParam(initialRole);

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
