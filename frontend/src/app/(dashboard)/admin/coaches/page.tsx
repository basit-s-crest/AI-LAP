"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BaseModal } from "@/components/modals/BaseModal";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { closeModal, openModal } from "@/store/slices/uiSlice";
import { useAppendCoachMutation, useCoachesQuery, useRemoveCoachMutation } from "@/hooks/api/use-coaches";
import type { Coach } from "@/types/coach";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminCoachesPage() {
  const dispatch = useAppDispatch();
  const { data: coaches = [], isPending } = useCoachesQuery();
  const appendCoach = useAppendCoachMutation();
  const removeCoach = useRemoveCoachMutation();
  const modal = useAppSelector((s) => s.ui.modal);
  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [org, setOrg] = useState("Azadi Health Staff");
  const [email, setEmail] = useState("");

  const submit = () => {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    const c: Coach = {
      id: Date.now(),
      name: name.trim(),
      spec: spec || "—",
      org,
      emoji: "🧑",
      bg: "#D4EDD7",
      avail: "available",
      rating: null,
      sessions: 0,
      clients: 0,
    };
    appendCoach.mutate(c);
    dispatch(closeModal());
    setName("");
    setSpec("");
    setEmail("");
    toast.success("Coach added");
  };

  return (
    <DashboardLayout title="Coach Management">
      <div className="animate-fadeIn">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold">Coach Management</h3>
          <Button size="sm" type="button" onClick={() => dispatch(openModal("add-coach"))}>
            + Add Coach
          </Button>
        </div>
        <TableWrap>
          <TableToolbar title={`All Coaches (${coaches.length})`} />
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Coach", "Specialty", "Availability", "Rating", "Sessions", "Clients", "Org", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-b-[1.5px] border-line bg-[#EDE7DC] px-[22px] py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-dim"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr>
                  <td colSpan={8} className="px-[22px] py-8 text-center text-sm text-mid">
                    Loading coaches…
                  </td>
                </tr>
              ) : (
                coaches.map((c) => (
                  <tr key={c.id} className="group">
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
                          style={{ background: c.bg }}
                        >
                          {c.emoji}
                        </div>
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-sm text-mid group-hover:bg-[#EDE7DC]">
                      {c.spec}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <Badge
                        variant={
                          c.avail === "available" ? "sage" : c.avail === "busy" ? "gold" : "dim"
                        }
                      >
                        {c.avail}
                      </Badge>
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      {c.rating != null ? `⭐ ${c.rating}` : "—"}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      {c.sessions}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      {c.clients}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-xs text-mid group-hover:bg-[#EDE7DC]">
                      {c.org}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <Button variant="ghost" size="xs" type="button" className="mr-1">
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        type="button"
                        className="text-danger"
                        onClick={() => removeCoach.mutate(c.id)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
      </div>

      <BaseModal
        open={modal === "add-coach"}
        onClose={() => dispatch(closeModal())}
        title="Add New Coach"
      >
        <div className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Smith" />
          </div>
          <div>
            <Label>Specialty</Label>
            <Input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="e.g. CBT · Trauma" />
          </div>
          <div>
            <Label>Organization</Label>
            <Select
              options={[
                { value: "Azadi Health Staff", label: "Azadi Health Staff" },
                { value: "University Partners", label: "University Partners" },
                { value: "External", label: "External" },
              ]}
              value={org}
              onChange={setOrg}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@email.com"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" type="button" onClick={() => dispatch(closeModal())}>
              Cancel
            </Button>
            <Button className="flex-1" type="button" onClick={submit}>
              Add Coach
            </Button>
          </div>
        </div>
      </BaseModal>
    </DashboardLayout>
  );
}
