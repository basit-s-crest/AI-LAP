"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { useAdminUsers } from "@/hooks/admin/useAdminUsers";
import { useAdminCoaches } from "@/hooks/admin/useAdminCoaches";
import { useAdminGroups } from "@/hooks/admin/useAdminGroups";

export default function AdminDashboardPage() {
  const { data: users = [] } = useAdminUsers();
  const { data: coaches = [] } = useAdminCoaches();
  const { data: groups = [] } = useAdminGroups();

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-dim">Users</div>
          <div className="mt-1 text-2xl font-semibold">{users.length}</div>
          <Link href="/admin/users" className="mt-3 inline-block text-sm text-sage hover:underline">
            Manage users
          </Link>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-dim">Coaches</div>
          <div className="mt-1 text-2xl font-semibold">{coaches.length}</div>
          <Link href="/admin/coaches" className="mt-3 inline-block text-sm text-sage hover:underline">
            Manage coaches
          </Link>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-dim">Groups</div>
          <div className="mt-1 text-2xl font-semibold">{groups.length}</div>
          <Link href="/admin/groups" className="mt-3 inline-block text-sm text-sage hover:underline">
            Manage groups
          </Link>
        </Card>
      </div>
    </DashboardLayout>
  );
}
