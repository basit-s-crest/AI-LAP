"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import users from "@/mock/users.json";

const notes = [
  { c: "Amara Johnson", d: "Mar 25", t: "Weekly Check-in" },
  { c: "Priya Nair", d: "Mar 24", t: "Follow-up" },
  { c: "Marcus Thompson", d: "Mar 23", t: "Initial" },
  { c: "Sofia Reyes", d: "Mar 22", t: "Weekly Check-in" },
];

export default function NotesPage() {
  const opts = (users as { name: string }[]).map((u) => ({ value: u.name, label: u.name }));
  return (
    <DashboardLayout title="Session Notes">
      <div className="grid animate-fadeIn grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <TableWrap>
          <TableToolbar title="Recent Notes">
            <Button size="sm" type="button">
              + New Note
            </Button>
          </TableToolbar>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Client", "Session Date", "Type"].map((h) => (
                  <th
                    key={h}
                    className="border-b-[1.5px] border-line bg-[#EDE7DC] px-[22px] py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-dim"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => (
                <tr key={`${n.c}-${n.d}-${n.t}`} className="group">
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-semibold group-hover:bg-[#EDE7DC]">
                    {n.c}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-mono text-xs text-mid group-hover:bg-[#EDE7DC]">
                    {n.d}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-sm text-mid group-hover:bg-[#EDE7DC]">
                    {n.t}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <Card>
          <h3 className="mb-3 font-serif text-lg font-semibold">Session Note</h3>
          <div className="mb-4">
            <Label>Client</Label>
            <Select options={opts} value={opts[0]?.value ?? ""} onChange={() => {}} />
          </div>
          <div className="mb-4">
            <Label>Session Type</Label>
            <Select
              options={[
                { value: "weekly", label: "Weekly Check-in" },
                { value: "initial", label: "Initial Session" },
                { value: "follow", label: "Follow-up" },
                { value: "crisis", label: "Crisis" },
              ]}
              value="weekly"
              onChange={() => {}}
            />
          </div>
          <div className="mb-4">
            <Label>Notes</Label>
            <Textarea rows={5} placeholder="Session observations, progress, action items..." />
          </div>
          <div className="mb-4">
            <Label>Next Session Goal</Label>
            <Textarea rows={2} placeholder="What to focus on next time..." />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" type="button">
              Save Draft
            </Button>
            <Button type="button">Save & Close</Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
