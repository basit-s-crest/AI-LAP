"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import api from "@/lib/api";
import { cn } from "@/lib/cn";

interface CoachMember {
  id: string;
  name: string;
  email: string;
}

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
  raw_risk: number;
  weighted_risk: number;
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

export default function RiskApiOperationsPage() {
  const [members, setMembers] = useState<CoachMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  // API 1: Member Report State
  const [selectedMemberReport, setSelectedMemberReport] = useState("");
  const [reportData, setReportData] = useState<RiskReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [rawReportJson, setRawReportJson] = useState("");
  const [showReportJson, setShowReportJson] = useState(false);

  // API 2: Recalculate State
  const [selectedMemberRecalc, setSelectedMemberRecalc] = useState("");
  const [recalcData, setRecalcData] = useState<RiskReport | null>(null);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcError, setRecalcError] = useState("");
  const [recalcSuccess, setRecalcSuccess] = useState(false);
  const [rawRecalcJson, setRawRecalcJson] = useState("");
  const [showRecalcJson, setShowRecalcJson] = useState(false);

  // API 3: Org Summary State
  const [orgId, setOrgId] = useState("org_univ_maryland");
  const [orgData, setOrgData] = useState<OrgRiskSummary | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [rawOrgJson, setRawOrgJson] = useState("");
  const [showOrgJson, setShowOrgJson] = useState(false);

  useEffect(() => {
    setMembersLoading(true);
    api.get<{ members: CoachMember[] }>("/api/coach/members")
      .then(({ data }) => {
        setMembers(data.members);
        if (data.members.length > 0) {
          setSelectedMemberReport(data.members[0].id);
          setSelectedMemberRecalc(data.members[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to load members:", err);
      })
      .finally(() => {
        setMembersLoading(false);
      });
  }, []);

  const handleFetchReport = async () => {
    if (!selectedMemberReport) return;
    setReportLoading(true);
    setReportError("");
    setReportData(null);
    setRawReportJson("");
    try {
      const { data } = await api.get<RiskReport>(`/api/coach/risk/member/${selectedMemberReport}`);
      setReportData(data);
      setRawReportJson(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setReportError(err.message || "Failed to fetch member report");
    } finally {
      setReportLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!selectedMemberRecalc) return;
    setRecalcLoading(true);
    setRecalcError("");
    setRecalcData(null);
    setRecalcSuccess(false);
    setRawRecalcJson("");
    try {
      const { data } = await api.post<RiskReport>(`/api/coach/risk/member/${selectedMemberRecalc}/recalculate`);
      setRecalcData(data);
      setRecalcSuccess(true);
      setRawRecalcJson(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setRecalcError(err.message || "Failed to recalculate risk");
    } finally {
      setRecalcLoading(false);
    }
  };

  const handleFetchOrgSummary = async () => {
    if (!orgId.trim()) return;
    setOrgLoading(true);
    setOrgError("");
    setOrgData(null);
    setRawOrgJson("");
    try {
      const { data } = await api.get<OrgRiskSummary>(`/api/coach/risk/org/${orgId}/summary`);
      setOrgData(data);
      setRawOrgJson(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setOrgError(err.message || "Failed to fetch organization risk summary");
    } finally {
      setOrgLoading(false);
    }
  };

  const TIER_COLORS: Record<string, string> = {
    low: "text-[#2e7d32] bg-[#e8f5e9] border-[#c8e6c9]",
    moderate: "text-[#f57f17] bg-[#fff8e1] border-[#ffe082]",
    high: "text-[#e65100] bg-[#fff3e0] border-[#ffcc80]",
    crisis: "text-[#c62828] bg-[#ffebee] border-[#ffcdd2]",
  };

  return (
    <DashboardLayout
      title="Risk Engine Operations"
      topbarRight={
        <Link
          href="/risk-dashboard"
          className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-bold text-dim hover:text-ink transition-colors flex items-center gap-1.5"
        >
          ← Back to Dashboard
        </Link>
      }
    >
      <div className="mb-6 rounded-card border border-line bg-[var(--bg-surface-2)] p-5">
        <h2 className="font-serif text-lg font-bold text-ink mb-1">Risk Engine API Playground</h2>
        <p className="text-sm text-dim leading-relaxed">
          Directly execute, test, and audit all three core operations of the VASL risk analysis engine. All queries run through the Express middleware proxy secure routes to FastAPI.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        
        {/* ─── API 1: Fetch Member Risk Report ─── */}
        <div className="card flex flex-col gap-4 p-5">
          <div>
            <span className="badge b-sage uppercase text-[9px] tracking-wider mb-2">API Operation #1</span>
            <h3 className="font-serif text-base font-bold text-ink">Fetch Member Risk Report</h3>
            <p className="text-xs text-dim mt-0.5 font-mono">GET /v1/risk/member/{"{member_token}"}</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] font-bold text-dim uppercase mb-1.5">Select Client</label>
              <select
                value={selectedMemberReport}
                onChange={(e) => setSelectedMemberReport(e.target.value)}
                disabled={membersLoading || reportLoading}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-sage"
              >
                {membersLoading ? (
                  <option>Loading clients...</option>
                ) : (
                  members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id.slice(0, 8)}...)
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              onClick={handleFetchReport}
              disabled={reportLoading || !selectedMemberReport}
              className="btn btn-sage text-xs py-2 px-4 h-[36px]"
            >
              {reportLoading ? "Querying..." : "Run GET Report"}
            </button>
          </div>

          {/* Report Results */}
          {reportError && (
            <div className="rounded-lg border border-[#ffcdd2] bg-[#ffebee] p-3 text-xs font-semibold text-[#c62828] animate-fadeIn">
              ⚠️ Error: {reportError}
            </div>
          )}

          {reportData && (
            <div className="flex flex-col gap-4 border-t border-line pt-4 animate-fadeIn">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-line bg-canvas p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-dim uppercase">Composite Score</span>
                  <div className="text-2xl font-extrabold text-ink mt-1">{(reportData.composite_score * 100).toFixed(1)}%</div>
                </div>
                <div className="rounded-lg border border-line bg-canvas p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-dim uppercase">Risk Tier</span>
                  <div className={cn("mt-1.5 inline-flex self-start rounded-md border px-2 py-0.5 text-xs font-bold uppercase", TIER_COLORS[reportData.risk_tier] || TIER_COLORS.low)}>
                    {reportData.risk_tier}
                  </div>
                </div>
                <div className="rounded-lg border border-line bg-canvas p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-dim uppercase">Risk Trend</span>
                  <div className="text-sm font-bold text-ink mt-1">{reportData.risk_trend.toUpperCase()}</div>
                </div>
                <div className="rounded-lg border border-line bg-canvas p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-dim uppercase">Recommended Action</span>
                  <div className="text-xs font-bold text-ink mt-1 leading-snug">{reportData.recommended_action.replace(/_/g, " ")}</div>
                </div>
              </div>

              {/* Special overrides information */}
              {(reportData.crisis_override_applied || reportData.floor_applied) && (
                <div className="rounded-lg border border-[#ffe082] bg-[#fff8e1] p-3 text-xs text-[#f57f17]">
                  {reportData.crisis_override_applied && (
                    <div className="font-semibold">🚨 Crisis override active (due to critical message trigger in last 24h).</div>
                  )}
                  {reportData.floor_applied && (
                    <div className="font-semibold mt-1">🛡️ Score floor active: {reportData.floor_reason}.</div>
                  )}
                </div>
              )}

              {/* Active Signals */}
              {reportData.top_signals.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-dim uppercase mb-2">Detected Signals (Last 60 Days)</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {reportData.top_signals.map((sig) => (
                      <span key={sig.signal_code} className="rounded-md border border-line bg-canvas px-2.5 py-1 text-xs text-ink">
                        <strong>{sig.signal_code}</strong>: {(sig.avg_confidence * 100).toFixed(0)}% confidence ({sig.frequency}x)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Source Weights Contributions */}
              {reportData.sources.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-dim uppercase mb-2">Source Weight Contributions</h4>
                  <div className="space-y-2">
                    {reportData.sources.map((src) => (
                      <div key={src.source} className="flex items-center justify-between text-xs">
                        <span className="font-semibold capitalize text-ink">{src.source.replace(/_/g, " ")}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-dim">Weight: {(src.weight * 100).toFixed(0)}%</span>
                          <span className="font-bold text-ink">Value: {(src.raw_risk * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw JSON toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowReportJson(!showReportJson)}
                  className="text-xs font-bold text-sage hover:underline outline-none"
                >
                  {showReportJson ? "Hide Raw JSON Output" : "View Raw JSON Output"}
                </button>
                {showReportJson && (
                  <pre className="mt-2 text-[10.5px] font-mono bg-canvas border border-line p-3 rounded-lg overflow-x-auto text-ink max-h-[300px] leading-relaxed">
                    {rawReportJson}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── API 2: Force Recalculate Member Risk ─── */}
        <div className="card flex flex-col gap-4 p-5">
          <div>
            <span className="badge b-amber uppercase text-[9px] tracking-wider mb-2">API Operation #2</span>
            <h3 className="font-serif text-base font-bold text-ink">Force Recalculate Risk</h3>
            <p className="text-xs text-dim mt-0.5 font-mono">POST /v1/risk/member/{"{member_token}"}/recalculate</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] font-bold text-dim uppercase mb-1.5">Select Client</label>
              <select
                value={selectedMemberRecalc}
                onChange={(e) => setSelectedMemberRecalc(e.target.value)}
                disabled={membersLoading || recalcLoading}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-sage"
              >
                {membersLoading ? (
                  <option>Loading clients...</option>
                ) : (
                  members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id.slice(0, 8)}...)
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              onClick={handleRecalculate}
              disabled={recalcLoading || !selectedMemberRecalc}
              className="btn bg-[#ffc107] hover:bg-[#ffb300] text-black text-xs font-bold py-2 px-4 h-[36px] rounded-lg transition-colors"
            >
              {recalcLoading ? "Recalculating..." : "Run POST Recalculate"}
            </button>
          </div>

          {recalcError && (
            <div className="rounded-lg border border-[#ffcdd2] bg-[#ffebee] p-3 text-xs font-semibold text-[#c62828] animate-fadeIn">
              ⚠️ Error: {recalcError}
            </div>
          )}

          {recalcSuccess && recalcData && (
            <div className="flex flex-col gap-4 border-t border-line pt-4 animate-fadeIn">
              <div className="rounded-lg border border-[#c8e6c9] bg-[#e8f5e9] p-3 text-xs font-semibold text-[#2e7d32]">
                ✓ Success! Risk scores recalculated successfully for client.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-line bg-canvas p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-dim uppercase">Recalculated Score</span>
                  <div className="text-2xl font-extrabold text-ink mt-1">{(recalcData.composite_score * 100).toFixed(1)}%</div>
                </div>
                <div className="rounded-lg border border-line bg-canvas p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-dim uppercase">Risk Tier</span>
                  <div className={cn("mt-1.5 inline-flex self-start rounded-md border px-2 py-0.5 text-xs font-bold uppercase", TIER_COLORS[recalcData.risk_tier] || TIER_COLORS.low)}>
                    {recalcData.risk_tier}
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowRecalcJson(!showRecalcJson)}
                  className="text-xs font-bold text-sage hover:underline outline-none"
                >
                  {showRecalcJson ? "Hide Raw JSON Output" : "View Raw JSON Output"}
                </button>
                {showRecalcJson && (
                  <pre className="mt-2 text-[10.5px] font-mono bg-canvas border border-line p-3 rounded-lg overflow-x-auto text-ink max-h-[300px] leading-relaxed">
                    {rawRecalcJson}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── API 3: Fetch Organization Risk Summary ─── */}
        <div className="card xl:col-span-2 flex flex-col gap-4 p-5">
          <div>
            <span className="badge b-rose uppercase text-[9px] tracking-wider mb-2">API Operation #3</span>
            <h3 className="font-serif text-base font-bold text-ink">Fetch Organization Risk Summary</h3>
            <p className="text-xs text-dim mt-0.5 font-mono">GET /v1/risk/org/{"{org_id}"}/summary</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] max-w-[400px]">
              <label className="block text-[11px] font-bold text-dim uppercase mb-1.5">Organization ID</label>
              <input
                type="text"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                disabled={orgLoading}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-sage"
              />
            </div>
            <button
              onClick={handleFetchOrgSummary}
              disabled={orgLoading || !orgId.trim()}
              className="btn btn-sage text-xs py-2 px-4 h-[36px]"
            >
              {orgLoading ? "Fetching..." : "Run GET Summary"}
            </button>
          </div>

          {orgError && (
            <div className="rounded-lg border border-[#ffcdd2] bg-[#ffebee] p-3 text-xs font-semibold text-[#c62828] animate-fadeIn">
              ⚠️ Error: {orgError}
            </div>
          )}

          {orgData && (
            <div className="flex flex-col gap-5 border-t border-line pt-4 animate-fadeIn">
              <h4 className="text-[11px] font-bold text-dim uppercase mb-1">Organization Details: {orgData.org_id}</h4>
              
              {/* Distribution Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Crisis", count: orgData.distribution.crisis, color: "text-[#c62828]", bg: "bg-[#ffebee]" },
                  { label: "High Risk", count: orgData.distribution.high, color: "text-[#e65100]", bg: "bg-[#fff3e0]" },
                  { label: "Moderate", count: orgData.distribution.moderate, color: "text-[#f57f17]", bg: "bg-[#fff8e1]" },
                  { label: "Low Risk", count: orgData.distribution.low, color: "text-[#2e7d32]", bg: "bg-[#e8f5e9]" },
                ].map((dist) => (
                  <div key={dist.label} className={cn("rounded-lg border border-line p-3 flex items-center justify-between", dist.bg)}>
                    <span className="text-xs font-bold text-dim">{dist.label}</span>
                    <span className={cn("text-xl font-extrabold", dist.color)}>{dist.count}</span>
                  </div>
                ))}
              </div>

              {/* Members table */}
              {orgData.members.length > 0 ? (
                <div>
                  <h4 className="text-[11px] font-bold text-dim uppercase mb-2">Member Risk Directory</h4>
                  <div className="overflow-x-auto rounded-lg border border-line bg-canvas">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-line bg-[var(--bg-surface-2)]">
                          <th className="p-3 font-bold text-dim uppercase">Member Token</th>
                          <th className="p-3 font-bold text-dim uppercase">Risk Tier</th>
                          <th className="p-3 font-bold text-dim uppercase">Score</th>
                          <th className="p-3 font-bold text-dim uppercase">Trend</th>
                          <th className="p-3 font-bold text-dim uppercase text-right">Computed At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgData.members.map((m) => (
                          <tr key={m.member_token} className="border-b border-line last:border-0 hover:bg-card">
                            <td className="p-3 font-mono font-medium text-ink">{m.member_token}</td>
                            <td className="p-3">
                              <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase border", TIER_COLORS[m.risk_tier] || TIER_COLORS.low)}>
                                {m.risk_tier}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-ink">{(m.composite_score * 100).toFixed(1)}%</td>
                            <td className="p-3 text-dim capitalize font-semibold">{m.risk_trend}</td>
                            <td className="p-3 text-right text-dim font-mono">{new Date(m.computed_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-dim bg-canvas rounded-lg border border-line">
                  No active member data found under organization.
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowOrgJson(!showOrgJson)}
                  className="text-xs font-bold text-sage hover:underline outline-none"
                >
                  {showOrgJson ? "Hide Raw JSON Output" : "View Raw JSON Output"}
                </button>
                {showOrgJson && (
                  <pre className="mt-2 text-[10.5px] font-mono bg-canvas border border-line p-3 rounded-lg overflow-x-auto text-ink max-h-[300px] leading-relaxed">
                    {rawOrgJson}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
