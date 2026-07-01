"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import api from "@/lib/api";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

interface SignalSummary {
  signal_code: string;
  signal_label: string | null;
  dimension: string | null;
  frequency: number;
  avg_confidence: number;
}

interface SourceContribution {
  source: string;
  weight: number;
  raw_score: number | null;
  weighted_score: number | null;
}

interface TrendPoint {
  date: string;
  score: number;
  tier: string;
  event_count: number;
}

interface RiskReport {
  member_token: string;
  org_id: string;
  computed_at: string;
  composite_score: number;
  risk_tier: string;
  risk_trend: string;
  sources: SourceContribution[];
  crisis_override_applied: boolean;
  floor_applied: boolean;
  floor_reason: string | null;
  top_signals: SignalSummary[];
  trend_history: TrendPoint[];
  recommended_action: string;
}

interface OrgMemberRow {
  member_token: string;
  risk_tier: string;
  composite_score: number;
  risk_trend: string;
  computed_at: string;
}

interface OrgRiskSummary {
  org_id: string;
  total_members: number;
  distribution: {
    low: number;
    moderate: number;
    high: number;
    crisis: number;
  };
  members: OrgMemberRow[];
}

interface CoachMember {
  id: string;
  name: string;
  email: string;
}

const getSourceDetails = (source: string) => {
  const normalized = source.toLowerCase().replace(/_/g, "");
  if (normalized.includes("chat")) return { icon: "💬", desc: "Patient chat message logs" };
  if (normalized.includes("mood")) return { icon: "🎭", desc: "Daily mood check-ins" };
  if (normalized.includes("assess")) return { icon: "📝", desc: "Clinical assessments & surveys" };
  if (normalized.includes("clinic")) return { icon: "🩺", desc: "Primary clinical records" };
  if (normalized.includes("change")) return { icon: "🔄", desc: "Session change detection summaries" };
  return { icon: "📊", desc: "Other diagnostic signals" };
};

