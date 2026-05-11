"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BaseModal } from "@/components/modals/BaseModal";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { closeModal, openModal } from "@/store/slices/uiSlice";
import {
  useAdminCoaches,
  useCreateAdminCoach,
  useRemoveAdminCoach,
  useUpdateAdminCoach,
} from "@/hooks/admin/useAdminCoaches";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminCoachesPage() {
  const dispatch = useAppDispatch();
  const { data: coaches = [], isPending } = useAdminCoaches();
  const createCoach = useCreateAdminCoach();
  const updateCoach = useUpdateAdminCoach();
  const removeCoach = useRemoveAdminCoach();
  const modal = useAppSelector((s) => s.ui.modal);
  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [org, setOrg] = useState("Azadi Health Staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("coach1234");

  const submit = () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("Name, email and password are required");
      return;
    }

    createCoach.mutate(
      {
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        speciality: spec || undefined,
        bio: org || undefined,
      },
      {
        onSuccess: () => {
          dispatch(closeModal());
          setName("");
          setSpec("");
          setOrg("Azadi Health Staff");
          setEmail("");
          setPassword("coach1234");
          toast.success("Coach added");
        },
        onError: () => toast.error("Failed to add coach"),
      }
    );
  };

  const editCoach = (id: string, currentName: string, currentSpec: string | null, currentBio: string | null) => {
    const nextName = window.prompt("Coach name", currentName);
    if (!nextName) return;
    const nextSpec = window.prompt("Speciality", currentSpec ?? "") ?? "";
    const nextBio = window.prompt("Organization/Bio", currentBio ?? "") ?? "";

    updateCoach.mutate(
      {
        id,
        data: {
          name: nextName,
          speciality: nextSpec || null,
          bio: nextBio || null,
        },
      },
      {
        onSuccess: () => toast.success("Coach updated"),
        onError: () => toast.error("Failed to update coach"),
      }
    );
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
                {["Coach", "Specialty", "Availability", "Members", "Org", ""].map(
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
                  <td colSpan={6} className="px-[22px] py-8 text-center text-sm text-mid">
                    Loading coaches…
                  </td>
                </tr>
              ) : (
                coaches.map((c) => (
                  <tr key={c.id} className="group">
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5DDD4] text-base">
                          {c.avatar ?? "👤"}
                        </div>
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-sm text-mid group-hover:bg-[#EDE7DC]">
                      {c.speciality ?? "—"}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <Badge variant={c.isActive ? "sage" : "dim"}>
                        {c.isActive ? "active" : "inactive"}
                      </Badge>
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      {c.memberCount}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-xs text-mid group-hover:bg-[#EDE7DC]">
                      {c.bio ?? "—"}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <Button
                        variant="ghost"
                        size="xs"
                        type="button"
                        className="mr-1"
                        onClick={() => editCoach(c.id, c.name, c.speciality, c.bio)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        type="button"
                        className="text-danger"
                        onClick={() =>
                          removeCoach.mutate(c.id, {
                            onSuccess: () => toast.success("Coach removed"),
                            onError: () => toast.error("Failed to remove coach"),
                          })
                        }
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
            <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Azadi Health Staff" />
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
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="coach1234"
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
