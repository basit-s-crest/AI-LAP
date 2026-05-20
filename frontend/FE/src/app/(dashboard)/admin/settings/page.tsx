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
  useUploadLoader,
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
  const uploadLoader = useUploadLoader();

  const [brandTitle, setBrandTitle] = useState("");
  const [brandTagline, setBrandTagline] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4E8C58");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loaderUrl, setLoaderUrl] = useState<string | null>(null);

  const [supportEmail, setSupportEmail] = useState("");
  const [sessionDurationDefault, setSessionDurationDefault] = useState(50);

  useEffect(() => {
    if (!data) return;
    setBrandTitle(data.brandTitle);
    setBrandTagline(data.brandTagline);
    setPrimaryColor(data.primaryColor);
    setLogoUrl(data.logoUrl);
    setLoaderUrl(data.loaderUrl);
    setSupportEmail(data.supportEmail);
    setSessionDurationDefault(data.sessionDurationDefault);
  }, [data]);

  const saveBranding = () => {
    updateSettings.mutate(
      { brandTitle, brandTagline, primaryColor, logoUrl, loaderUrl },
      {
        onSuccess: () => {
          localStorage.setItem("platform_brand_title", brandTitle || "Azadi Health");
          toast.success("Branding settings updated");
        },
        onError: (err) => toast.error(err.message || "Failed to update branding"),
      }
    );
  };

  const saveConfig = () => {
    updateSettings.mutate(
      { supportEmail, sessionDurationDefault },
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

  const onUploadLoader = async (file: File | null) => {
    if (!file) return;
    try {
      const base64 = await toBase64(file);
      const saved = await uploadLoader.mutateAsync(base64);
      setLoaderUrl(saved.url);
      toast.success("Loader uploaded");
    } catch (err) {
      toast.error((err as Error).message || "Failed to upload loader");
    }
  };

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 rounded-[11px] transition-colors",
        on ? "bg-sage" : "border-[1.5px] border-[rgba(60,50,40,0.2)] bg-[#EDE7DC]"
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
        <div className="h-28 animate-pulse rounded-card border-[1.5px] border-line bg-[#F0EBE1]" />
      ) : isError ? (
        <Card className="text-sm text-danger">{error?.message || "Failed to load settings"}</Card>
      ) : data ? (
        <div className="max-w-[980px] animate-fadeIn">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
          <Card>
            <h3 className="mb-4 font-serif text-lg font-semibold">Branding</h3>
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
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-14 p-1"
                  />
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                </div>
              </div>
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
              <div>
                <Label>Loader Upload</Label>
                {loaderUrl ? (
                  <img
                    src={assetUrl(loaderUrl)}
                    alt="Loader preview"
                    className="mb-2 mt-2 h-14 rounded-md border border-line object-contain p-1"
                  />
                ) : null}
                <Input
                  type="file"
                  accept="image/*,.gif,.svg"
                  onChange={(e) => void onUploadLoader(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <Button type="button" onClick={saveBranding} disabled={updateSettings.isPending}>
              Save Branding
            </Button>
          </Card>

            <Card>
              <h3 className="mb-4 font-serif text-lg font-semibold">Platform Config</h3>
              <div className="mb-4">
                <Label>Support Email</Label>
                <Input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <Label>Default Session Duration (minutes)</Label>
                <Input
                  type="number"
                  value={sessionDurationDefault}
                  onChange={(e) => setSessionDurationDefault(Number(e.target.value))}
                />
              </div>
              <Button type="button" onClick={saveConfig} disabled={updateSettings.isPending}>
                Save Config
              </Button>
            </Card>

            <Card>
            <h3 className="mb-3 font-serif text-lg font-semibold">Email Settings</h3>
            <div className="space-y-2 text-sm text-mid">
              <p>
                Emails sent from: <span className="font-semibold text-ink">{data.emailFrom || "Not configured"}</span>
              </p>
              <p>
                Email notifications are sent for: OTP verification, session reminders, weekly
                reports, crisis alerts
              </p>
              <p className="text-xs text-dim">
                To change email config, update GMAIL_USER and GMAIL_PASS in .env and restart the
                server
              </p>
            </div>
          </Card>
            </div>

            <Card>
              <h3 className="mb-3 font-serif text-lg font-semibold">Platform Controls</h3>
              <div className="flex items-center gap-3 border-b border-[rgba(60,50,40,0.08)] py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">Allow Self Registration</div>
                  <div className="mt-0.5 text-xs text-dim">Members can register themselves</div>
                </div>
                <Toggle
                  on={data.allowSelfRegistration}
                  onClick={() => toggle("allowSelfRegistration", !data.allowSelfRegistration)}
                />
              </div>
              <div className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">Maintenance Mode</div>
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
            </Card>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