export default function ClinicalRiskOperationsPage() {
  const [orgId, setOrgId] = useState("org_univ_maryland");
  const [orgData, setOrgData] = useState<OrgRiskSummary | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [rawOrgJson, setRawOrgJson] = useState("");
  const [showOrgJson, setShowOrgJson] = useState(false);

  const [coachMembers, setCoachMembers] = useState<CoachMember[]>([]);
  const [coachMembersLoading, setCoachMembersLoading] = useState(true);

  // Selected Patient Details
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState<string>("");
  const [reportData, setReportData] = useState<RiskReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [rawReportJson, setRawReportJson] = useState("");
  const [showReportJson, setShowReportJson] = useState(false);

  // Recalculating State
  const [recalcLoading, setRecalcLoading] = useState(false);

  // Initial Data Ingestion
  useEffect(() => {
    // 1. Load coach members to resolve patient names
    api.get<{ members: CoachMember[] }>("/api/coach/members")
      .then(({ data }) => {
        setCoachMembers(data.members);
      })
      .catch((err) => console.error("Failed to load coach members:", err))
      .finally(() => setCoachMembersLoading(false));

    // 2. Load the initial organization overview
    fetchOrgSummary(orgId);
  }, []);

  const fetchOrgSummary = async (targetOrg: string) => {
    if (!targetOrg.trim()) return;
    setOrgLoading(true);
    setOrgError("");
    setRawOrgJson("");
    try {
      const { data } = await api.get<OrgRiskSummary>(`/api/coach/risk/org/${targetOrg}/summary`);
      setOrgData(data);
      setRawOrgJson(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setOrgError(err.message || "Failed to load organization risk directory.");
    } finally {
      setOrgLoading(false);
    }
  };

  const loadPatientFile = async (memberId: string, clientName: string) => {
    setSelectedMemberId(memberId);
    setSelectedMemberName(clientName);
    setReportLoading(true);
    setReportError("");
    setReportData(null);
    setRawReportJson("");
    try {
      const { data } = await api.get<RiskReport>(`/api/coach/risk/member/${memberId}`);
      setReportData(data);
      setRawReportJson(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setReportError(err.message || "Failed to load clinical risk file.");
    } finally {
      setReportLoading(false);
    }
  };

  const triggerRecalculate = async () => {
    if (!selectedMemberId) return;
    setRecalcLoading(true);
    try {
      const { data } = await api.post<RiskReport>(`/api/coach/risk/member/${selectedMemberId}/recalculate`);
      setReportData(data);
      setRawReportJson(JSON.stringify(data, null, 2));
      toast.success("Clinical profile recalculated and refreshed.");
      // Refresh org summary to sync scores in directory list
      fetchOrgSummary(orgId);
    } catch (err: any) {
      toast.error(err.message || "Failed to recalculate patient risk.");
    } finally {
      setRecalcLoading(false);
    }
  };

  // Helper to match names with IDs
  const getPatientName = (memberId: string) => {
    const match = coachMembers.find((m) => m.id === memberId);
    return match ? match.name : `Patient ID: ${memberId.slice(0, 8)}...`;
  };

  const getPatientEmail = (memberId: string) => {
    const match = coachMembers.find((m) => m.id === memberId);
    return match ? match.email : "No email linked";
  };

  const TIER_THEME: Record<
    string,
    { bg: string; border: string; text: string; dot: string; statCardClass: string }
  > = {
    low: {
      bg: "bg-sage-light",
      border: "border-sage/20",
      text: "text-sage",
      dot: "bg-sage",
      statCardClass: "sc-sage",
    },
    moderate: {
      bg: "bg-amber-light",
      border: "border-amber/20",
      text: "text-amber",
      dot: "bg-amber",
      statCardClass: "sc-amber",
    },
    high: {
      bg: "bg-rose-light",
      border: "border-rose/20",
      text: "text-rose",
      dot: "bg-rose",
      statCardClass: "sc-rose",
    },
    crisis: {
      bg: "bg-[#ffebee]",
      border: "border-[#ffcdd2]",
      text: "text-[#c62828]",
      dot: "bg-[#c0392b]",
      statCardClass: "sc-rose",
    },
  };

  // Extract initials for Patient Avatar
  const patientInitials = selectedMemberName
    ? selectedMemberName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  const theme = reportData
    ? (TIER_THEME[reportData.risk_tier] || TIER_THEME.low)
    : TIER_THEME.low;

  return (
    <DashboardLayout
      title="Risk Reports"
      topbarRight={
        <Link
          href="/risk-dashboard"
          className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-bold text-dim hover:text-ink transition-colors"
        >
          ← Live View Dashboard
        </Link>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_2fr] gap-6 items-start">
        
        {/* ─── LEFT COLUMN: Patient Risk Directory (Org Summary API) ─── */}
        <div className="flex flex-col gap-6">
          
          {/* Org Search & Overview */}
          <div className="border border-line bg-card rounded-card p-5 flex flex-col gap-4 shadow-sm">
            <div>
              <h3 className="font-serif text-base font-bold text-ink">Clinical Directory Filters</h3>
              <p className="text-xs text-dim mt-0.5">Filter patients by clinical organization code.</p>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Enter Org ID..."
                className="flex-1 rounded-full border border-line bg-canvas px-3.5 py-1.5 text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-sage"
              />
              <button
                onClick={() => fetchOrgSummary(orgId)}
                disabled={orgLoading || !orgId.trim()}
                className="rounded-full bg-sage hover:bg-sage-mid text-white font-bold text-xs py-1.5 px-4 transition-colors shrink-0 disabled:opacity-50"
              >
                {orgLoading ? "Loading..." : "Load Directory"}
              </button>
            </div>

            {orgError && (
              <div className="rounded-xl border border-rose-mid/30 bg-rose-light p-3 text-xs text-rose font-semibold flex items-center gap-1.5">
                ⚠️ {orgError}
              </div>
            )}

            {orgData && (
              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-line">
                {[
                  { label: "Crisis", count: orgData.distribution.crisis, color: "text-rose", bg: "bg-rose-light", border: "border-rose/10" },
                  { label: "High", count: orgData.distribution.high, color: "text-[#e65100]", bg: "bg-[#fff3e0]", border: "border-[#ffcc80]/30" },
                  { label: "Mod.", count: orgData.distribution.moderate, color: "text-amber", bg: "bg-amber-light", border: "border-amber/20" },
                  { label: "Low", count: orgData.distribution.low, color: "text-sage", bg: "bg-sage-light", border: "border-sage/20" },
                ].map((stat) => (
                  <div key={stat.label} className={cn("rounded-xl p-2 flex flex-col items-center justify-center border", stat.bg, stat.border)}>
                    <span className="text-[9px] font-bold text-dim uppercase leading-none">{stat.label}</span>
                    <span className={cn("text-base font-extrabold mt-1", stat.color)}>{stat.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Patients List */}
          <div className="border border-line bg-card rounded-card overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-line bg-canvas flex justify-between items-center">
              <h4 className="font-serif text-sm font-bold text-ink mb-0">Patient Risk Directory</h4>
              <span className="badge b-dim text-[10px] font-bold">{orgData?.members.length ?? 0} Total</span>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto divide-y divide-line/65">
              {orgLoading ? (
                <div className="p-8 text-center text-xs text-dim">Loading patients directory...</div>
              ) : !orgData || orgData.members.length === 0 ? (
                <div className="p-8 text-center text-xs text-dim">No patient records found.</div>
              ) : (
                orgData.members.map((member) => {
                  const clientName = getPatientName(member.member_token);
                  const isSelected = selectedMemberId === member.member_token;
                  const theme = TIER_THEME[member.risk_tier] || TIER_THEME.low;

                  return (
                    <div
                      key={member.member_token}
                      onClick={() => loadPatientFile(member.member_token, clientName)}
                      className={cn(
                        "p-4 cursor-pointer hover:bg-canvas/40 transition-colors flex items-center justify-between",
                        isSelected ? "bg-sage-light/60 border-l-4 border-sage" : ""
                      )}
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="font-bold text-xs text-ink truncate">{clientName}</div>
                        <div className="font-mono text-[9px] text-dim truncate mt-0.5">{member.member_token}</div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border", theme.bg, theme.text, theme.border)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", theme.dot)} />
                          {member.risk_tier} ({(member.composite_score * 100).toFixed(0)}%)
                        </span>
                        <span className="text-dim text-xs select-none">→</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Collapsible API Info for Left Column */}
          {orgData && (
            <div className="px-1 text-xs">
              <button
                type="button"
                onClick={() => setShowOrgJson(!showOrgJson)}
                className="text-[10px] font-bold text-dim hover:text-ink outline-none flex items-center gap-1 transition-colors"
              >
                ⚙️ {showOrgJson ? "Hide" : "Show"} Developer Logs: Organization Summary API
              </button>
              {showOrgJson && (
                <div className="mt-2 rounded-xl border border-line/60 bg-card p-3.5 font-mono text-[10px] leading-relaxed shadow-sm">
                  <div className="text-dim mb-1 font-bold">API ENDPOINT:</div>
                  <div className="text-ink bg-canvas p-1.5 rounded mb-2 font-semibold select-all border border-line/40">GET /v1/risk/org/{orgId}/summary</div>
                  <div className="text-dim mb-1 font-bold">RESPONSE JSON:</div>
                  <pre className="text-ink bg-canvas p-2 rounded max-h-[150px] overflow-auto border border-line/40">{rawOrgJson}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN: Patient Risk Profile File (Report & Recalculate APIs) ─── */}
        <div className="flex flex-col gap-6">
          
          {!selectedMemberId ? (
            <div className="border border-dashed border-line bg-card rounded-card p-12 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="text-4xl mb-4 select-none">🩺</div>
              <h3 className="font-serif text-base font-bold text-ink mb-1">No Patient File Open</h3>
              <p className="text-xs text-dim max-w-sm leading-relaxed">
                Select a patient from the directory on the left to review their clinical risk report, history trend, and trigger recalculations.
              </p>
            </div>
          ) : (
            <div className="border border-line bg-card rounded-card p-6 flex flex-col gap-5 shadow-sm">
              
              {/* Profile Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-sage-light text-sage flex items-center justify-center font-bold text-sm border border-sage/20 shrink-0">
                    {patientInitials}
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-bold text-ink mb-0.5">{selectedMemberName}</h3>
                    <p className="text-xs text-dim">{getPatientEmail(selectedMemberId)}</p>
                  </div>
                </div>

                <button
                  onClick={triggerRecalculate}
                  disabled={recalcLoading || reportLoading}
                  className="rounded-full border border-line bg-card hover:bg-canvas px-3.5 py-1.5 text-xs font-bold text-ink transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {recalcLoading ? (
                    <>
                      <span className="h-3 w-3 border-2 border-sage/20 border-t-sage rounded-full animate-spin" />
                      Recalculating...
                    </>
                  ) : (
                    <>
                      <span>🔄</span>
                      Refresh Profile
                    </>
                  )}
                </button>
              </div>

              {reportLoading ? (
                <div className="py-12 text-center text-xs text-dim">Loading patient clinical risk file...</div>
              ) : reportError ? (
                <div className="rounded-xl border border-rose-mid/30 bg-rose-light p-4 text-xs text-rose font-semibold leading-relaxed">
                  ⚠️ Error loading report: {reportError}
                  <div className="mt-2 text-dim font-normal">
                    This might indicate no raw logs or assessments have been collected yet for this user. Send a message to seed the database first.
                  </div>
                </div>
              ) : reportData ? (
                <div className="flex flex-col gap-6 animate-fadeIn">
                  
                  {/* Risk Overview Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Score Panel */}
                    <div className={cn("stat-card flex items-center justify-between p-5", theme.statCardClass)}>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-dim uppercase tracking-wider">Clinical Risk Rating</span>
                        <div className="text-3xl font-extrabold text-ink mt-2.5 leading-none">
                          {(reportData.composite_score * 100).toFixed(0)}%
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <span className="text-[11px] text-dim font-medium">Trend:</span>
                          <span className={cn(
                            "badge text-[9.5px] py-0.5 px-2 font-bold uppercase border",
                            reportData.risk_trend === "improving" ? "bg-sage-light text-sage border-sage/20" :
                            reportData.risk_trend === "stable" ? "bg-canvas text-dim border-line" : "bg-rose-light text-rose border-rose/20"
                          )}>
                            {reportData.risk_trend === "improving" && "↘ "}
                            {reportData.risk_trend === "worsening" && "↗ "}
                            {reportData.risk_trend}
                          </span>
                        </div>
                      </div>
                      
                      <div className={cn("rounded-lg border px-3.5 py-2 flex flex-col items-center justify-center font-bold text-sm uppercase shadow-sm shrink-0", theme.bg, theme.text, theme.border)}>
                        <span className="text-[9px] font-extrabold tracking-widest leading-none text-dim opacity-70 mb-1.5">TIER</span>
                        {reportData.risk_tier}
                      </div>
                    </div>

                    {/* Recommendation Panel */}
                    <div className="stat-card sc-teal flex flex-col justify-between p-5">
                      <div>
                        <span className="text-[10px] font-bold text-dim uppercase tracking-wider">Clinical Recommendation</span>
                        <div className="text-xs font-bold text-ink mt-2.5 leading-snug">
                          {reportData.recommended_action.replace(/_/g, " ").toUpperCase()}
                        </div>
                      </div>
                      <span className="text-[10.5px] text-dim mt-3 leading-snug">Verify these metrics alongside weekly checks.</span>
                    </div>
                  </div>

                  {/* Crisis Alerts and floors warnings */}
                  {(reportData.crisis_override_applied || reportData.floor_applied) && (
                    <div className="rounded-xl border border-amber-mid/30 bg-amber-light p-4 text-xs text-amber flex flex-col gap-1.5 shadow-sm">
                      {reportData.crisis_override_applied && (
                        <div className="font-bold">🚨 Crisis Alert Override: A high-severity indicator was detected in the patient's messages within the last 24 hours. The risk rating is fixed to maximum.</div>
                      )}
                      {reportData.floor_applied && (
                        <div className="font-semibold">🛡️ Risk Floor Active: Score cannot drop below Moderate ({reportData.floor_reason}).</div>
                      )}
                    </div>
                  )}

                  {/* Warning Signals */}
                  <div>
                    <h4 className="text-[10px] font-bold text-dim uppercase tracking-wider mb-3">Detected Clinical Indicators</h4>
                    {reportData.top_signals.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-dim italic">
                        No risk-associated symptoms or signals identified.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {reportData.top_signals.map((sig) => (
                          <div key={sig.signal_code} className="rounded-xl border border-line/60 bg-card p-3.5 flex flex-col justify-between shadow-sm hover:border-line transition-all duration-200">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-ink">{sig.signal_code}</span>
                                {sig.signal_label && (
                                  <span className="text-[10px] text-dim font-medium mt-0.5">{sig.signal_label}</span>
                                )}
                              </div>
                              <span className="badge b-dim text-[9px] font-bold py-0.5 px-2 shrink-0">{sig.frequency} {sig.frequency === 1 ? 'Instance' : 'Instances'}</span>
                            </div>
                            <div className="mt-3.5">
                              <div className="flex justify-between items-center text-[10px] text-dim mb-1 font-semibold">
                                <span>Confidence</span>
                                <span>{(sig.avg_confidence * 100).toFixed(0)}%</span>
                              </div>
                              <div className="w-full bg-line/50 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-gradient-to-r from-sage/80 to-sage h-1.5 rounded-full transition-all duration-500" style={{ width: `${sig.avg_confidence * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Risk Breakdown progress bars */}
                  <div>
                    <h4 className="text-[10px] font-bold text-dim uppercase tracking-wider mb-3">Risk Source Breakdown</h4>
                    <div className="space-y-2.5">
                      {reportData.sources.map((src) => {
                        const rawScore = src.raw_score ?? 0;
                        const valPercent = (rawScore * 100).toFixed(0);
                        const weightPercent = (src.weight * 100).toFixed(0);
                        
                        // Calculate renormalized weight contribution dynamically matching backend composite logic
                        const isAvailable = src.available && src.raw_score !== null;
                        const activeSources = reportData.sources.filter(s => s.available && s.raw_score !== null);
                        const totalActiveWeight = activeSources.reduce((sum, s) => sum + s.weight, 0);
                        const normalizedWeight = (isAvailable && totalActiveWeight > 0) ? (src.weight / totalActiveWeight) : 0;
                        const contribution = rawScore * normalizedWeight;
                        const contributionPercent = (contribution * 100).toFixed(1);
                        
                        const details = getSourceDetails(src.source);
                        
                        // Dynamic styling based on severity percentage (using standard mid-tints without invalid alpha modifier overrides)
                        let barColor = "from-sage-mid to-sage";
                        let textColor = "text-sage";
                        let bgBadgeColor = "bg-sage-light";
                        let borderBadgeColor = "border-sage/20";
                        if (rawScore >= 0.7) {
                          barColor = "from-rose-mid to-rose";
                          textColor = "text-rose";
                          bgBadgeColor = "bg-rose-light";
                          borderBadgeColor = "border-rose/20";
                        } else if (rawScore >= 0.3) {
                          barColor = "from-amber-mid to-amber";
                          textColor = "text-amber";
                          bgBadgeColor = "bg-amber-light";
                          borderBadgeColor = "border-amber/20";
                        }

                        return (
                          <div
                            key={src.source}
                            className="rounded-xl border border-line/60 bg-card p-4 shadow-sm hover:border-line hover:shadow-md transition-all duration-200"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1.7fr_1fr] gap-4 items-center">
                              
                              {/* Left: Source Icon & Title */}
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-canvas flex items-center justify-center text-lg shadow-sm border border-line/40 shrink-0">
                                  {details.icon}
                                </div>
                                <div className="min-w-0">
                                  <h5 className="font-serif text-sm font-bold text-ink capitalize truncate">
                                    {src.source.replace(/_/g, " ")}
                                  </h5>
                                  <p className="text-[10px] text-dim truncate mt-0.5">
                                    {details.desc}
                                  </p>
                                </div>
                              </div>

                              {/* Middle: Raw Risk & Progress bar */}
                              <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="text-dim font-medium">Raw Risk Intensity</span>
                                  <span className={cn("font-bold px-1.5 py-0.5 rounded text-[9.5px] uppercase border", bgBadgeColor, textColor, borderBadgeColor)}>
                                    {isAvailable ? `${valPercent}%` : "N/A"}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-line/30">
                                  {isAvailable ? (
                                    <div
                                      className={cn("h-2.5 rounded-full transition-all duration-500 bg-gradient-to-r", barColor)}
                                      style={{ width: `${rawScore * 100}%` }}
                                    />
                                  ) : (
                                    <div className="h-2.5 bg-slate-200/50 rounded-full w-0" />
                                  )}
                                </div>
                              </div>

                              {/* Right: Contribution details */}
                              <div className="grid grid-cols-2 gap-2 text-center md:text-right md:border-l md:border-line/40 md:pl-4">
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-extrabold text-dim uppercase tracking-wider">Weight</span>
                                  <span className="text-xs font-bold text-ink mt-0.5">{weightPercent}%</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-extrabold text-dim uppercase tracking-wider">Contribution</span>
                                  <span className={cn("text-xs font-extrabold mt-0.5", isAvailable && rawScore > 0 ? textColor : "text-dim")}>
                                    {isAvailable ? `+${contributionPercent}%` : "0.0%"}
                                  </span>
                                </div>
                              </div>

                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Calculation Explanation Note */}
                    <div className="mt-3.5 text-[10.5px] text-dim flex items-start gap-1.5 leading-normal bg-canvas p-3 rounded-xl border border-line/40">
                      <span className="shrink-0">ℹ️</span>
                      <span>
                        <strong>Understanding Contribution:</strong> Contribution represents the actual percentage points this category adds to the final Clinical Risk Rating. Since other channels (Mood, Assessments) are currently N/A for this patient, the available channel (Chat Posts) holds 100% of the active formula weight, contributing the full raw risk value (e.g. +70.0% for Meet Radadiya) to the final score.
                      </span>
                    </div>
                  </div>

                  {/* 7-Day Trend Timeline */}
                  {reportData.trend_history.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-dim uppercase tracking-wider mb-3">7-Day Trend Timeline</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                        {reportData.trend_history.map((pt) => {
                          const theme = TIER_THEME[pt.tier] || TIER_THEME.low;
                          const formattedDate = new Date(pt.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                          return (
                            <div key={pt.date} className="rounded-xl border border-line/60 bg-card p-2.5 flex flex-col items-center justify-center text-center shadow-sm hover:border-line transition-all duration-200">
                              <span className="text-[10px] font-bold text-dim">{formattedDate}</span>
                              <span className="text-xs font-extrabold text-ink mt-1">{(pt.score * 100).toFixed(0)}%</span>
                              <span className={cn("mt-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", theme.bg, theme.text)}>
                                {pt.tier}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Collapsible API Info for Patient File */}
                  <div className="border-t border-line pt-4 text-xs">
                    <button
                      type="button"
                      onClick={() => setShowReportJson(!showReportJson)}
                      className="text-[10px] font-bold text-dim hover:text-ink outline-none flex items-center gap-1 transition-colors"
                    >
                      ⚙️ {showReportJson ? "Hide" : "Show"} Developer Logs: Report & Recalculate APIs
                    </button>
                    {showReportJson && (
                      <div className="mt-2 rounded-xl border border-line/60 bg-card p-3.5 font-mono text-[10px] leading-relaxed shadow-sm">
                        <div className="text-dim mb-1 font-bold">API ENDPOINTS:</div>
                        <div className="text-ink bg-canvas p-1.5 rounded mb-1 font-semibold select-all border border-line/40">GET /v1/risk/member/{selectedMemberId}</div>
                        <div className="text-ink bg-canvas p-1.5 rounded mb-2 font-semibold select-all border border-line/40">POST /v1/risk/member/{selectedMemberId}/recalculate</div>
                        <div className="text-dim mb-1 font-bold">RESPONSE JSON:</div>
                        <pre className="text-ink bg-canvas p-2 rounded max-h-[150px] overflow-auto border border-line/40">{rawReportJson}</pre>
                      </div>
                    )}
                  </div>

                </div>
              ) : null}

            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
