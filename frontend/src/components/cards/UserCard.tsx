import { Badge } from "@/components/ui/Badge";
import type { PlatformUser } from "@/types/user";
import { cn } from "@/lib/cn";

export function UserCardRow({ user }: { user: PlatformUser }) {
  const moodColor =
    user.mood != null && user.mood >= 4
      ? "#4E8C58"
      : user.mood != null && user.mood <= 2
        ? "#C0392B"
        : "#B8832A";
  return (
    <tr className="group">
      <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
        <div className="font-semibold">{user.name}</div>
        <div className="text-xs text-dim">{user.tags.join(" · ")}</div>
      </td>
      <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-mono text-xs text-mid group-hover:bg-[#EDE7DC]">
        {user.joined}
      </td>
      <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
        {user.groups}
      </td>
      <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
        {user.sessions}
      </td>
      <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
        <span className="font-mono font-semibold" style={{ color: moodColor }}>
          {user.mood ?? "—"}
        </span>
      </td>
      <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
        <Badge
          variant={
            user.status === "flagged" ? "red" : user.status === "active" ? "sage" : "dim"
          }
        >
          {user.status}
        </Badge>
      </td>
    </tr>
  );
}
