"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { useAppSelector } from "@/hooks/redux";
import { cn } from "@/lib/cn";

const PHQ_QS = [
  "Little interest or pleasure in doing things?",
  "Feeling down, depressed, or hopeless?",
  "Trouble falling or staying asleep, or sleeping too much?",
  "Feeling tired or having little energy?",
  "Poor appetite or overeating?",
  "Feeling bad about yourself — or that you are a failure?",
  "Trouble concentrating on things?",
  "Moving or speaking so slowly that others could have noticed?",
];

const GAD_QS = [
  "Feeling nervous, anxious, or on edge?",
  "Not being able to stop or control worrying?",
  "Worrying too much about different things?",
  "Trouble relaxing?",
  "Being so restless that it is hard to sit still?",
  "Becoming easily annoyed or irritable?",
  "Feeling afraid as if something awful might happen?",
];

const LIKERT = ["Not at all", "Several days", "More than half", "Nearly every day"];

const DEMO_OPTS = [
  { k: "age", l: "Age Range", opts: ["Under 18", "18-24", "25-30", "31+"] },
  { k: "identity", l: "How do you identify?", opts: ["BIPOC", "White", "Multiracial", "Prefer not to say"] },
  { k: "gender", l: "Gender Identity", opts: ["Woman", "Man", "Non-binary", "Questioning", "Prefer not to say"] },
  {
    k: "orient",
    l: "Sexual Orientation",
    opts: ["Heterosexual", "Gay/Lesbian", "Bisexual", "Queer", "Prefer not to say"],
  },
] as const;

export function OnboardingFlow() {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const name = user?.firstName ?? "Amara";
  const [onboardStep, setOnboardStep] = useState(0);
  const [assessType, setAssessType] = useState<"PHQ" | "GAD">("PHQ");
  const [qIdx, setQIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [demos, setDemos] = useState<Record<string, string>>({});

  const qs = assessType === "PHQ" ? PHQ_QS : GAD_QS;

  const advanceLikert = useCallback(
    (i: number) => {
      setSel(i);
      setTimeout(() => {
        setSel(null);
        if (qIdx + 1 < qs.length) {
          setQIdx((x) => x + 1);
        } else if (assessType === "PHQ") {
          setAssessType("GAD");
          setQIdx(0);
        } else {
          setOnboardStep(2);
        }
      }, 360);
    },
    [assessType, qIdx, qs.length]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-[600px]">
        <div className="mb-8 text-center">
          <div className="font-serif text-[26px] font-semibold text-ink">
            Welcome, {name} 🌿
          </div>
          <p className="mt-1 text-sm text-mid">Let&apos;s personalise your experience</p>
        </div>
        <div className="mb-7 flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-2 rounded-full bg-[rgba(60,50,40,0.15)] transition-all",
                i === onboardStep && "w-6 rounded bg-sage",
                i < onboardStep && "bg-sage-light"
              )}
            />
          ))}
        </div>

        {onboardStep === 0 ? (
          <Card className="animate-fadeIn">
            <div className="mb-5 text-center">
              <div className="mb-2 text-[44px]">🌱</div>
              <div className="font-serif text-[26px] font-semibold">A few things about you</div>
              <p className="text-sm text-mid">All optional — skip anything you&apos;re not comfortable with.</p>
            </div>
            {DEMO_OPTS.map((q) => (
              <div key={q.k} className="mb-4">
                <Label>{q.l}</Label>
                <Select
                  options={[
                    { value: "", label: "Prefer not to say" },
                    ...q.opts.map((o) => ({ value: o, label: o })),
                  ]}
                  value={demos[q.k] ?? ""}
                  onChange={(v) => setDemos((d) => ({ ...d, [q.k]: v }))}
                />
              </div>
            ))}
            <div className="mt-4 flex gap-3">
              <Button variant="ghost" type="button" onClick={() => setOnboardStep(1)}>
                Skip
              </Button>
              <Button type="button" className="flex-1" onClick={() => setOnboardStep(1)}>
                Continue →
              </Button>
            </div>
          </Card>
        ) : null}

        {onboardStep === 1 ? (
          <Card className="animate-fadeIn">
            <div className="mb-3 flex items-center justify-between">
              <Badge variant={assessType === "PHQ" ? "sage" : "blue"}>
                {assessType === "PHQ" ? "PHQ-8 · Depression" : "GAD-7 · Anxiety"}
              </Badge>
              <span className="text-sm text-dim">
                {qIdx + 1} of {qs.length}
              </span>
            </div>
            <div className="mb-6 h-1.5 rounded bg-[#EDE7DC]">
              <div
                className="h-full rounded bg-sage transition-[width] duration-300"
                style={{ width: `${((qIdx + 1) / qs.length) * 100}%` }}
              />
            </div>
            <p className="mb-3 text-sm text-mid">
              Over the last 2 weeks, how often have you been bothered by:
            </p>
            <p className="mb-5 font-serif text-[21px] font-normal leading-snug text-ink">
              {qs[qIdx]}
            </p>
            <div className="flex gap-2.5">
              {LIKERT.map((l, i) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => advanceLikert(i)}
                  className={cn(
                    "flex-1 rounded-[11px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-1.5 py-3 text-center transition-all hover:border-sage hover:bg-sage-soft",
                    sel === i && "border-sage bg-sage-tint"
                  )}
                >
                  <div className={cn("text-xl font-bold text-ink", sel === i && "text-sage")}>
                    {i}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold text-mid">{l}</div>
                </button>
              ))}
            </div>
            <p
              className="mt-4 cursor-pointer text-center text-xs text-dim"
              onClick={() => setOnboardStep(2)}
            >
              Skip assessments
            </p>
          </Card>
        ) : null}

        {onboardStep === 2 ? (
          <Card className="animate-fadeIn text-center">
            <div className="mb-3 text-[44px]">🎉</div>
            <div className="font-serif text-[28px] font-semibold">You&apos;re all set!</div>
            <p className="mb-6 text-mid">
              We&apos;ve matched you with coaches and groups based on your responses.
            </p>
            <Button size="lg" type="button" onClick={() => router.push("/dashboard")}>
              Enter Azadi →
            </Button>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
