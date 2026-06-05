"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  usePlatformSettings,
  useUpdatePlatformSettings,
  useUploadLogo,
} from "@/hooks/admin/usePlatformSettings";

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function assetUrl(path: string | null): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export default function AdminSettingsPage() {
  const { data, isPending, isError, error } = usePlatformSettings();
  const updateSettings = useUpdatePlatformSettings();
  const uploadLogo = useUploadLogo();

  const [brandTitle, setBrandTitle] = useState("");
  const [brandTagline, setBrandTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [supportEmail, setSupportEmail] = useState("");
  const [sessionDurationDefault, setSessionDurationDefault] = useState(50);
  const [sessionDurationMax, setSessionDurationMax] = useState(90);
  const [sessionDurationMin, setSessionDurationMin] = useState(25);

  useEffect(() => {
    if (!data) return;
    setBrandTitle(data.brandTitle);
    setBrandTagline(data.brandTagline);
    setLogoUrl(data.logoUrl);
    setSupportEmail(data.supportEmail);
    setSessionDurationDefault(data.sessionDurationDefault);
    setSessionDurationMax(data.sessionDurationMax ?? 90);
    setSessionDurationMin(data.sessionDurationMin ?? 25);
  }, [data]);

  const saveBranding = () => {
    updateSettings.mutate(
      { brandTitle, brandTagline, logoUrl },
      {
        onSuccess: () => {
          localStorage.setItem("platform_brand_title", brandTitle || "SafeCircle");
          localStorage.setItem("platform_brand_tagline", brandTagline || "Mental Wellness Platform");
          toast.success("Branding settings updated");
        },
        onError: (err) => toast.error(err.message || "Failed to update branding"),
      }
    );
  };

  const saveConfig = () => {
    updateSettings.mutate(
      { supportEmail, sessionDurationDefault, sessionDurationMax, sessionDurationMin },
      {
        onSuccess: () => toast.success("Platform config updated"),
        onError: (err) => toast.error(err.message || "Failed to update config"),
      }
    );
  };

  const toggle = (key: "allowSelfRegistration" | "maintenanceMode", value: boolean) => {
    updateSettings.mutate(
      { [key]: value },
      {
        onSuccess: () => toast.success("Control updated"),
        onError: (err) => toast.error(err.message || "Failed to update control"),
      }
    );
  };

  const onUploadLogo = async (file: File | null) => {
    if (!file) return;
    try {
      const base64 = await toBase64(file);
      const saved = await uploadLogo.mutateAsync(base64);
      setLogoUrl(saved.url);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error((err as Error).message || "Failed to upload logo");
    }
  };

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 rounded-[11px] transition-colors",
        on ? "bg-sage" : "border-[1.5px] border-line bg-[var(--bg-surface-2)]"
      )}
    >
      <div
        className={cn(
          "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-[left]",
          on ? "left-[19px]" : "left-[3px]"
        )}
      />
    </button>
  );

  return (
    <DashboardLayout title="Settings">
      {isPending ? (
        <div className="h-28 animate-pulse rounded-card border-[1.5px] border-line bg-[var(--bg-surface-2)]" />
      ) : isError ? (
        <Card className="text-sm text-danger">{error?.message || "Failed to load settings"}</Card>
      ) : data ? (
        <div className="anim-up">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
            <div className="space-y-6">
              <div className="rounded-2xl border border-line bg-card p-7 shadow-sm">
                <h3 className="mb-5 serif text-lg font-semibold text-ink">Branding</h3>
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Brand Title</Label>
                    <Input value={brandTitle} onChange={(e) => setBrandTitle(e.target.value)} />
                  </div>
                  <div>
                    <Label>Brand Tagline</Label>
                    <Input value={brandTagline} onChange={(e) => setBrandTagline(e.target.value)} />
                  </div>
                </div>
                <div className="mb-4 rounded-[10px] border border-line bg-canvas px-3 py-2">
                  <div className="serif text-lg font-semibold text-ink">{brandTitle || "SafeCircle"}</div>
                  <div className="text-xs text-dim">{brandTagline || "Mental Wellness Platform"}</div>
                </div>
                <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Logo Upload</Label>
                    {logoUrl ? (
                      <img
                        src={assetUrl(logoUrl)}
                        alt="Logo preview"
                        className="mb-2 mt-2 h-14 rounded-md border border-line object-contain p-1"
                      />
                    ) : null}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => void onUploadLogo(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
                <Button type="button" onClick={saveBranding} disabled={updateSettings.isPending}>
                  Save Branding
                </Button>
              </div>

              <div className="rounded-2xl border border-line bg-card p-7 shadow-sm">
                <h3 className="mb-5 serif text-lg font-semibold text-ink">Platform Config</h3>
                <div className="mb-4">
                  <Label>Support Email</Label>
                  <Input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <Label>Maximum Session Duration (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={sessionDurationMax}
                    onChange={(e) => setSessionDurationMax(Number(e.target.value))}
                  />
                  <p className="mt-1 text-xs text-dim">Coaches cannot set a session duration above this value.</p>
                </div>
                <div className="mb-4">
                  <Label>Minimum Session Duration (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={sessionDurationMin}
                    onChange={(e) => setSessionDurationMin(Number(e.target.value))}
                  />
                  <p className="mt-1 text-xs text-dim">Coaches cannot set a session duration below this value.</p>
                </div>
                <Button type="button" onClick={saveConfig} disabled={updateSettings.isPending}>
                  Save Config
                </Button>
              </div>

              <div className="rounded-2xl border border-line bg-card p-7 shadow-sm">
                <h3 className="mb-5 serif text-lg font-semibold text-ink">Email Settings</h3>
                <div className="space-y-2 text-sm text-mid text-ink">
                  <p>
                    Emails sent from: <span className="font-semibold text-ink">{data.emailFrom || "Not configured"}</span>
                  </p>
                  <p className="text-mid">
                    Email notifications are sent for: OTP verification, session reminders, weekly
                    reports, crisis alerts
                  </p>
                  <p className="text-xs text-dim">
                    To change email config, update GMAIL_USER and GMAIL_PASS in .env and restart the
                    server
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-card p-7 shadow-sm">
              <h3 className="mb-5 serif text-lg font-semibold text-ink">Platform Controls</h3>
              <div className="flex items-center gap-3 border-b border-line py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-ink">Allow Self Registration</div>
                  <div className="mt-0.5 text-xs text-dim">Members can register themselves</div>
                </div>
                <Toggle
                  on={data.allowSelfRegistration}
                  onClick={() => toggle("allowSelfRegistration", !data.allowSelfRegistration)}
                />
              </div>
              <div className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-ink">Maintenance Mode</div>
                  <div className="mt-0.5 text-xs text-dim">
                    Blocks new sign-ins; active sessions stay open
                  </div>
                  {data.maintenanceMode ? (
                    <div className="mt-1 text-xs font-semibold text-danger">
                      ⚠️ Maintenance on — new logins are blocked
                    </div>
                  ) : null}
                </div>
                <Toggle
                  on={data.maintenanceMode}
                  onClick={() => toggle("maintenanceMode", !data.maintenanceMode)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

