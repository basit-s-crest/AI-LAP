"use client";

import { useState } from "react";
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
import { useAdminGroupsQuery, useAppendAdminGroupMutation } from "@/hooks/api/use-admin";
import type { CommunityGroup } from "@/types/group";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

const EMOJIS = ["🌿", "🌈", "📚", "🧘", "✊🏾", "🌍", "💚", "🦋"];

export default function AdminGroupsPage() {
  const dispatch = useAppDispatch();
  const { data: groups = [], isPending } = useAdminGroupsQuery();
  const appendGroup = useAppendAdminGroupMutation();
  const modal = useAppSelector((s) => s.ui.modal);
  const [gname, setGname] = useState("");
  const [tags, setTags] = useState("");
  const [emoji, setEmoji] = useState("🌿");

  const submit = () => {
    if (!gname.trim()) {
      toast.error("Group name required");
      return;
    }
    const g: CommunityGroup = {
      id: Date.now(),
      name: gname.trim(),
      emoji,
      members: 0,
      posts: 0,
      joined: false,
      color: "#D4EDD7",
      desc: "",
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      mod: "Admin",
      status: "active",
    };
    appendGroup.mutate(g);
    dispatch(closeModal());
    setGname("");
    setTags("");
    setEmoji("🌿");
    toast.success("Group created");
  };

  return (
    <DashboardLayout title="Community Groups">
      <div className="animate-fadeIn">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold">Community Groups</h3>
          <Button size="sm" type="button" onClick={() => dispatch(openModal("add-group"))}>
            + Create Group
          </Button>
        </div>
        <TableWrap>
          <TableToolbar title={`All Groups (${groups.length})`} />
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Group", "Members", "Posts", "Moderator", "Status", ""].map((h) => (
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
              {isPending ? (
                <tr>
                  <td colSpan={6} className="px-[22px] py-8 text-center text-sm text-mid">
                    Loading groups…
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <tr key={g.id} className="group">
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{g.emoji}</span>
                        <span className="font-semibold">{g.name}</span>
                      </div>
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      {g.members}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      {g.posts}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-sm text-mid group-hover:bg-[#EDE7DC]">
                      {g.mod}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <Badge variant={g.status === "active" ? "sage" : "gold"}>{g.status}</Badge>
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <Button variant="ghost" size="xs" type="button" className="mr-1">
                        Edit
                      </Button>
                      <Button variant="ghost" size="xs" type="button" className="text-danger">
                        Archive
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
        open={modal === "add-group"}
        onClose={() => dispatch(closeModal())}
        title="Create Community Group"
      >
        <div className="space-y-4">
          <div>
            <Label>Group Name</Label>
            <Input value={gname} onChange={(e) => setGname(e.target.value)} placeholder="Group name" />
          </div>
          <div>
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "flex h-[38px] w-[38px] items-center justify-center rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card text-xl",
                    emoji === e && "border-sage bg-sage-soft"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Tags</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. BIPOC, LGBTQ+" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" type="button" onClick={() => dispatch(closeModal())}>
              Cancel
            </Button>
            <Button className="flex-1" type="button" onClick={submit}>
              Create Group
            </Button>
          </div>
        </div>
      </BaseModal>
    </DashboardLayout>
  );
}
